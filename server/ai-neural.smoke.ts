/**
 * Smoke test for ai-neural.ts feature extraction.
 *
 * Run: `npx tsx server/ai-neural.smoke.ts`
 *
 * Catches the kind of bug that bit us in v1: silent NaN/zero output
 * because field names didn't match shared/types.ts. With this script
 * passing, the trainer in scripts/train_neural_eval.py can trust that
 * the JSONL it ingests has well-formed feature vectors of the right
 * length and dtype.
 */

import { createGame } from './game.js';
import { extractFeatures, FEATURE_DIM } from './ai-neural.js';

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log(`\nai-neural smoke test (FEATURE_DIM=${FEATURE_DIM})\n`);

// Build a minimal real game so the extractor runs against actual types,
// not a hand-rolled mock that could mask field-name mismatches.
const game = createGame([
  { id: 'p1', name: 'Alice', heroClass: 'JIMMY' },
  { id: 'p2', name: 'Bob',   heroClass: 'TALA' },
]);

const featuresMe = extractFeatures(game, 'p1');

check(`length === ${FEATURE_DIM}`, featuresMe.length === FEATURE_DIM, `got ${featuresMe.length}`);

const allFinite = featuresMe.every((x) => Number.isFinite(x));
check('all values finite (no NaN/Infinity)', allFinite,
  allFinite ? '' : `first NaN at index ${featuresMe.findIndex((x) => !Number.isFinite(x))}`);

const inRange = featuresMe.every((x) => x >= -1.001 && x <= 1.001);
check('all values in [-1, 1]', inRange);

// Sanity: starting state should have some non-zero features (life, mana, etc.)
const nonZero = featuresMe.filter((x) => x !== 0).length;
check('at least 10 non-zero features at game start', nonZero >= 10, `got ${nonZero} non-zero`);

// Perspective check: features for p2 should differ from p1 (they're symmetric
// but not identical because of the hero class one-hot and active player flag).
const featuresOpp = extractFeatures(game, 'p2');
check(`length matches between perspectives`, featuresOpp.length === FEATURE_DIM);
const differ = featuresMe.some((v, i) => v !== featuresOpp[i]);
check('p1 and p2 perspectives produce different vectors', differ);

// Hero class one-hot should be set somewhere in the per-player block.
// JIMMY is index 0 in HERO_CLASSES, so feature[31] (offset 0 + 31) should be 1.
check('JIMMY hero one-hot lit at expected index for p1', featuresMe[31] === 1,
  `got ${featuresMe[31]}`);

// Player block sanity: starting health = 30/30 → 1.0 at offset 0
check('starting health normalized to 1.0', featuresMe[0] === 1, `got ${featuresMe[0]}`);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
