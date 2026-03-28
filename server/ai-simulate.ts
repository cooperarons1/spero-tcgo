#!/usr/bin/env npx tsx
/**
 * AI Self-Play Simulator — runs headless AI-vs-AI games.
 *
 * Usage:
 *   npx tsx server/ai-simulate.ts --games 100
 *   npx tsx server/ai-simulate.ts --games 100 --verbose
 *   npx tsx server/ai-simulate.ts --hours 3
 *   npx tsx server/ai-simulate.ts --learn --games 1000 --cycles 5
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGame, endTurn, startTurn, confirmMulligan } from './game.js';
import { playCard, useHeroPower } from './actions.js';
import { attack } from './combat.js';
import { getCardDef } from './cards.js';
import { STARTER_DECKS } from '../shared/starterDecks.js';
import { secretTriggerCount, resetSecretTriggerCount } from './secrets.js';
import {
  reloadAIWeights, getAIMulliganReplacements, cardPlayPriority,
  pickSmartAttackTarget, pickSmartTarget, pickTargetFromList, hasLethal, pickLethalTarget,
} from './ai.js';
import { executeTeacherTurn, getTeacherMulliganDecision } from './ai-teacher.js';
import type { TeacherDecision } from './ai-teacher.js';
import type { GameState, BoardMinion, PlayerState, HeroClass } from '../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEIGHTS_PATH = path.join(__dirname, '..', 'data', 'ai-weights.json');
const DECISIONS_PATH = path.join(__dirname, '..', 'data', 'teacher-decisions.jsonl');

const args = process.argv.slice(2);
const hoursIdx = args.indexOf('--hours');
const hours = hoursIdx >= 0 ? parseFloat(args[hoursIdx + 1] || '0') : 0;
const gameCount = hours > 0 ? Infinity : parseInt(args[args.indexOf('--games') + 1] || '10');
const endTime = hours > 0 ? Date.now() + hours * 3600_000 : Infinity;
const verbose = args.includes('--verbose');
const learnMode = args.includes('--learn');
const learnCycles = parseInt(args[args.indexOf('--cycles') + 1] || '3');
const teacherMode = args.includes('--teacher');
const teacherVsTeacher = args.includes('--teacher-vs-teacher');
const recordMode = args.includes('--record');
const distillAfter = args.includes('--distill');

// Decision recording — use sync append for crash safety (flushes immediately)
const shouldRecord = recordMode || teacherMode || teacherVsTeacher;
let decisionBuffer: string[] = [];
const FLUSH_THRESHOLD = 100; // flush every 100 decisions

function recordDecision(d: TeacherDecision) {
  if (!shouldRecord) return;
  decisionBuffer.push(JSON.stringify(d));
  if (decisionBuffer.length >= FLUSH_THRESHOLD) {
    flushDecisions();
  }
}

function flushDecisions() {
  if (decisionBuffer.length === 0) return;
  fs.appendFileSync(DECISIONS_PATH, decisionBuffer.join('\n') + '\n');
  decisionBuffer = [];
}

const useTeacher = teacherMode || teacherVsTeacher;

console.log(`\n🎮 Miro TCGO AI Simulator — Hearthstone Edition`);
if (useTeacher) {
  console.log(`Mode: ${teacherVsTeacher ? 'Teacher vs Teacher' : 'Teacher (P1) vs Student (P2)'}`);
  if (recordMode || useTeacher) console.log(`Recording decisions to ${DECISIONS_PATH}`);
}
if (hours > 0) {
  console.log(`Running for ${hours} hours (until ${new Date(endTime).toLocaleTimeString()})...\n`);
} else {
  console.log(`Running ${gameCount} games...\n`);
}

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

// ─── Per-card tracking ───
interface CardTracker {
  played: number;
  wins: number;
  keptInMulligan: number;
  keptWins: number;
}
const cardTracker = new Map<string, CardTracker>();

function getOrCreateCardTracker(cardCode: string): CardTracker {
  let t = cardTracker.get(cardCode);
  if (!t) { t = { played: 0, wins: 0, keptInMulligan: 0, keptWins: 0 }; cardTracker.set(cardCode, t); }
  return t;
}

let wins = [0, 0];
let totalTurns = 0;
let errors = 0;
const MAX_TURNS = 80;

let lastProgressTime = Date.now();
const PROGRESS_INTERVAL = 60_000; // log every 60 seconds

for (let g = 0; g < gameCount && Date.now() < endTime; g++) {
  // Periodic progress logging
  if (Date.now() - lastProgressTime >= PROGRESS_INTERVAL) {
    const elapsed = ((Date.now() - (endTime - hours * 3600_000)) / 60_000).toFixed(1);
    const remaining = hours > 0 ? ((endTime - Date.now()) / 60_000).toFixed(0) : '∞';
    const decided = wins[0] + wins[1];
    console.log(`[${elapsed}m] ${g} games played | ${errors} errors | ${remaining}m remaining`);
    lastProgressTime = Date.now();
  }
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

    // Smart mulligan using AI logic (teacher for player 1 if in teacher mode)
    let mull1: boolean[];
    let mull2: boolean[];

    if (useTeacher) {
      const t1 = getTeacherMulliganDecision(game.players[0].hand, deck1.heroClass, deck2.heroClass);
      mull1 = t1.replacements;
      recordDecision(t1.decision);
    } else {
      mull1 = getAIMulliganReplacements(game.players[0].hand, deck1.heroClass, deck2.heroClass);
    }

    if (teacherVsTeacher) {
      const t2 = getTeacherMulliganDecision(game.players[1].hand, deck2.heroClass, deck1.heroClass);
      mull2 = t2.replacements;
      recordDecision(t2.decision);
    } else {
      mull2 = getAIMulliganReplacements(game.players[1].hand, deck2.heroClass, deck1.heroClass);
    }

    // Track mulligan keeps for per-card stats
    const mulliganKept: [string[], string[]] = [[], []];
    game.players[0].hand.forEach((c, i) => { if (!mull1[i]) mulliganKept[0].push(c.cardCode); });
    game.players[1].hand.forEach((c, i) => { if (!mull2[i]) mulliganKept[1].push(c.cardCode); });

    confirmMulligan(game, 'ai-1', mull1);
    confirmMulligan(game, 'ai-2', mull2);

    // Track cards played per player this game
    const cardsPlayed: [Set<string>, Set<string>] = [new Set(), new Set()];

    let turnCount = 0;
    while (!game.winner && turnCount < MAX_TURNS) {
      turnCount++;
      const pIdx = game.currentPlayerIndex;
      const me = game.players[pIdx];
      const myIdx = pIdx as 0 | 1;
      const oppIdx = (pIdx === 0 ? 1 : 0) as 0 | 1;
      const opp = game.players[oppIdx];

      // Determine if this player uses teacher AI
      const isTeacherPlayer = teacherVsTeacher || (useTeacher && myIdx === 0);

      if (isTeacherPlayer) {
        // Teacher AI: lookahead + permutation search (handles cards, attacks, hero power)
        const decisions = executeTeacherTurn(game, myIdx);
        for (const d of decisions) {
          recordDecision(d);
          if (d.type === 'play' && d.card) cardsPlayed[myIdx].add(d.card);
        }
      } else {
        // Student AI: heuristic-based (existing logic)
        // Play cards using smart priority ordering
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
            .sort((a, b) => cardPlayPriority(getCardDef(b.cardCode), me, opp) - cardPlayPriority(getCardDef(a.cardCode), me, opp));

          for (const card of playable) {
            if (game.winner) break;
            const def = getCardDef(card.cardCode);
            if (def.type === 'MINION' && me.board.length >= 7) continue;
            if (def.type === 'LOCATION' && (me.board.length + me.locations.length) >= 7) continue;

            if (def.secretTrigger) {
              if (me.secrets.some(s => s.cardCode === card.cardCode)) continue;
              if (me.secrets.length >= 5) continue;
              totalSecretsPlayed++;
            }

            // Smart targeting for spells and battlecries
            let targetId: string | null = null;
            if (def.type === 'MINION' && def.keywords.includes('BATTLECRY') && def.battlecryEffect) {
              targetId = pickSmartTarget(game, myIdx, def);
            } else if (def.type === 'SPELL' && def.spellEffect) {
              targetId = pickSmartTarget(game, myIdx, def);
            }

            const result = playCard(game, me.playerId, card.instanceId, undefined, targetId);
            if (result.success) {
              cardsPlayed[myIdx].add(card.cardCode);
              played = true;
              break;
            } else if (result.needsTarget && result.validTargets && result.validTargets.length > 0) {
              const retryTarget = pickTargetFromList(game, myIdx, def, result.validTargets);
              const retry = playCard(game, me.playerId, card.instanceId, undefined, retryTarget);
              if (retry.success) {
                cardsPlayed[myIdx].add(card.cardCode);
                played = true;
                break;
              }
            }
          }
        }

        if (game.winner) break;

        // Smart attacks using threat scoring (with lethal check)
        const goingLethal = hasLethal(me, opp);
        for (const minion of [...me.board]) {
          if (game.winner) break;
          if (!minion.canAttack || minion.attacksRemaining <= 0 || minion.isFrozen || minion.currentAttack <= 0) continue;

          const target = goingLethal
            ? pickLethalTarget(minion, opp, oppIdx)
            : pickSmartAttackTarget(minion, me, opp, oppIdx);
          if (!target) continue;
          attack(game, me.playerId, minion.instanceId, target);

          // Windfury second attack
          if (minion.attacksRemaining > 0 && !game.winner) {
            const target2 = pickSmartAttackTarget(minion, me, opp, oppIdx);
            if (target2) attack(game, me.playerId, minion.instanceId, target2);
          }
        }

        if (game.winner) break;

        // Smart hero power
        if (!me.heroPowerUsed && me.mana >= 2) {
          simUseHeroPower(game, me, opp, myIdx, oppIdx);
        }
      }

      if (game.winner) break;
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

      // Per-card stats: credit played cards with win/loss
      for (let pi = 0; pi < 2; pi++) {
        const isWinner = pi === winnerIdx;
        for (const cardCode of cardsPlayed[pi as 0 | 1]) {
          const t = getOrCreateCardTracker(cardCode);
          t.played++;
          if (isWinner) t.wins++;
        }
        // Mulligan keep stats
        for (const cardCode of mulliganKept[pi as 0 | 1]) {
          const t = getOrCreateCardTracker(cardCode);
          t.keptInMulligan++;
          if (isWinner) t.keptWins++;
        }
      }

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

// ─── Smart hero power for simulation ───

function simUseHeroPower(game: GameState, me: PlayerState, opp: PlayerState, myIdx: 0 | 1, oppIdx: 0 | 1) {
  let hpTarget: string | null = null;
  let shouldUse = true;

  switch (me.heroClass) {
    case 'JIMMY': {
      // Prefer exact kills, then any kill, then high-threat chip, then face
      const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);
      if (targetable.length > 0) {
        const exactKill = targetable.find(m => !m.hasDivineShield && m.currentHealth === 2);
        const anyKill = targetable.find(m => !m.hasDivineShield && m.currentHealth <= 2);
        hpTarget = (exactKill ?? anyKill)?.instanceId ?? `hero-${oppIdx}`;
      } else {
        hpTarget = `hero-${oppIdx}`;
      }
      break;
    }
    case 'TALA': {
      if (me.board.length > 0) {
        // Buff highest-attack minion
        const best = [...me.board].sort((a, b) => b.currentAttack - a.currentAttack);
        hpTarget = best[0].instanceId;
      } else {
        shouldUse = false;
      }
      break;
    }
    case 'DEREK':
    case 'DES':
    case 'IZZY':
    case 'LUCAS':
      hpTarget = null;
      break;
    case 'ANDERS': {
      const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);
      if (targetable.length > 0) {
        hpTarget = targetable.sort((a, b) => b.currentAttack - a.currentAttack)[0].instanceId;
      } else {
        shouldUse = false;
      }
      break;
    }
    case 'ASTRID': {
      const candidates = me.board.filter(m => !m.hasDivineShield);
      if (candidates.length > 0) {
        hpTarget = candidates.sort((a, b) => b.currentAttack - a.currentAttack)[0].instanceId;
      } else {
        shouldUse = false;
      }
      break;
    }
    case 'AVA':
      if (me.board.length < 7) hpTarget = null;
      else shouldUse = false;
      break;
    default:
      shouldUse = false;
  }

  if (shouldUse) {
    useHeroPower(game, me.playerId, hpTarget);
  }
}

// ═══════════════════════════════════════
// ─── Results ───
// ═══════════════════════════════════════

function printResults() {
  const decided = wins[0] + wins[1];
  const totalPlayed = decided + errors;

  console.log(`\n══ Aggregate Results ══`);
  console.log(`Total games:    ${totalPlayed}`);
  console.log(`Bot Alpha wins: ${wins[0]}/${totalPlayed} (${((wins[0] / totalPlayed) * 100).toFixed(1)}%)`);
  console.log(`Bot Beta wins:  ${wins[1]}/${totalPlayed} (${((wins[1] / totalPlayed) * 100).toFixed(1)}%)`);
  console.log(`Draws/Errors:   ${totalPlayed - decided}`);
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
}

/** Save simulation results as AI weights JSON for the AI to consume */
function saveWeights() {
  const decided = wins[0] + wins[1];
  if (decided === 0) return;

  // Build per-class win rates
  const classWinRates: Record<string, number> = {};
  for (const hc of HERO_CLASSES) {
    const w = classWins.get(hc) ?? 0;
    const l = classLosses.get(hc) ?? 0;
    const total = w + l;
    classWinRates[hc] = total > 0 ? w / total : 0.5;
  }

  // Build matchup matrix: matchup[attacker][defender] = win rate
  const matchupMatrix: Record<string, Record<string, number>> = {};
  for (const a of HERO_CLASSES) {
    matchupMatrix[a] = {};
    for (const b of HERO_CLASSES) {
      if (a === b) { matchupMatrix[a][b] = 0.5; continue; }
      const winsAB = matchupWins.get(matchupKey(a, b)) ?? 0;
      const winsBA = matchupWins.get(matchupKey(b, a)) ?? 0;
      const total = winsAB + winsBA;
      matchupMatrix[a][b] = total > 0 ? winsAB / total : 0.5;
    }
  }

  // Classify each hero as aggro/control/midrange based on avg game length
  const classProfile: Record<string, string> = {};
  for (const hc of HERO_CLASSES) {
    const wr = classWinRates[hc];
    // Use win rate as a proxy: high WR aggro classes tend to win fast
    // This is a heuristic — with more data we'd track avg turns per class
    if (['JIMMY', 'LUCAS', 'DES'].includes(hc)) classProfile[hc] = 'aggro';
    else if (['TALA', 'ANDERS', 'IZZY'].includes(hc)) classProfile[hc] = 'control';
    else classProfile[hc] = 'midrange';
  }

  // Per-class avg stats
  const classAvgStats: Record<string, { minionsPerGame: number; spellsPerGame: number; heroPowerPerGame: number }> = {};
  if (totalGamesWithStats > 0) {
    const g2 = totalGamesWithStats * 2;
    for (const hc of HERO_CLASSES) {
      // Approximate — we don't track per-class stats in the sim, use averages
      classAvgStats[hc] = {
        minionsPerGame: totalMinionsPlayed / g2,
        spellsPerGame: totalSpellsCast / g2,
        heroPowerPerGame: totalHeroPowerUses / g2,
      };
    }
  }

  // Build per-card stats
  const cardStats: Record<string, { played: number; winRate: number; keepRate: number; keepWinRate: number }> = {};
  for (const [cardCode, t] of cardTracker) {
    if (t.played < 10) continue; // skip cards with too few samples
    cardStats[cardCode] = {
      played: t.played,
      winRate: t.played > 0 ? t.wins / t.played : 0.5,
      keepRate: t.keptInMulligan > 0 ? t.keptInMulligan / (t.keptInMulligan + (t.played - t.keptInMulligan)) : 0,
      keepWinRate: t.keptInMulligan > 0 ? t.keptWins / t.keptInMulligan : 0.5,
    };
  }

  const weights = {
    version: 2,
    generatedAt: new Date().toISOString(),
    totalGames: decided,
    classWinRates,
    matchupMatrix,
    classProfile,
    classAvgStats,
    cardStats,
  };

  fs.writeFileSync(WEIGHTS_PATH, JSON.stringify(weights, null, 2));
  console.log(`\n✅ AI weights saved to ${WEIGHTS_PATH}`);
}

printResults();
saveWeights();

// Flush remaining decisions
if (shouldRecord) {
  flushDecisions();
  if (fs.existsSync(DECISIONS_PATH)) {
    const stats = fs.statSync(DECISIONS_PATH);
    console.log(`\nTeacher decisions saved to ${DECISIONS_PATH} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  }
}

// Auto-distill if requested
if (distillAfter && (useTeacher || recordMode)) {
  console.log('\nRunning distillation...');
  const cp = require('child_process') as typeof import('child_process');
  cp.execSync(`npx tsx ${path.join(__dirname, 'ai-distill.ts')}`, { stdio: 'inherit' });
}

// ─── Learn mode: run multiple cycles ───
if (learnMode && learnCycles > 1) {
  console.log(`\n🔄 Learn mode: running ${learnCycles - 1} more cycle(s)...`);
  for (let cycle = 2; cycle <= learnCycles; cycle++) {
    console.log(`\n═══ Cycle ${cycle}/${learnCycles} ═══`);

    // Reload weights from previous cycle so AI decisions use updated data
    reloadAIWeights();

    // Reset counters
    wins = [0, 0];
    totalTurns = 0;
    errors = 0;
    firstPlayerWins = 0;
    secondPlayerWins = 0;
    totalMinionsPlayed = 0;
    totalSpellsCast = 0;
    totalHeroPowerUses = 0;
    totalDamageToHeroes = 0;
    totalGamesWithStats = 0;
    totalSecretsPlayed = 0;
    resetSecretTriggerCount();
    cardTracker.clear();
    for (const hc of HERO_CLASSES) {
      classWins.set(hc, 0);
      classLosses.set(hc, 0);
    }
    for (const a of HERO_CLASSES) {
      for (const b of HERO_CLASSES) {
        matchupWins.set(matchupKey(a, b), 0);
      }
    }

    const cycleGames = gameCount === Infinity ? Infinity : gameCount;
    const cycleEnd = hours > 0 ? Date.now() + (hours / learnCycles) * 3600_000 : Infinity;

    for (let g = 0; g < cycleGames && Date.now() < cycleEnd; g++) {
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

        const cMull1 = getAIMulliganReplacements(game.players[0].hand, deck1.heroClass, deck2.heroClass);
        const cMull2 = getAIMulliganReplacements(game.players[1].hand, deck2.heroClass, deck1.heroClass);
        const cMulliganKept: [string[], string[]] = [[], []];
        game.players[0].hand.forEach((c, i) => { if (!cMull1[i]) cMulliganKept[0].push(c.cardCode); });
        game.players[1].hand.forEach((c, i) => { if (!cMull2[i]) cMulliganKept[1].push(c.cardCode); });
        confirmMulligan(game, 'ai-1', cMull1);
        confirmMulligan(game, 'ai-2', cMull2);

        const cCardsPlayed: [Set<string>, Set<string>] = [new Set(), new Set()];

        let turnCount = 0;
        while (!game.winner && turnCount < MAX_TURNS) {
          turnCount++;
          const pIdx = game.currentPlayerIndex;
          const me = game.players[pIdx];
          const myIdx = pIdx as 0 | 1;
          const oppIdx = (pIdx === 0 ? 1 : 0) as 0 | 1;
          const opp = game.players[oppIdx];

          let played = true;
          let safety = 0;
          while (played && !game.winner && safety < 30) {
            played = false;
            safety++;
            const playable = me.hand
              .filter(c => { const def = getCardDef(c.cardCode); return def.manaCost <= me.mana && c.cardCode !== 'COIN'; })
              .sort((a, b) => cardPlayPriority(getCardDef(b.cardCode), me, opp) - cardPlayPriority(getCardDef(a.cardCode), me, opp));
            for (const card of playable) {
              if (game.winner) break;
              const def = getCardDef(card.cardCode);
              if (def.type === 'MINION' && me.board.length >= 7) continue;
              if (def.type === 'LOCATION' && (me.board.length + me.locations.length) >= 7) continue;
              if (def.secretTrigger) {
                if (me.secrets.some(s => s.cardCode === card.cardCode)) continue;
                if (me.secrets.length >= 5) continue;
                totalSecretsPlayed++;
              }
              let targetId: string | null = null;
              if (def.type === 'MINION' && def.keywords.includes('BATTLECRY') && def.battlecryEffect) {
                targetId = pickSmartTarget(game, myIdx, def);
              } else if (def.type === 'SPELL' && def.spellEffect) {
                targetId = pickSmartTarget(game, myIdx, def);
              }
              const result = playCard(game, me.playerId, card.instanceId, undefined, targetId);
              if (result.success) { cCardsPlayed[myIdx].add(card.cardCode); played = true; break; }
              else if (result.needsTarget && result.validTargets?.length) {
                const retryTarget = pickTargetFromList(game, myIdx, def, result.validTargets);
                const retry = playCard(game, me.playerId, card.instanceId, undefined, retryTarget);
                if (retry.success) { cCardsPlayed[myIdx].add(card.cardCode); played = true; break; }
              }
            }
          }
          if (game.winner) break;

          const cGoingLethal = hasLethal(me, opp);
          for (const minion of [...me.board]) {
            if (game.winner) break;
            if (!minion.canAttack || minion.attacksRemaining <= 0 || minion.isFrozen || minion.currentAttack <= 0) continue;
            const target = cGoingLethal
              ? pickLethalTarget(minion, opp, oppIdx)
              : pickSmartAttackTarget(minion, me, opp, oppIdx);
            if (!target) continue;
            attack(game, me.playerId, minion.instanceId, target);
            if (minion.attacksRemaining > 0 && !game.winner) {
              const target2 = cGoingLethal
                ? pickLethalTarget(minion, opp, oppIdx)
                : pickSmartAttackTarget(minion, me, opp, oppIdx);
              if (target2) attack(game, me.playerId, minion.instanceId, target2);
            }
          }
          if (game.winner) break;

          if (!me.heroPowerUsed && me.mana >= 2) {
            simUseHeroPower(game, me, opp, myIdx, oppIdx);
          }
          if (game.winner) break;
          endTurn(game, me.playerId);
        }

        if (game.winner) {
          const winnerIdx = game.players.findIndex(p => p.playerId === game.winner);
          const loserIdx = winnerIdx === 0 ? 1 : 0;
          wins[winnerIdx]++;
          totalTurns += game.turnNumber;
          const winnerClass = game.players[winnerIdx].heroClass;
          const loserClass = game.players[loserIdx].heroClass;
          classWins.set(winnerClass, (classWins.get(winnerClass) ?? 0) + 1);
          classLosses.set(loserClass, (classLosses.get(loserClass) ?? 0) + 1);
          matchupWins.set(matchupKey(winnerClass, loserClass), (matchupWins.get(matchupKey(winnerClass, loserClass)) ?? 0) + 1);
          if (winnerIdx === 0) firstPlayerWins++; else secondPlayerWins++;
          for (const stats of game.playerStats) {
            totalMinionsPlayed += stats.minionsPlayed;
            totalSpellsCast += stats.spellsCast;
            totalHeroPowerUses += stats.heroPowerUses;
            totalDamageToHeroes += stats.damageDealtToHeroes ?? 0;
          }
          totalGamesWithStats++;

          // Per-card stats
          for (let pi = 0; pi < 2; pi++) {
            const isWinner = pi === winnerIdx;
            for (const cardCode of cCardsPlayed[pi as 0 | 1]) {
              const t = getOrCreateCardTracker(cardCode);
              t.played++;
              if (isWinner) t.wins++;
            }
            for (const cardCode of cMulliganKept[pi as 0 | 1]) {
              const t = getOrCreateCardTracker(cardCode);
              t.keptInMulligan++;
              if (isWinner) t.keptWins++;
            }
          }
        }
      } catch { errors++; }
    }

    printResults();
    saveWeights();
    console.log(`Cycle ${cycle} complete — weights updated.`);
  }
}
