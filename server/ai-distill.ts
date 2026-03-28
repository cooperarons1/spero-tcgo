#!/usr/bin/env npx tsx
/**
 * AI Distillation Pipeline — processes teacher decision logs into
 * enhanced student AI weights (v3 schema).
 *
 * Usage:
 *   npx tsx server/ai-distill.ts
 *   npx tsx server/ai-distill.ts --input data/teacher-decisions.jsonl --output data/ai-weights.json
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

// ── Accumulators ──

// cardCode → oppClass → { wins, total }
const cardMatchupData = new Map<string, Map<string, { bonus: number; count: number }>>();
// cardCode → { onCurveWins, onCurveTotal, offCurveWins, offCurveTotal }
const cardCurveData = new Map<string, { onCurveScore: number; onCurveCount: number; offCurveScore: number; offCurveCount: number }>();
// cardCode → oppProfile → { kept, keptTotal }
const mulliganData = new Map<string, Map<string, { score: number; count: number }>>();
// oppProfile → { faceCount, tradeCount, boardAdvSum }
const attackPatternData = new Map<string, { faceCount: number; tradeCount: number; totalDecisions: number }>();
// heroClass → { pre, post, skip }
const heroPowerTimingData = new Map<string, { pre: number; post: number; total: number }>();

const PROFILES: Record<string, string> = {
  JIMMY: 'aggro', LUCAS: 'aggro', DES: 'aggro',
  TALA: 'control', ANDERS: 'control', IZZY: 'control',
  DEREK: 'midrange', ASTRID: 'midrange', AVA: 'midrange',
};

function getProfile(heroClass: string): string {
  return PROFILES[heroClass] ?? 'midrange';
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

  // Card-matchup bonus
  if (!cardMatchupData.has(d.card)) cardMatchupData.set(d.card, new Map());
  const matchupMap = cardMatchupData.get(d.card)!;
  const oppClass = d.oppHero;
  if (!matchupMap.has(oppClass)) matchupMap.set(oppClass, { bonus: 0, count: 0 });
  const m = matchupMap.get(oppClass)!;
  m.bonus += score;
  m.count++;

  // On-curve bonus
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

  if (!attackPatternData.has(oppProfile)) {
    attackPatternData.set(oppProfile, { faceCount: 0, tradeCount: 0, totalDecisions: 0 });
  }
  const data = attackPatternData.get(oppProfile)!;
  data.totalDecisions++;
  if (d.reason === 'face') data.faceCount++;
  else data.tradeCount++;
}

function processHeroPowerDecision(d: TeacherDecision) {
  if (!d.timing || !d.hero) return;

  if (!heroPowerTimingData.has(d.hero)) {
    heroPowerTimingData.set(d.hero, { pre: 0, post: 0, total: 0 });
  }
  const data = heroPowerTimingData.get(d.hero)!;
  data.total++;
  if (d.timing === 'pre') data.pre++;
  else data.post++;
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

  // Card matchup bonus: cardCode → oppClass → score (-5 to +5)
  const cardMatchupBonus: Record<string, Record<string, number>> = {};
  for (const [cardCode, matchups] of cardMatchupData) {
    cardMatchupBonus[cardCode] = {};
    for (const [oppClass, data] of matchups) {
      if (data.count < 10) continue;
      const avgScore = data.bonus / data.count;
      // Normalize to -5..+5 range (teacher scores are roughly -50..+50)
      cardMatchupBonus[cardCode][oppClass] = Math.max(-5, Math.min(5, avgScore / 10));
    }
  }

  // On-curve bonus: cardCode → bonus score
  const cardOnCurveBonus: Record<string, number> = {};
  for (const [cardCode, data] of cardCurveData) {
    if (data.onCurveCount < 10 || data.offCurveCount < 10) continue;
    const onCurveAvg = data.onCurveScore / data.onCurveCount;
    const offCurveAvg = data.offCurveScore / data.offCurveCount;
    const diff = onCurveAvg - offCurveAvg;
    // Positive = better on curve, clamp to -3..+3
    cardOnCurveBonus[cardCode] = Math.max(-3, Math.min(3, diff / 5));
  }

  // Mulligan keep by matchup: cardCode → oppProfile → keep score (-1..+1)
  const mulliganKeepByMatchup: Record<string, Record<string, number>> = {};
  for (const [cardCode, profiles] of mulliganData) {
    mulliganKeepByMatchup[cardCode] = {};
    for (const [profile, data] of profiles) {
      if (data.count < 20) continue;
      // score/count gives average between -1 and +1
      mulliganKeepByMatchup[cardCode][profile] = Math.max(-1, Math.min(1, data.score / data.count));
    }
  }

  // Attack face threshold: oppProfile → ratio of face attacks
  const attackFaceThreshold: Record<string, number> = {};
  for (const [profile, data] of attackPatternData) {
    if (data.totalDecisions < 50) continue;
    // Higher ratio = teacher goes face more often vs this profile
    // Student uses this as: "if board advantage > threshold, go face"
    const faceRatio = data.faceCount / data.totalDecisions;
    // Map to board advantage threshold: high face ratio = lower threshold needed
    attackFaceThreshold[profile] = Math.max(0, Math.round((1 - faceRatio) * 5));
  }

  // Hero power timing
  const heroPowerTiming: Record<string, 'pre' | 'post' | 'always'> = {};
  for (const [heroClass, data] of heroPowerTimingData) {
    if (data.total < 50) continue;
    const preRatio = data.pre / data.total;
    if (preRatio > 0.6) heroPowerTiming[heroClass] = 'pre';
    else if (preRatio < 0.3) heroPowerTiming[heroClass] = 'post';
    else heroPowerTiming[heroClass] = 'always';
  }

  // Merge with existing weights
  const weights = {
    version: 3,
    generatedAt: new Date().toISOString(),
    totalGames: existing.totalGames ?? 0,
    teacherGames: teacherGameCount,
    // Preserve existing v2 fields
    classWinRates: existing.classWinRates ?? {},
    matchupMatrix: existing.matchupMatrix ?? {},
    classProfile: existing.classProfile ?? {},
    classAvgStats: existing.classAvgStats ?? {},
    cardStats: existing.cardStats ?? {},
    // New v3 distilled fields
    cardMatchupBonus,
    cardOnCurveBonus,
    mulliganKeepByMatchup,
    attackFaceThreshold,
    heroPowerTiming,
  };

  return weights;
}

// ── Main ──

async function main() {
  console.log(`\nAI Distillation Pipeline`);
  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}\n`);

  const count = await processDecisions();
  if (count === 0) {
    console.log('No decisions to process. Run teacher simulation first.');
    process.exit(0);
  }

  const weights = buildDistilledWeights(count);

  fs.writeFileSync(outputPath, JSON.stringify(weights, null, 2));

  console.log(`\nDistillation complete:`);
  console.log(`  Card matchup bonuses: ${Object.keys(weights.cardMatchupBonus).length} cards`);
  console.log(`  On-curve bonuses:     ${Object.keys(weights.cardOnCurveBonus).length} cards`);
  console.log(`  Mulligan keep data:   ${Object.keys(weights.mulliganKeepByMatchup).length} cards`);
  console.log(`  Attack thresholds:    ${Object.keys(weights.attackFaceThreshold).length} profiles`);
  console.log(`  Hero power timing:    ${Object.keys(weights.heroPowerTiming).length} classes`);
  console.log(`\nWeights saved to ${outputPath}`);
}

main().catch(err => {
  console.error('Distillation failed:', err);
  process.exit(1);
});
