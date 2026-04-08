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
import { getCardDef, getCardsByClassAndNeutral } from './cards.js';
import { STARTER_DECKS } from '../shared/starterDecks.js';
import { DECK_SIZE, MAX_COPIES_PER_CARD, MAX_COPIES_LEGENDARY } from '../shared/deckRules.js';
import { secretTriggerCount, resetSecretTriggerCount } from './secrets.js';
import {
  reloadAIWeights, getAIMulliganReplacements, cardPlayPriority,
  pickSmartAttackTarget, pickSmartTarget, pickTargetFromList, hasLethal, pickLethalTarget,
} from './ai.js';
import { executeTeacherTurn, getTeacherMulliganDecision } from './ai-teacher.js';
import type { TeacherDecision } from './ai-teacher.js';
import type { GameState, BoardMinion, PlayerState, HeroClass } from '../shared/types.js';
import { extractFeatures, FEATURE_DIM } from './ai-neural.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEIGHTS_PATH = path.join(__dirname, '..', 'data', 'ai-weights.json');
const DECISIONS_PATH = path.join(__dirname, '..', 'data', 'teacher-decisions.jsonl');

// Phase 3.3 + Phase 4 — when SIM_HISTORY_FILE is set, dump per-turn feature
// snapshots for the neural board evaluator (scripts/train_neural_eval.py).
// Off by default so existing simulation runs are unchanged.
//
// C3: each worker writes to its own shard. The shard suffix comes from
// SIM_SHARD_ID (set by scripts/parallel-simulate.ts) when running under the
// parallel coordinator, or falls back to process.pid for ad-hoc single-worker
// runs. Using an explicit ID instead of pid is required because `npx tsx`
// forks twice — the coordinator can't know the inner pid up front, so it
// passes a deterministic worker ID via env instead.
//
// `fs.appendFileSync` is only POSIX-atomic up to PIPE_BUF (4096B) and our
// records can hit 15-30KB, so multi-writer to the same file is unsafe.
// scripts/parallel-simulate.ts concatenates the per-shard files after the run.
const _rawHistoryPath = process.env.SIM_HISTORY_FILE
  ? path.resolve(process.env.SIM_HISTORY_FILE)
  : null;
const _shardSuffix = process.env.SIM_SHARD_ID ?? String(process.pid);
const SIM_HISTORY_FILE = _rawHistoryPath
  ? (process.env.SIM_HISTORY_SHARD === '1'
      ? `${_rawHistoryPath}.${_shardSuffix}.jsonl`
      : _rawHistoryPath)
  : null;
if (SIM_HISTORY_FILE) {
  console.log(`[sim] Dumping per-turn snapshots to ${SIM_HISTORY_FILE} (FEATURE_DIM=${FEATURE_DIM})`);
}

interface SimSnapshot {
  turn: number;
  active_player_id: string;
  features: number[];
}
interface SimRecord {
  winner_id: string | null;
  // Phase 4 — needed for margin-of-victory weighting in train_neural_eval.py.
  // The final life of the winner; useful as a "decisiveness" signal.
  final_winner_life?: number;
  snapshots: SimSnapshot[];
}

function appendSimRecord(record: SimRecord): void {
  if (!SIM_HISTORY_FILE) return;
  // C4: skip games with no winner (MAX_TURNS draws). They produce
  // null-labeled rows that the trainer would have to filter out anyway,
  // and the snapshots are positionally meaningless without a known outcome.
  if (record.winner_id == null) return;
  try {
    fs.appendFileSync(SIM_HISTORY_FILE, JSON.stringify(record) + '\n', 'utf-8');
  } catch (e) {
    console.warn(`[sim] Failed to append snapshot: ${e}`);
  }
}

const args = process.argv.slice(2);
const hoursIdx = args.indexOf('--hours');
const hours = hoursIdx >= 0 ? parseFloat(args[hoursIdx + 1] || '0') : 0;
// SIM_GAMES env var (set by parallel-simulate.ts coordinator) takes precedence
// over --games CLI arg so each forked worker can be told how many games to run
// without re-templating the argv list.
const _envGames = process.env.SIM_GAMES ? parseInt(process.env.SIM_GAMES, 10) : NaN;
const gameCount = hours > 0
  ? Infinity
  : (Number.isFinite(_envGames) ? _envGames : parseInt(args[args.indexOf('--games') + 1] || '10'));
const endTime = hours > 0 ? Date.now() + hours * 3600_000 : Infinity;
// SIM_SEED env var (also set by the coordinator) is added to the worker's
// hash so two workers with the same wall-clock start time still diverge.
// Currently informational — Math.random() isn't seedable in plain Node — but
// we surface it in logs so the user can correlate shards to runs.
const SIM_SEED = process.env.SIM_SEED ?? '';
const verbose = args.includes('--verbose');
const learnMode = args.includes('--learn');
const learnCycles = parseInt(args[args.indexOf('--cycles') + 1] || '3');
const teacherMode = args.includes('--teacher');
const teacherVsTeacher = args.includes('--teacher-vs-teacher');
const recordMode = args.includes('--record');
const distillAfter = args.includes('--distill');
const targetedMode = args.includes('--targeted');
const hero1Idx = args.indexOf('--hero1');
const hero1Forced = hero1Idx >= 0 ? (args[hero1Idx + 1] as HeroClass) : null;
const hero2Idx = args.indexOf('--hero2');
const hero2Forced = hero2Idx >= 0 ? (args[hero2Idx + 1] as HeroClass) : null;
const useTeacher = teacherMode || teacherVsTeacher;
const teacherPercentIdx = args.indexOf('--teacher-percent');
const teacherPercent = teacherPercentIdx >= 0 ? parseInt(args[teacherPercentIdx + 1] || '100') : (useTeacher ? 100 : 0);

// ─── Random Deck Builder ───
// Builds a legal 30-card deck for a hero class from the full card pool.
// Rules: class + neutral cards only, max 2 copies (1 for legendary), 30 cards total.
//
// D3: instead of one fixed mana curve we sample one of three archetypes per
// random deck (aggro / midrange / control). Without this, every random deck
// is forced toward the same midrange shape and the trained neural eval never
// sees fast or slow game distributions.
const CURVE_MIDRANGE = [0.05, 0.15, 0.20, 0.20, 0.15, 0.10, 0.08, 0.04, 0.02, 0.005, 0.005];
const CURVE_AGGRO    = [0.10, 0.30, 0.25, 0.18, 0.10, 0.04, 0.02, 0.005, 0.0025, 0.0025, 0.0];
const CURVE_CONTROL  = [0.02, 0.06, 0.10, 0.14, 0.16, 0.16, 0.14, 0.10, 0.06, 0.03, 0.03];
const CURVE_PROFILES = [CURVE_AGGRO, CURVE_MIDRANGE, CURVE_CONTROL] as const;
// Kept for back-compat with any external imports (none currently exist).
const MANA_CURVE_WEIGHTS = CURVE_MIDRANGE;

function buildRandomDeck(heroClass: HeroClass): { heroClass: HeroClass; cards: string[] } {
  const pool = getCardsByClassAndNeutral(heroClass).filter(c =>
    c.cardCode !== 'COIN' && !c.cardCode.includes('_TOKEN_') && c.type !== 'LOCATION'
  );

  const cards: string[] = [];
  const counts = new Map<string, number>();

  // D3: pick a curve archetype uniformly per deck
  const curve = CURVE_PROFILES[Math.floor(Math.random() * CURVE_PROFILES.length)];

  // Weighted random selection biased toward the chosen mana curve
  const weightedPool = pool.map(c => {
    const w = curve[Math.min(c.manaCost, 10)] ?? 0.005;
    // Prefer class cards slightly over neutral
    const classBonus = c.heroClass === heroClass ? 1.5 : 1.0;
    return { card: c, weight: w * classBonus };
  });
  const totalWeight = weightedPool.reduce((s, e) => s + e.weight, 0);

  let attempts = 0;
  while (cards.length < DECK_SIZE && attempts < 1000) {
    attempts++;
    // Weighted random pick
    let r = Math.random() * totalWeight;
    let picked = weightedPool[0].card;
    for (const entry of weightedPool) {
      r -= entry.weight;
      if (r <= 0) { picked = entry.card; break; }
    }

    const code = picked.cardCode;
    const current = counts.get(code) ?? 0;
    const max = picked.rarity === 'LEGENDARY' ? MAX_COPIES_LEGENDARY : MAX_COPIES_PER_CARD;
    if (current >= max) continue;

    cards.push(code);
    counts.set(code, current + 1);
  }

  return { heroClass, cards };
}

// D2: drop starter-deck rate from 50% → 15% so the bulk of training data
// comes from varied random decks. With 9 starter decks the old 50% rate
// produced ~5-10K identical-deck games per 100K runs — very narrow data.
const STARTER_DECK_RATE = 0.15;
function pickDeck(heroClass: HeroClass): { heroClass: HeroClass; cards: string[] } {
  if (Math.random() >= STARTER_DECK_RATE) {
    return buildRandomDeck(heroClass);
  }
  const starter = STARTER_DECKS.find(d => d.heroClass === heroClass);
  return starter ?? buildRandomDeck(heroClass);
}

// Decision recording — async writes with large buffer for performance
const shouldRecord = recordMode || teacherMode || teacherVsTeacher || teacherPercent > 0;
let decisionStream: fs.WriteStream | null = null;
if (shouldRecord) {
  decisionStream = fs.createWriteStream(DECISIONS_PATH, { flags: 'a', highWaterMark: 1024 * 1024 }); // 1MB buffer
}
let decisionCount = 0;

function recordDecision(d: TeacherDecision) {
  if (!decisionStream) return;
  decisionStream.write(JSON.stringify(d) + '\n');
  decisionCount++;
}

console.log(`\n🎮 Miro TCGO AI Simulator — Hearthstone Edition`);
if (useTeacher) {
  console.log(`Mode: ${teacherVsTeacher ? 'Teacher vs Teacher' : 'Teacher (P1) vs Student (P2)'}`);
  if (recordMode || useTeacher) console.log(`Recording decisions to ${DECISIONS_PATH}`);
}
if (teacherPercent > 0 && teacherPercent < 100) {
  console.log(`Teacher percent: ${teacherPercent}% teacher games, ${100 - teacherPercent}% student games`);
}
if (targetedMode) console.log(`Targeted mode: oversampling weakest matchups`);
if (hero1Forced || hero2Forced) console.log(`Forced matchup: ${hero1Forced ?? 'random'} vs ${hero2Forced ?? 'random'}`);
if (hours > 0) {
  console.log(`Running for ${hours} hours (until ${new Date(endTime).toLocaleTimeString()})...\n`);
} else {
  console.log(`Running ${gameCount} games...\n`);
}

// ─── Targeted matchup selection ───

/** Read existing weights and find hero pairs with fewest data points */
function getTargetedMatchup(): [HeroClass, HeroClass] {
  if (hero1Forced && hero2Forced) return [hero1Forced, hero2Forced];

  try {
    if (!fs.existsSync(WEIGHTS_PATH)) return randomMatchup();
    const weights = JSON.parse(fs.readFileSync(WEIGHTS_PATH, 'utf-8'));

    // Find matchup pairs with least data (use matchupMatrix values near 0.5 = uncertain)
    const pairs: Array<{ h1: HeroClass; h2: HeroClass; uncertainty: number }> = [];
    for (const h1 of HERO_CLASSES) {
      for (const h2 of HERO_CLASSES) {
        if (h1 === h2) continue;
        // Check per-matchup attack threshold data as proxy for data quantity
        const hasMatchupData = weights.attackFaceThresholdByMatchup?.[h1]?.[h2] !== undefined;
        const wr = weights.matchupMatrix?.[h1]?.[h2] ?? 0.5;
        // Uncertainty: closer to 0.5 = less certain, no matchup threshold data = highest priority
        const uncertainty = hasMatchupData ? Math.abs(wr - 0.5) : 1.0;
        pairs.push({ h1, h2, uncertainty: 1 - uncertainty }); // invert so highest uncertainty = highest weight
      }
    }

    // Weight selection toward high-uncertainty pairs
    pairs.sort((a, b) => b.uncertainty - a.uncertainty);
    // Pick from top 20% with randomization
    const topN = Math.max(1, Math.floor(pairs.length * 0.2));
    const pick = pairs[Math.floor(Math.random() * topN)];
    return [hero1Forced ?? pick.h1, hero2Forced ?? pick.h2];
  } catch {
    return randomMatchup();
  }
}

function randomMatchup(): [HeroClass, HeroClass] {
  return [
    hero1Forced ?? HERO_CLASSES[Math.floor(Math.random() * HERO_CLASSES.length)],
    hero2Forced ?? HERO_CLASSES[Math.floor(Math.random() * HERO_CLASSES.length)],
  ];
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
// N3: track how many games hit the MAX_TURNS safety cap with no winner.
// These are silently dropped from the snapshot file (C4) and from training
// data; surfacing the count tells us how much data we're throwing away.
let timeoutDraws = 0;
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
    // Deck selection: targeted mode oversamples weak matchups
    let deck1, deck2;
    if (targetedMode || hero1Forced || hero2Forced) {
      const [h1, h2] = targetedMode ? getTargetedMatchup() : [
        hero1Forced ?? HERO_CLASSES[Math.floor(Math.random() * HERO_CLASSES.length)],
        hero2Forced ?? HERO_CLASSES[Math.floor(Math.random() * HERO_CLASSES.length)],
      ];
      deck1 = pickDeck(h1);
      deck2 = pickDeck(h2);
    } else {
      const h1 = HERO_CLASSES[Math.floor(Math.random() * HERO_CLASSES.length)];
      const h2 = HERO_CLASSES[Math.floor(Math.random() * HERO_CLASSES.length)];
      deck1 = pickDeck(h1);
      deck2 = pickDeck(h2);
    }

    // --teacher-percent: decide if this game uses teacher AI
    const isTeacherGame = teacherPercent >= 100 ? useTeacher :
      teacherPercent > 0 ? (Math.random() * 100) < teacherPercent : false;

    // D1: random 50/50 swap of which physical slot the teacher inhabits.
    // Without this, deck1 → ai-1 → slot 0 always, AND `isTeacherPlayer = ...
    // && myIdx === 0` puts the teacher exclusively in slot 0. The neural eval
    // would learn `active_player_id == 'ai-1'` correlates with stronger play
    // — a hidden positional bias that has nothing to do with game state.
    const teacherInSlot1 = isTeacherGame && Math.random() < 0.5;
    if (teacherInSlot1) {
      [deck1, deck2] = [deck2, deck1];
    }

    const game = createGame(
      [
        { id: 'ai-1', name: 'Bot Alpha', heroClass: deck1.heroClass },
        { id: 'ai-2', name: 'Bot Beta', heroClass: deck2.heroClass },
      ],
      { deckLists: [deck1.cards, deck2.cards] }
    );
    // The teacher always plays "ai-1" historically; with the swap above,
    // the teacher is whichever slot ended up holding the original deck1.
    // teacherSlotIdx is the index of the player slot the teacher controls.
    const teacherSlotIdx: 0 | 1 = teacherInSlot1 ? 1 : 0;

    // Smart mulligan using AI logic (teacher for player 1 if in teacher mode)
    let mull1: boolean[];
    let mull2: boolean[];

    if (isTeacherGame || useTeacher) {
      const t1 = getTeacherMulliganDecision(game.players[0].hand, deck1.heroClass, deck2.heroClass, game, 0);
      mull1 = t1.replacements;
      recordDecision(t1.decision);
    } else {
      mull1 = getAIMulliganReplacements(game.players[0].hand, deck1.heroClass, deck2.heroClass);
    }

    if (teacherVsTeacher) {
      const t2 = getTeacherMulliganDecision(game.players[1].hand, deck2.heroClass, deck1.heroClass, game, 1);
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

    // Phase 3.3: per-turn feature snapshots for neural board eval training.
    // Only collected when SIM_HISTORY_FILE is set to avoid the overhead in
    // normal simulation runs.
    const simRecord: SimRecord | null = SIM_HISTORY_FILE
      ? { winner_id: null, snapshots: [] }
      : null;

    let turnCount = 0;
    while (!game.winner && turnCount < MAX_TURNS) {
      turnCount++;
      const pIdx = game.currentPlayerIndex;
      const me = game.players[pIdx];
      const myIdx = pIdx as 0 | 1;
      const oppIdx = (pIdx === 0 ? 1 : 0) as 0 | 1;
      const opp = game.players[oppIdx];

      // Snapshot the state at the start of this player's turn — labeled
      // later with the eventual winner so the neural eval learns to predict
      // win-probability from this position.
      if (simRecord) {
        try {
          simRecord.snapshots.push({
            turn: turnCount,
            active_player_id: me.playerId,
            features: extractFeatures(game, me.playerId),
          });
        } catch {
          // extractFeatures is defensive but if PlayerState shape ever
          // diverges we don't want to crash a 1000-game run over a snapshot.
        }
      }

      // Determine if this player uses teacher AI.
      // D1 — uses teacherSlotIdx (randomized per game) instead of hardcoded 0,
      // so the teacher inhabits both physical slots equally over a long run.
      const isTeacherPlayer = teacherVsTeacher || ((isTeacherGame || useTeacher) && myIdx === teacherSlotIdx);

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

    // Phase 3.3 + Phase 4: persist per-turn snapshots labeled with the
    // actual winner AND with the winner's final life (margin-of-victory
    // signal for the trainer). C4 fix in appendSimRecord drops null-winner
    // games entirely.
    if (simRecord) {
      simRecord.winner_id = game.winner ?? null;
      if (game.winner) {
        const widx = game.players.findIndex(p => p.playerId === game.winner);
        if (widx >= 0) simRecord.final_winner_life = game.players[widx].health;
      }
      appendSimRecord(simRecord);
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
      // N3: surface MAX_TURNS draw count in printResults so we can see how
      // much data the C4 winner-null filter is dropping. Useful regression
      // signal — if this spikes after an engine change, something's wrong.
      timeoutDraws++;
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
  console.log(`Timeout draws:  ${timeoutDraws} (MAX_TURNS reached, dropped from training set)`);
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

// Close decision stream
if (decisionStream) {
  decisionStream.end();
  console.log(`\nTeacher decisions: ${decisionCount} recorded to ${DECISIONS_PATH}`);
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
        const h1 = HERO_CLASSES[Math.floor(Math.random() * HERO_CLASSES.length)];
        const h2 = HERO_CLASSES[Math.floor(Math.random() * HERO_CLASSES.length)];
        const deck1 = pickDeck(h1);
        const deck2 = pickDeck(h2);

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
