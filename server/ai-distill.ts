#!/usr/bin/env npx tsx
/**
 * AI Distillation Pipeline — processes teacher decision logs into
 * enhanced student AI weights (v4 schema).
 *
 * Usage:
 *   npx tsx server/ai-distill.ts
 *   npx tsx server/ai-distill.ts --input data/teacher-decisions.jsonl --output data/ai-weights.json
 *   npx tsx server/ai-distill.ts --incremental
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import type { TeacherDecision } from './ai-teacher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

const inputIdx = args.indexOf('--input');
const inputPath = inputIdx >= 0 ? args[inputIdx + 1] : path.join(__dirname, '..', 'data', 'teacher-decisions.jsonl');
const outputIdx = args.indexOf('--output');
const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : path.join(__dirname, '..', 'data', 'ai-weights.json');
const accumulatorPath = path.join(__dirname, '..', 'data', 'ai-accumulators.json');
const incrementalMode = args.includes('--incremental');

// ── Accumulators ──

// v3 accumulators
// cardCode → oppClass → { bonus, count }
const cardMatchupData = new Map<string, Map<string, { bonus: number; count: number }>>();
// cardCode → { onCurveScore, onCurveCount, offCurveScore, offCurveCount }
const cardCurveData = new Map<string, { onCurveScore: number; onCurveCount: number; offCurveScore: number; offCurveCount: number }>();
// cardCode → oppProfile → { score, count }
const mulliganData = new Map<string, Map<string, { score: number; count: number }>>();
// oppProfile → { faceCount, tradeCount, totalDecisions }
const attackPatternData = new Map<string, { faceCount: number; tradeCount: number; totalDecisions: number }>();
// heroClass → { pre, post, total }
const heroPowerTimingData = new Map<string, { pre: number; post: number; total: number }>();

// v4 accumulators
// hero → oppHero → { faceCount, tradeCount, total, boardAdvSum }
const matchupAttackData = new Map<string, Map<string, { faceCount: number; tradeCount: number; total: number; boardAdvSum: number }>>();
// cardCode → position → { scoreSum, count }
const cardPositionData = new Map<string, Map<string, { scoreSum: number; count: number }>>();
// cardCode → phase → { scoreSum, count }
const cardPhaseData = new Map<string, Map<string, { scoreSum: number; count: number }>>();
// heroClass → hpReason → count
const hpTargetStrategyData = new Map<string, Map<string, number>>();
// card1 → card2 → { coPlayCount, scoreSum }
const comboPairData = new Map<string, Map<string, { coPlayCount: number; scoreSum: number }>>();

const PROFILES: Record<string, string> = {
  JIMMY: 'aggro', LUCAS: 'aggro', DES: 'aggro',
  TALA: 'control', ANDERS: 'control', IZZY: 'control',
  DEREK: 'midrange', ASTRID: 'midrange', AVA: 'midrange',
};

function getProfile(heroClass: string): string {
  return PROFILES[heroClass] ?? 'midrange';
}

function getPhase(turn: number): 'early' | 'mid' | 'late' {
  if (turn <= 4) return 'early';
  if (turn <= 7) return 'mid';
  return 'late';
}

// ── Incremental: Load Existing Accumulators ──

interface SerializedAccumulators {
  cardMatchupData: Record<string, Record<string, { bonus: number; count: number }>>;
  cardCurveData: Record<string, { onCurveScore: number; onCurveCount: number; offCurveScore: number; offCurveCount: number }>;
  mulliganData: Record<string, Record<string, { score: number; count: number }>>;
  attackPatternData: Record<string, { faceCount: number; tradeCount: number; totalDecisions: number }>;
  heroPowerTimingData: Record<string, { pre: number; post: number; total: number }>;
  matchupAttackData: Record<string, Record<string, { faceCount: number; tradeCount: number; total: number; boardAdvSum: number }>>;
  cardPositionData: Record<string, Record<string, { scoreSum: number; count: number }>>;
  cardPhaseData: Record<string, Record<string, { scoreSum: number; count: number }>>;
  hpTargetStrategyData: Record<string, Record<string, number>>;
  comboPairData: Record<string, Record<string, { coPlayCount: number; scoreSum: number }>>;
}

const DECAY = 0.95; // decay factor for old data in incremental mode

function loadAccumulators() {
  if (!incrementalMode || !fs.existsSync(accumulatorPath)) return;
  try {
    const raw: SerializedAccumulators = JSON.parse(fs.readFileSync(accumulatorPath, 'utf-8'));
    console.log('Loading existing accumulators (incremental mode, decay=0.95)...');

    // Load v3 accumulators with decay
    for (const [card, matchups] of Object.entries(raw.cardMatchupData ?? {})) {
      const m = new Map<string, { bonus: number; count: number }>();
      for (const [opp, d] of Object.entries(matchups)) m.set(opp, { bonus: d.bonus * DECAY, count: d.count * DECAY });
      cardMatchupData.set(card, m);
    }
    for (const [card, d] of Object.entries(raw.cardCurveData ?? {})) {
      cardCurveData.set(card, { onCurveScore: d.onCurveScore * DECAY, onCurveCount: d.onCurveCount * DECAY, offCurveScore: d.offCurveScore * DECAY, offCurveCount: d.offCurveCount * DECAY });
    }
    for (const [card, profiles] of Object.entries(raw.mulliganData ?? {})) {
      const m = new Map<string, { score: number; count: number }>();
      for (const [p, d] of Object.entries(profiles)) m.set(p, { score: d.score * DECAY, count: d.count * DECAY });
      mulliganData.set(card, m);
    }
    for (const [prof, d] of Object.entries(raw.attackPatternData ?? {})) {
      attackPatternData.set(prof, { faceCount: d.faceCount * DECAY, tradeCount: d.tradeCount * DECAY, totalDecisions: d.totalDecisions * DECAY });
    }
    for (const [hero, d] of Object.entries(raw.heroPowerTimingData ?? {})) {
      heroPowerTimingData.set(hero, { pre: d.pre * DECAY, post: d.post * DECAY, total: d.total * DECAY });
    }

    // Load v4 accumulators with decay
    for (const [hero, opps] of Object.entries(raw.matchupAttackData ?? {})) {
      const m = new Map<string, { faceCount: number; tradeCount: number; total: number; boardAdvSum: number }>();
      for (const [opp, d] of Object.entries(opps)) m.set(opp, { faceCount: d.faceCount * DECAY, tradeCount: d.tradeCount * DECAY, total: d.total * DECAY, boardAdvSum: d.boardAdvSum * DECAY });
      matchupAttackData.set(hero, m);
    }
    for (const [card, positions] of Object.entries(raw.cardPositionData ?? {})) {
      const m = new Map<string, { scoreSum: number; count: number }>();
      for (const [pos, d] of Object.entries(positions)) m.set(pos, { scoreSum: d.scoreSum * DECAY, count: d.count * DECAY });
      cardPositionData.set(card, m);
    }
    for (const [card, phases] of Object.entries(raw.cardPhaseData ?? {})) {
      const m = new Map<string, { scoreSum: number; count: number }>();
      for (const [phase, d] of Object.entries(phases)) m.set(phase, { scoreSum: d.scoreSum * DECAY, count: d.count * DECAY });
      cardPhaseData.set(card, m);
    }
    for (const [hero, strategies] of Object.entries(raw.hpTargetStrategyData ?? {})) {
      const m = new Map<string, number>();
      for (const [strat, count] of Object.entries(strategies)) m.set(strat, (count as number) * DECAY);
      hpTargetStrategyData.set(hero, m);
    }
    for (const [c1, partners] of Object.entries(raw.comboPairData ?? {})) {
      const m = new Map<string, { coPlayCount: number; scoreSum: number }>();
      for (const [c2, d] of Object.entries(partners)) m.set(c2, { coPlayCount: d.coPlayCount * DECAY, scoreSum: d.scoreSum * DECAY });
      comboPairData.set(c1, m);
    }
  } catch (err) {
    console.warn('Failed to load accumulators, starting fresh:', (err as Error).message);
  }
}

function saveAccumulators() {
  const serialized: SerializedAccumulators = {
    cardMatchupData: mapOfMapsToObj(cardMatchupData),
    cardCurveData: Object.fromEntries(cardCurveData),
    mulliganData: mapOfMapsToObj(mulliganData),
    attackPatternData: Object.fromEntries(attackPatternData),
    heroPowerTimingData: Object.fromEntries(heroPowerTimingData),
    matchupAttackData: mapOfMapsToObj(matchupAttackData),
    cardPositionData: mapOfMapsToObj(cardPositionData),
    cardPhaseData: mapOfMapsToObj(cardPhaseData),
    hpTargetStrategyData: mapOfMapsToObj(hpTargetStrategyData),
    comboPairData: mapOfMapsToObj(comboPairData),
  };
  fs.writeFileSync(accumulatorPath, JSON.stringify(serialized));
  console.log(`Accumulators saved to ${accumulatorPath}`);
}

function mapOfMapsToObj<V>(m: Map<string, Map<string, V>>): Record<string, Record<string, V>> {
  const result: Record<string, Record<string, V>> = {};
  for (const [k, inner] of m) { result[k] = Object.fromEntries(inner); }
  return result;
}

// ── Process Decisions ──

async function processDecisions() {
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const fileStream = fs.createReadStream(inputPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineCount = 0;
  let parseErrors = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const decision: TeacherDecision = JSON.parse(line);
      lineCount++;
      processOne(decision);
    } catch {
      parseErrors++;
    }
  }

  console.log(`Processed ${lineCount} decisions (${parseErrors} parse errors)`);
  return lineCount;
}

function processOne(d: TeacherDecision) {
  switch (d.type) {
    case 'play':
      processPlayDecision(d);
      break;
    case 'mulligan':
      processMulliganDecision(d);
      break;
    case 'attack':
      processAttackDecision(d);
      break;
    case 'hero_power':
      processHeroPowerDecision(d);
      break;
  }
}

function processPlayDecision(d: TeacherDecision) {
  if (!d.card || !d.oppHero) return;
  const score = d.score ?? 0;

  // Card-matchup bonus (v3)
  if (!cardMatchupData.has(d.card)) cardMatchupData.set(d.card, new Map());
  const matchupMap = cardMatchupData.get(d.card)!;
  const oppClass = d.oppHero;
  if (!matchupMap.has(oppClass)) matchupMap.set(oppClass, { bonus: 0, count: 0 });
  const m = matchupMap.get(oppClass)!;
  m.bonus += score;
  m.count++;

  // On-curve bonus (v3)
  if (!cardCurveData.has(d.card)) {
    cardCurveData.set(d.card, { onCurveScore: 0, onCurveCount: 0, offCurveScore: 0, offCurveCount: 0 });
  }
  const curve = cardCurveData.get(d.card)!;
  if (d.onCurve) {
    curve.onCurveScore += score;
    curve.onCurveCount++;
  } else {
    curve.offCurveScore += score;
    curve.offCurveCount++;
  }

  // v4: Card position bonus (ahead/even/behind)
  if (d.boardPosition) {
    if (!cardPositionData.has(d.card)) cardPositionData.set(d.card, new Map());
    const posMap = cardPositionData.get(d.card)!;
    if (!posMap.has(d.boardPosition)) posMap.set(d.boardPosition, { scoreSum: 0, count: 0 });
    const pos = posMap.get(d.boardPosition)!;
    pos.scoreSum += score;
    pos.count++;
  }

  // v4: Card phase bonus (early/mid/late)
  if (d.turn !== undefined) {
    const phase = getPhase(d.turn);
    if (!cardPhaseData.has(d.card)) cardPhaseData.set(d.card, new Map());
    const phaseMap = cardPhaseData.get(d.card)!;
    if (!phaseMap.has(phase)) phaseMap.set(phase, { scoreSum: 0, count: 0 });
    const phaseEntry = phaseMap.get(phase)!;
    phaseEntry.scoreSum += score;
    phaseEntry.count++;
  }

  // v4: Combo pairs — record co-played cards
  if (d.cardsPlayedThisTurn && d.cardsPlayedThisTurn.length >= 2 && d.combinedTurnScore !== undefined) {
    const cards = d.cardsPlayedThisTurn;
    const avgScore = d.combinedTurnScore / cards.length;
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const c1 = cards[i] < cards[j] ? cards[i] : cards[j]; // canonical order
        const c2 = cards[i] < cards[j] ? cards[j] : cards[i];
        if (!comboPairData.has(c1)) comboPairData.set(c1, new Map());
        const pairMap = comboPairData.get(c1)!;
        if (!pairMap.has(c2)) pairMap.set(c2, { coPlayCount: 0, scoreSum: 0 });
        const pair = pairMap.get(c2)!;
        pair.coPlayCount++;
        pair.scoreSum += avgScore;
      }
    }
  }
}

function processMulliganDecision(d: TeacherDecision) {
  if (!d.hand || !d.kept || !d.oppHero) return;
  const oppProfile = getProfile(d.oppHero);

  for (let i = 0; i < d.hand.length; i++) {
    const cardCode = d.hand[i];
    const wasKept = d.kept[i];
    if (cardCode === 'COIN') continue;

    if (!mulliganData.has(cardCode)) mulliganData.set(cardCode, new Map());
    const profileMap = mulliganData.get(cardCode)!;
    if (!profileMap.has(oppProfile)) profileMap.set(oppProfile, { score: 0, count: 0 });
    const entry = profileMap.get(oppProfile)!;
    entry.score += wasKept ? 1 : -1;
    entry.count++;
  }
}

function processAttackDecision(d: TeacherDecision) {
  if (!d.reason || !d.oppHero) return;
  const oppProfile = getProfile(d.oppHero);

  // v3: profile-based attack thresholds
  if (!attackPatternData.has(oppProfile)) {
    attackPatternData.set(oppProfile, { faceCount: 0, tradeCount: 0, totalDecisions: 0 });
  }
  const data = attackPatternData.get(oppProfile)!;
  data.totalDecisions++;
  if (d.reason === 'face') data.faceCount++;
  else data.tradeCount++;

  // v4: per-matchup attack thresholds (hero → oppHero)
  if (d.hero && d.oppHero) {
    if (!matchupAttackData.has(d.hero)) matchupAttackData.set(d.hero, new Map());
    const oppMap = matchupAttackData.get(d.hero)!;
    if (!oppMap.has(d.oppHero)) oppMap.set(d.oppHero, { faceCount: 0, tradeCount: 0, total: 0, boardAdvSum: 0 });
    const entry = oppMap.get(d.oppHero)!;
    entry.total++;
    if (d.reason === 'face') entry.faceCount++;
    else {
      entry.tradeCount++;
      // Record board advantage when teacher chose to trade
      if (d.boardAdvantage !== undefined) entry.boardAdvSum += d.boardAdvantage;
    }
  }
}

function processHeroPowerDecision(d: TeacherDecision) {
  if (!d.timing || !d.hero) return;

  // v3: timing data
  if (!heroPowerTimingData.has(d.hero)) {
    heroPowerTimingData.set(d.hero, { pre: 0, post: 0, total: 0 });
  }
  const data = heroPowerTimingData.get(d.hero)!;
  data.total++;
  if (d.timing === 'pre') data.pre++;
  else data.post++;

  // v4: HP target strategy
  if (d.hpReason) {
    if (!hpTargetStrategyData.has(d.hero)) hpTargetStrategyData.set(d.hero, new Map());
    const stratMap = hpTargetStrategyData.get(d.hero)!;
    stratMap.set(d.hpReason, (stratMap.get(d.hpReason) ?? 0) + 1);
  }
}

// ── Build Weights ──

function buildDistilledWeights(teacherGameCount: number): Record<string, any> {
  // Load existing weights
  let existing: any = {};
  if (fs.existsSync(outputPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    } catch { /* start fresh */ }
  }

  // v3: Card matchup bonus: cardCode → oppClass → score (-5 to +5)
  const cardMatchupBonus: Record<string, Record<string, number>> = {};
  for (const [cardCode, matchups] of cardMatchupData) {
    cardMatchupBonus[cardCode] = {};
    for (const [oppClass, data] of matchups) {
      if (data.count < 10) continue;
      const avgScore = data.bonus / data.count;
      cardMatchupBonus[cardCode][oppClass] = Math.max(-5, Math.min(5, avgScore / 10));
    }
  }

  // v3: On-curve bonus: cardCode → bonus score
  const cardOnCurveBonus: Record<string, number> = {};
  for (const [cardCode, data] of cardCurveData) {
    if (data.onCurveCount < 10 || data.offCurveCount < 10) continue;
    const onCurveAvg = data.onCurveScore / data.onCurveCount;
    const offCurveAvg = data.offCurveScore / data.offCurveCount;
    const diff = onCurveAvg - offCurveAvg;
    cardOnCurveBonus[cardCode] = Math.max(-3, Math.min(3, diff / 5));
  }

  // v3: Mulligan keep by matchup: cardCode → oppProfile → keep score (-1..+1)
  const mulliganKeepByMatchup: Record<string, Record<string, number>> = {};
  for (const [cardCode, profiles] of mulliganData) {
    mulliganKeepByMatchup[cardCode] = {};
    for (const [profile, data] of profiles) {
      if (data.count < 20) continue;
      mulliganKeepByMatchup[cardCode][profile] = Math.max(-1, Math.min(1, data.score / data.count));
    }
  }

  // v3: Attack face threshold: oppProfile → board advantage to go face
  const attackFaceThreshold: Record<string, number> = {};
  for (const [profile, data] of attackPatternData) {
    if (data.totalDecisions < 50) continue;
    const faceRatio = data.faceCount / data.totalDecisions;
    attackFaceThreshold[profile] = Math.max(0, Math.round((1 - faceRatio) * 5));
  }

  // v3: Hero power timing
  const heroPowerTiming: Record<string, 'pre' | 'post' | 'always'> = {};
  for (const [heroClass, data] of heroPowerTimingData) {
    if (data.total < 50) continue;
    const preRatio = data.pre / data.total;
    if (preRatio > 0.6) heroPowerTiming[heroClass] = 'pre';
    else if (preRatio < 0.3) heroPowerTiming[heroClass] = 'post';
    else heroPowerTiming[heroClass] = 'always';
  }

  // v4: Per-matchup attack face thresholds (9×9 matrix)
  const attackFaceThresholdByMatchup: Record<string, Record<string, number>> = {};
  for (const [hero, opps] of matchupAttackData) {
    attackFaceThresholdByMatchup[hero] = {};
    for (const [oppHero, data] of opps) {
      if (data.total < 100) continue; // need 100+ decisions per cell
      if (data.tradeCount === 0) {
        attackFaceThresholdByMatchup[hero][oppHero] = 0;
      } else {
        // Average board advantage when teacher chose to trade = threshold
        const avgTradeAdvantage = data.boardAdvSum / data.tradeCount;
        attackFaceThresholdByMatchup[hero][oppHero] = Math.max(0, Math.round(avgTradeAdvantage));
      }
    }
  }

  // v4: Card position bonus: cardCode → position → normalized bonus
  const cardPositionBonus: Record<string, Record<string, number>> = {};
  for (const [cardCode, positions] of cardPositionData) {
    const positionScores: Record<string, number> = {};
    let hasData = false;
    for (const [pos, data] of positions) {
      if (data.count < 20) continue;
      positionScores[pos] = Math.max(-3, Math.min(3, (data.scoreSum / data.count) / 10));
      hasData = true;
    }
    if (hasData) cardPositionBonus[cardCode] = positionScores;
  }

  // v4: Card phase bonus: cardCode → phase → normalized bonus
  const cardPhaseBonus: Record<string, Record<string, number>> = {};
  for (const [cardCode, phases] of cardPhaseData) {
    const phaseScores: Record<string, number> = {};
    let hasData = false;
    for (const [phase, data] of phases) {
      if (data.count < 20) continue;
      phaseScores[phase] = Math.max(-3, Math.min(3, (data.scoreSum / data.count) / 10));
      hasData = true;
    }
    if (hasData) cardPhaseBonus[cardCode] = phaseScores;
  }

  // v4: Hero power target strategy: heroClass → most common strategy
  const heroPowerTargetStrategy: Record<string, string> = {};
  for (const [heroClass, strategies] of hpTargetStrategyData) {
    let bestStrat = '';
    let bestCount = 0;
    for (const [strat, count] of strategies) {
      if (count > bestCount) { bestStrat = strat; bestCount = count; }
    }
    if (bestCount >= 50) heroPowerTargetStrategy[heroClass] = bestStrat;
  }

  // v4: Combo pairs: card1 → card2 → bonus score
  const comboPairs: Record<string, Record<string, number>> = {};
  for (const [c1, partners] of comboPairData) {
    for (const [c2, data] of partners) {
      if (data.coPlayCount < 20) continue;
      const avgScore = data.scoreSum / data.coPlayCount;
      // Normalize to -3..+3
      const bonus = Math.max(-3, Math.min(3, avgScore / 10));
      if (Math.abs(bonus) < 0.3) continue; // skip negligible combos
      if (!comboPairs[c1]) comboPairs[c1] = {};
      comboPairs[c1][c2] = bonus;
      // Also store reverse direction
      if (!comboPairs[c2]) comboPairs[c2] = {};
      comboPairs[c2][c1] = bonus;
    }
  }

  // Merge with existing weights
  const weights = {
    version: 4,
    generatedAt: new Date().toISOString(),
    totalGames: existing.totalGames ?? 0,
    teacherGames: teacherGameCount,
    // Preserve existing v2 fields
    classWinRates: existing.classWinRates ?? {},
    matchupMatrix: existing.matchupMatrix ?? {},
    classProfile: existing.classProfile ?? {},
    classAvgStats: existing.classAvgStats ?? {},
    cardStats: existing.cardStats ?? {},
    // v3 distilled fields
    cardMatchupBonus,
    cardOnCurveBonus,
    mulliganKeepByMatchup,
    attackFaceThreshold,
    heroPowerTiming,
    // v4 distilled fields
    attackFaceThresholdByMatchup,
    cardPositionBonus,
    cardPhaseBonus,
    heroPowerTargetStrategy,
    comboPairs,
  };

  return weights;
}

// ── Main ──

async function main() {
  console.log(`\nAI Distillation Pipeline (v4)`);
  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  if (incrementalMode) console.log(`Mode:   incremental (decay=${DECAY})`);
  console.log();

  // Load existing accumulators if incremental
  loadAccumulators();

  const count = await processDecisions();
  if (count === 0 && !incrementalMode) {
    console.log('No decisions to process. Run teacher simulation first.');
    process.exit(0);
  }

  const weights = buildDistilledWeights(count);

  fs.writeFileSync(outputPath, JSON.stringify(weights, null, 2));

  // Save raw accumulators for future incremental runs
  saveAccumulators();

  // Archive JSONL if incremental
  if (incrementalMode && fs.existsSync(inputPath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bakPath = inputPath.replace('.jsonl', `-${timestamp}.jsonl.bak`);
    fs.renameSync(inputPath, bakPath);
    console.log(`Archived ${inputPath} → ${path.basename(bakPath)}`);
  }

  console.log(`\nDistillation complete:`);
  console.log(`  Card matchup bonuses:   ${Object.keys(weights.cardMatchupBonus).length} cards`);
  console.log(`  On-curve bonuses:       ${Object.keys(weights.cardOnCurveBonus).length} cards`);
  console.log(`  Mulligan keep data:     ${Object.keys(weights.mulliganKeepByMatchup).length} cards`);
  console.log(`  Attack thresholds:      ${Object.keys(weights.attackFaceThreshold).length} profiles`);
  console.log(`  Hero power timing:      ${Object.keys(weights.heroPowerTiming).length} classes`);
  console.log(`  -- v4 signals --`);
  console.log(`  Matchup thresholds:     ${Object.keys(weights.attackFaceThresholdByMatchup).length} heroes`);
  console.log(`  Card position bonus:    ${Object.keys(weights.cardPositionBonus).length} cards`);
  console.log(`  Card phase bonus:       ${Object.keys(weights.cardPhaseBonus).length} cards`);
  console.log(`  HP target strategies:   ${Object.keys(weights.heroPowerTargetStrategy).length} heroes`);
  console.log(`  Combo pairs:            ${Object.keys(weights.comboPairs).length} cards`);
  console.log(`\nWeights saved to ${outputPath}`);
}

main().catch(err => {
  console.error('Distillation failed:', err);
  process.exit(1);
});
