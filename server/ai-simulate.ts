#!/usr/bin/env npx tsx
/**
 * AI Self-Play Simulator — runs headless AI-vs-AI games.
 *
 * Usage:
 *   npx tsx server/ai-simulate.ts --games 100
 *   npx tsx server/ai-simulate.ts --games 100 --verbose
 */

import { createGame, endTurn, startTurn, confirmMulligan } from './game.js';
import { playCard, useHeroPower } from './actions.js';
import { attack } from './combat.js';
import { getCardDef } from './cards.js';
import { STARTER_DECKS } from '../shared/starterDecks.js';
import { minionHasKeyword, hasActiveTaunt, getTauntMinions } from './keywords.js';
import { secretTriggerCount, resetSecretTriggerCount } from './secrets.js';
import type { GameState, BoardMinion, PlayerState, HeroClass } from '../shared/types.js';

const args = process.argv.slice(2);
const gameCount = parseInt(args[args.indexOf('--games') + 1] || '10');
const verbose = args.includes('--verbose');

console.log(`\n🎮 Miro TCGO AI Simulator — Hearthstone Edition`);
console.log(`Running ${gameCount} games...\n`);

// ─── All hero classes (excluding NEUTRAL) ───
const HERO_CLASSES: HeroClass[] = [
  'JIMMY', 'TALA', 'DEREK', 'ANDERS', 'DES', 'ASTRID', 'AVA', 'LUCAS', 'IZZY',
];

// ─── Per-class win/loss tracking ───
const classWins = new Map<HeroClass, number>();
const classLosses = new Map<HeroClass, number>();
for (const hc of HERO_CLASSES) {
  classWins.set(hc, 0);
  classLosses.set(hc, 0);
}

// ─── Matchup matrix: matchupWins[winner][loser] ───
const matchupWins = new Map<string, number>();
function matchupKey(a: HeroClass, b: HeroClass): string { return `${a}|${b}`; }
for (const a of HERO_CLASSES) {
  for (const b of HERO_CLASSES) {
    matchupWins.set(matchupKey(a, b), 0);
  }
}

// ─── First-player advantage ───
let firstPlayerWins = 0;
let secondPlayerWins = 0;

// ─── Aggregate player stats ───
let totalMinionsPlayed = 0;
let totalSpellsCast = 0;
let totalHeroPowerUses = 0;
let totalDamageToHeroes = 0;
let totalGamesWithStats = 0;

// ─── Secret stats ───
let totalSecretsPlayed = 0;
let totalSecretsCountered = 0; // spells countered
resetSecretTriggerCount();

let wins = [0, 0];
let totalTurns = 0;
let errors = 0;
const MAX_TURNS = 80;

for (let g = 0; g < gameCount; g++) {
  try {
    const deck1 = STARTER_DECKS[Math.floor(Math.random() * STARTER_DECKS.length)];
    const deck2 = STARTER_DECKS[Math.floor(Math.random() * STARTER_DECKS.length)];

    const game = createGame(
      [
        { id: 'ai-1', name: 'Bot Alpha', heroClass: deck1.heroClass },
        { id: 'ai-2', name: 'Bot Beta', heroClass: deck2.heroClass },
      ],
      { deckLists: [deck1.cards, deck2.cards] }
    );

    // Auto-mulligan: keep all
    confirmMulligan(game, 'ai-1', game.players[0].hand.map(() => false));
    confirmMulligan(game, 'ai-2', game.players[1].hand.map(() => false));

    let turnCount = 0;
    while (!game.winner && turnCount < MAX_TURNS) {
      turnCount++;
      const pIdx = game.currentPlayerIndex;
      const me = game.players[pIdx];
      const oppIdx = (pIdx === 0 ? 1 : 0) as 0 | 1;
      const opp = game.players[oppIdx];

      // Play cards
      let played = true;
      let safety = 0;
      while (played && !game.winner && safety < 30) {
        played = false;
        safety++;

        const playable = me.hand
          .filter(c => {
            const def = getCardDef(c.cardCode);
            return def.manaCost <= me.mana && c.cardCode !== 'COIN';
          })
          .sort((a, b) => getCardDef(b.cardCode).manaCost - getCardDef(a.cardCode).manaCost);

        for (const card of playable) {
          if (game.winner) break;
          const def = getCardDef(card.cardCode);
          if (def.type === 'MINION' && me.board.length >= 7) continue;

          // Track secrets played
          if (def.secretTrigger) {
            totalSecretsPlayed++;
          }

          let targetId: string | null = null;
          const result = playCard(game, me.playerId, card.instanceId, undefined, targetId);
          if (result.success) {
            played = true;
            break;
          } else if (result.needsTarget && result.validTargets && result.validTargets.length > 0) {
            // Pick first enemy target for damage, first friendly for buffs
            const target = result.validTargets[0];
            const retry = playCard(game, me.playerId, card.instanceId, undefined, target);
            if (retry.success) {
              played = true;
              break;
            }
          }
        }
      }

      if (game.winner) break;

      // Attacks
      for (const minion of [...me.board]) {
        if (game.winner) break;
        if (!minion.canAttack || minion.attacksRemaining <= 0 || minion.isFrozen || minion.currentAttack <= 0) continue;

        const taunts = getTauntMinions(opp.board);
        let target: string;
        if (taunts.length > 0) {
          target = taunts[0].instanceId;
        } else if (opp.board.length > 0) {
          const killable = opp.board.filter(m => m.currentHealth <= minion.currentAttack && !m.hasStealthUntilAttack);
          if (killable.length > 0) {
            target = killable.sort((a, b) => b.currentAttack - a.currentAttack)[0].instanceId;
          } else {
            target = `hero-${oppIdx}`;
          }
        } else {
          target = `hero-${oppIdx}`;
        }

        attack(game, me.playerId, minion.instanceId, target);
      }

      if (game.winner) break;

      // Hero power
      if (!me.heroPowerUsed && me.mana >= 2) {
        let hpTarget: string | null = null;
        let shouldUse = true;
        switch (me.heroClass) {
          case 'JIMMY':
            hpTarget = opp.board.length > 0 ? opp.board[0].instanceId : `hero-${oppIdx}`;
            break;
          case 'TALA':
            hpTarget = `hero-${pIdx}`;
            break;
          case 'DEREK':
          case 'DES':
          case 'IZZY':
            hpTarget = null; // no target needed
            break;
          case 'ANDERS':
            if (opp.board.length > 0) hpTarget = opp.board[0].instanceId;
            else shouldUse = false;
            break;
          case 'ASTRID':
            {
              const candidates = me.board.filter(m => !m.hasDivineShield);
              if (candidates.length > 0) hpTarget = candidates[0].instanceId;
              else shouldUse = false;
            }
            break;
          case 'AVA':
            if (me.board.length < 7) hpTarget = null;
            else shouldUse = false;
            break;
          case 'LUCAS':
            if (opp.board.length > 0) hpTarget = null;
            else shouldUse = false;
            break;
        }
        if (shouldUse) {
          useHeroPower(game, me.playerId, hpTarget);
        }
      }

      if (game.winner) break;

      // End turn
      endTurn(game, me.playerId);
    }

    if (game.winner) {
      const winnerIdx = game.players.findIndex(p => p.playerId === game.winner);
      const loserIdx = winnerIdx === 0 ? 1 : 0;
      wins[winnerIdx]++;
      totalTurns += game.turnNumber;

      const winnerClass = game.players[winnerIdx].heroClass;
      const loserClass = game.players[loserIdx].heroClass;

      // Per-class tracking
      classWins.set(winnerClass, (classWins.get(winnerClass) ?? 0) + 1);
      classLosses.set(loserClass, (classLosses.get(loserClass) ?? 0) + 1);

      // Matchup matrix
      const key = matchupKey(winnerClass, loserClass);
      matchupWins.set(key, (matchupWins.get(key) ?? 0) + 1);

      // First-player advantage (player index 0 goes first)
      if (winnerIdx === 0) firstPlayerWins++;
      else secondPlayerWins++;

      // Aggregate player stats
      for (const stats of game.playerStats) {
        totalMinionsPlayed += stats.minionsPlayed;
        totalSpellsCast += stats.spellsCast;
        totalHeroPowerUses += stats.heroPowerUses;
        totalDamageToHeroes += stats.damageDealtToHeroes ?? 0;
      }
      totalGamesWithStats++;

      if (verbose) {
        console.log(`Game ${g + 1}: ${game.players[winnerIdx].playerName} (${winnerClass}) beats ${loserClass} on turn ${game.turnNumber} via ${game.winReason}`);
      }
    } else {
      if (verbose) console.log(`Game ${g + 1}: Draw (max turns reached)`);
    }
  } catch (err) {
    errors++;
    if (verbose) console.error(`Game ${g + 1}: ERROR:`, (err as Error).message);
  }
}

// ═══════════════════════════════════════
// ─── Results ───
// ═══════════════════════════════════════

const decided = wins[0] + wins[1];

console.log(`\n══ Aggregate Results ══`);
console.log(`Bot Alpha wins: ${wins[0]}/${gameCount} (${((wins[0] / gameCount) * 100).toFixed(1)}%)`);
console.log(`Bot Beta wins:  ${wins[1]}/${gameCount} (${((wins[1] / gameCount) * 100).toFixed(1)}%)`);
console.log(`Draws/Errors:   ${gameCount - decided}`);
console.log(`Avg turns:      ${decided > 0 ? (totalTurns / decided).toFixed(1) : 'N/A'}`);
console.log(`Errors:         ${errors}`);

// ─── First-player advantage ───
console.log(`\n══ First-Player Advantage ══`);
if (decided > 0) {
  console.log(`Going first:  ${firstPlayerWins}/${decided} (${((firstPlayerWins / decided) * 100).toFixed(1)}%)`);
  console.log(`Going second: ${secondPlayerWins}/${decided} (${((secondPlayerWins / decided) * 100).toFixed(1)}%)`);
} else {
  console.log(`No decided games.`);
}

// ─── Per-class win rates ───
console.log(`\n══ Win Rate by Hero Class ══`);
console.log(`${'Class'.padEnd(10)} ${'Wins'.padStart(6)} ${'Losses'.padStart(7)} ${'Win%'.padStart(7)}`);
console.log('─'.repeat(32));
for (const hc of HERO_CLASSES) {
  const w = classWins.get(hc) ?? 0;
  const l = classLosses.get(hc) ?? 0;
  const total = w + l;
  const pct = total > 0 ? ((w / total) * 100).toFixed(1) : 'N/A';
  console.log(`${hc.padEnd(10)} ${String(w).padStart(6)} ${String(l).padStart(7)} ${String(pct + '%').padStart(7)}`);
}

// ─── Matchup matrix ───
console.log(`\n══ Class Matchup Matrix (row beats column) ══`);
const shortName: Record<HeroClass, string> = {
  JIMMY: 'JIM', TALA: 'TAL', DEREK: 'DRK', ANDERS: 'AND',
  DES: 'DES', ASTRID: 'AST', AVA: 'AVA', LUCAS: 'LUC', IZZY: 'IZZ', NEUTRAL: 'NEU',
};
// Header
process.stdout.write('       ');
for (const col of HERO_CLASSES) process.stdout.write(shortName[col].padStart(5));
console.log();
// Rows
for (const row of HERO_CLASSES) {
  process.stdout.write(shortName[row].padEnd(7));
  for (const col of HERO_CLASSES) {
    if (row === col) {
      process.stdout.write('   - ');
    } else {
      const w = matchupWins.get(matchupKey(row, col)) ?? 0;
      process.stdout.write(String(w).padStart(5));
    }
  }
  console.log();
}

// ─── Aggregate per-game stats ───
console.log(`\n══ Average Per-Game Stats (across both players) ══`);
if (totalGamesWithStats > 0) {
  const g2 = totalGamesWithStats * 2; // total player-games
  console.log(`Minions played:  ${(totalMinionsPlayed / g2).toFixed(1)} per player per game`);
  console.log(`Spells cast:     ${(totalSpellsCast / g2).toFixed(1)} per player per game`);
  console.log(`Hero power uses: ${(totalHeroPowerUses / g2).toFixed(1)} per player per game`);
  console.log(`Damage to heroes:${(totalDamageToHeroes / g2).toFixed(1)} per player per game`);
}

// ─── Secret stats ───
console.log(`\n══ Secret Stats ══`);
console.log(`Secrets played:    ${totalSecretsPlayed}`);
console.log(`Secrets triggered: ${secretTriggerCount}`);
console.log();
