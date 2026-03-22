#!/usr/bin/env npx tsx
/**
 * AI Self-Play Simulator — runs headless AI-vs-AI games synchronously.
 *
 * Usage:
 *   npx tsx server/ai-simulate.ts --games 100
 *   npx tsx server/ai-simulate.ts --games 500 --deck1 "Jimmy's Crew" --deck2 "Shadow Command"
 *   npx tsx server/ai-simulate.ts --games 100 --all-vs-all
 *   npx tsx server/ai-simulate.ts --games 50 --verbose
 */

import { createGame } from './game.js';
import { doAIBuild, doAIAction, handleAIBlock, handleAICombatTrick, handleAITargetChoice } from './ai.js';
import { STARTER_DECKS } from '../shared/starterDecks.js';
import type { GameState } from '../shared/types.js';

// ── Types ──

interface GameResult {
  winner: 'deck1' | 'deck2' | 'timeout';
  turns: number;
  winReason: 'ap' | 'deckout' | 'timeout';
  apScores: [number, number];
  error?: string;
}

interface MatchupStats {
  deck1Name: string;
  deck2Name: string;
  deck1Wins: number;
  deck2Wins: number;
  timeouts: number;
  totalGames: number;
  avgTurns: number;
  winReasons: { ap: number; deckout: number; timeout: number };
  errors: { message: string; turn: number; phase: string; gameIndex: number }[];
}

// ── CLI Args ──

function parseArgs(): { games: number; deck1?: string; deck2?: string; allVsAll: boolean; verbose: boolean; maxTurns: number } {
  const args = process.argv.slice(2);
  let games = 100;
  let deck1: string | undefined;
  let deck2: string | undefined;
  let allVsAll = false;
  let verbose = false;
  let maxTurns = 200;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--games': games = parseInt(args[++i], 10); break;
      case '--deck1': deck1 = args[++i]; break;
      case '--deck2': deck2 = args[++i]; break;
      case '--all-vs-all': allVsAll = true; break;
      case '--verbose': verbose = true; break;
      case '--max-turns': maxTurns = parseInt(args[++i], 10); break;
      default:
        console.error(`Unknown flag: ${args[i]}`);
        process.exit(1);
    }
  }

  return { games, deck1, deck2, allVsAll, verbose, maxTurns };
}

// ── Core Game Loop ──

const MAX_ACTIONS = 2000;

/**
 * Perform exactly one AI action. Returns true if the game should continue,
 * false if done (winner found or stuck).
 */
function stepGame(game: GameState, p1Id: string, p2Id: string): boolean {
  if (game.winner) return false;

  // Dismiss combat result
  if (game.combatResult) {
    game.combatResult = null;
    return true;
  }

  // Handle pending interactions
  if (game.pendingInteraction) {
    const waitingId = game.pendingInteraction.waitingForPlayerId;
    if (game.pendingInteraction.type === 'BLOCK_DECISION') {
      handleAIBlock(game, waitingId);
      return true;
    }
    if (game.pendingInteraction.type === 'COMBAT_TRICK') {
      handleAICombatTrick(game, waitingId);
      return true;
    }
    if (game.pendingInteraction.type === 'CHOOSE_TARGET') {
      handleAITargetChoice(game, waitingId);
      return true;
    }
  }

  // Active turn phases
  const currentPlayerId = game.players[game.currentPlayerIndex].playerId;

  if (game.turnPhase === 'BUILD') {
    doAIBuild(game, currentPlayerId);
    return true;
  }

  if (game.turnPhase === 'ACTION') {
    doAIAction(game, currentPlayerId);
    return true;
  }

  // UNTAP/DRAW/END auto-advance — shouldn't land here
  return false;
}

function runOneGame(
  deck1Cards: string[],
  deck2Cards: string[],
  maxTurns: number,
  verbose: boolean,
): GameResult {
  const p1Id = 'sim-player-1';
  const p2Id = 'sim-player-2';

  const game = createGame(
    [{ id: p1Id, name: 'Deck1' }, { id: p2Id, name: 'Deck2' }],
    { deckLists: [deck1Cards, deck2Cards] },
  );

  let actions = 0;
  let recoveryFailures = 0;

  while (actions < MAX_ACTIONS) {
    if (game.winner) break;
    if (game.turnNumber > maxTurns) break;

    try {
      const continued = stepGame(game, p1Id, p2Id);
      if (!continued && !game.winner) {
        // Stuck — attempt recovery
        recoveryFailures++;
        if (recoveryFailures > 3) break;
        game.combatResult = null;
        game.pendingInteraction = null;
        game.combatState = null;
        continue;
      }
      recoveryFailures = 0;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (verbose) {
        console.error(`  [ERROR] Turn ${game.turnNumber} ${game.turnPhase}: ${msg}`);
      }
      recoveryFailures++;
      if (recoveryFailures > 3) {
        return {
          winner: 'timeout',
          turns: game.turnNumber,
          winReason: 'timeout',
          apScores: [...game.apScores],
          error: msg,
        };
      }
      // Attempt recovery
      game.combatResult = null;
      game.pendingInteraction = null;
      game.combatState = null;
    }

    actions++;

    if (verbose && game.lastAction) {
      console.log(`  T${game.turnNumber} ${game.turnPhase}: ${game.lastAction}`);
    }
  }

  if (game.winner) {
    const winnerSide = game.winner === p1Id ? 'deck1' : 'deck2';
    return {
      winner: winnerSide,
      turns: game.turnNumber,
      winReason: game.winReason as 'ap' | 'deckout',
      apScores: [...game.apScores],
    };
  }

  return {
    winner: 'timeout',
    turns: game.turnNumber,
    winReason: 'timeout',
    apScores: [...game.apScores],
  };
}

// ── Matchup Runner ──

function runMatchup(
  deck1Name: string,
  deck1Cards: string[],
  deck2Name: string,
  deck2Cards: string[],
  numGames: number,
  maxTurns: number,
  verbose: boolean,
): MatchupStats {
  const stats: MatchupStats = {
    deck1Name,
    deck2Name,
    deck1Wins: 0,
    deck2Wins: 0,
    timeouts: 0,
    totalGames: numGames,
    avgTurns: 0,
    winReasons: { ap: 0, deckout: 0, timeout: 0 },
    errors: [],
  };

  let totalTurns = 0;

  for (let i = 0; i < numGames; i++) {
    if (verbose) console.log(`\n--- Game ${i + 1}: ${deck1Name} vs ${deck2Name} ---`);

    const result = runOneGame(deck1Cards, deck2Cards, maxTurns, verbose);
    totalTurns += result.turns;

    if (result.winner === 'deck1') stats.deck1Wins++;
    else if (result.winner === 'deck2') stats.deck2Wins++;
    else stats.timeouts++;

    stats.winReasons[result.winReason]++;

    if (result.error) {
      stats.errors.push({
        message: result.error,
        turn: result.turns,
        phase: 'unknown',
        gameIndex: i + 1,
      });
    }
  }

  stats.avgTurns = totalTurns / numGames;
  return stats;
}

// ── Output ──

function printResults(allStats: MatchupStats[], elapsed: number): void {
  const totalGames = allStats.reduce((s, m) => s + m.totalGames, 0);

  console.log('\n=== AI Self-Play Results ===');
  console.log(`Games per matchup: ${allStats[0]?.totalGames ?? 0} | Max turns: ${config.maxTurns}\n`);

  // Header
  const h = [
    pad('Deck 1', 20), pad('Deck 2', 20),
    pad('D1Win', 7), pad('D2Win', 7), pad('Draw', 6),
    pad('AvgTurns', 10), pad('Errors', 8),
  ];
  const sep = h.map(c => '─'.repeat(c.length));

  console.log(`┌${sep.join('┬')}┐`);
  console.log(`│${h.join('│')}│`);
  console.log(`├${sep.join('┼')}┤`);

  for (const m of allStats) {
    const d1pct = m.totalGames > 0 ? `${Math.round(m.deck1Wins / m.totalGames * 100)}%` : '-';
    const d2pct = m.totalGames > 0 ? `${Math.round(m.deck2Wins / m.totalGames * 100)}%` : '-';
    const drawPct = m.totalGames > 0 ? `${Math.round(m.timeouts / m.totalGames * 100)}%` : '-';

    const row = [
      pad(m.deck1Name, 20), pad(m.deck2Name, 20),
      pad(d1pct, 7, true), pad(d2pct, 7, true), pad(drawPct, 6, true),
      pad(m.avgTurns.toFixed(1), 10, true), pad(String(m.errors.length), 8, true),
    ];
    console.log(`│${row.join('│')}│`);
  }

  console.log(`└${sep.join('┴')}┘`);

  // Aggregate win reasons
  const totals = { ap: 0, deckout: 0, timeout: 0 };
  for (const m of allStats) {
    totals.ap += m.winReasons.ap;
    totals.deckout += m.winReasons.deckout;
    totals.timeout += m.winReasons.timeout;
  }
  const pct = (n: number) => totalGames > 0 ? `${Math.round(n / totalGames * 100)}%` : '-';
  console.log(`\nWIN REASONS: AP: ${pct(totals.ap)} | Deckout: ${pct(totals.deckout)} | Timeout: ${pct(totals.timeout)}`);

  // Errors
  const allErrors = allStats.flatMap(m => m.errors.map(e => ({ ...e, matchup: `${m.deck1Name} vs ${m.deck2Name}` })));
  if (allErrors.length > 0) {
    console.log(`\nERRORS (${allErrors.length}):`);
    for (const e of allErrors.slice(0, 20)) {
      console.log(`  Game #${e.gameIndex} Turn ${e.turn}: "${e.message}" (${e.matchup})`);
    }
    if (allErrors.length > 20) console.log(`  ... and ${allErrors.length - 20} more`);
  }

  const gamesPerSec = elapsed > 0 ? (totalGames / (elapsed / 1000)).toFixed(0) : '∞';
  console.log(`\nTotal time: ${(elapsed / 1000).toFixed(1)}s (${gamesPerSec} games/sec)`);
}

function pad(s: string, width: number, center = false): string {
  if (s.length >= width) return s.slice(0, width);
  if (center) {
    const left = Math.floor((width - s.length) / 2);
    return ' '.repeat(left) + s + ' '.repeat(width - s.length - left);
  }
  return s + ' '.repeat(width - s.length);
}

// ── Main ──

const config = parseArgs();

function findDeck(name: string): { name: string; cards: string[] } {
  const deck = STARTER_DECKS.find(d => d.name.toLowerCase() === name.toLowerCase());
  if (!deck) {
    console.error(`Unknown deck: "${name}". Available: ${STARTER_DECKS.map(d => d.name).join(', ')}`);
    process.exit(1);
  }
  return { name: deck.name, cards: deck.cards };
}

function randomDeck(): { name: string; cards: string[] } {
  const d = STARTER_DECKS[Math.floor(Math.random() * STARTER_DECKS.length)];
  return { name: d.name, cards: d.cards };
}

const start = Date.now();
const results: MatchupStats[] = [];

if (config.allVsAll) {
  // Every pair including mirrors: C(5,2) + 5 = 15 matchups
  for (let i = 0; i < STARTER_DECKS.length; i++) {
    for (let j = i; j < STARTER_DECKS.length; j++) {
      const d1 = STARTER_DECKS[i];
      const d2 = STARTER_DECKS[j];
      console.log(`Running: ${d1.name} vs ${d2.name} (${config.games} games)...`);
      results.push(runMatchup(d1.name, d1.cards, d2.name, d2.cards, config.games, config.maxTurns, config.verbose));
    }
  }
} else {
  const d1 = config.deck1 ? findDeck(config.deck1) : randomDeck();
  const d2 = config.deck2 ? findDeck(config.deck2) : randomDeck();
  console.log(`Running: ${d1.name} vs ${d2.name} (${config.games} games)...`);
  results.push(runMatchup(d1.name, d1.cards, d2.name, d2.cards, config.games, config.maxTurns, config.verbose));
}

const elapsed = Date.now() - start;
printResults(results, elapsed);
