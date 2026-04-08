/**
 * Neural board evaluator for Miro TCG (Phase 3.3 + Phase 4 expansion).
 *
 * Replaces (or augments) the hand-coded ordinal weights in ai.ts with a
 * learned MLP that takes a flat feature vector of the GameState and
 * predicts the active player's win probability.
 *
 * History
 * -------
 * - **v1 (Phase 3.3, 80-dim)** — initial 5K-param toy. Field names did
 *   NOT match shared/types.ts; the defensive `?? 0` patterns silently
 *   masked the bugs and the extractor returned mostly zeros. Caught
 *   during the Phase 4 audit.
 * - **v2 (Phase 4, 256-dim)** — clean rewrite against the actual types,
 *   richer per-player blocks, Bloom-style hand fingerprint, per-slot
 *   board details, weights file format extended with `featureDim` so the
 *   loader can refuse mismatched weights instead of silently producing
 *   garbage.
 *
 * Layout (FEATURE_DIM = 256)
 * --------------------------
 *   [0..63]    perspective player block (64 dims)
 *   [64..127]  opponent player block    (64 dims, mirror of above)
 *   [128..187] perspective hand fingerprint (60 dims Bloom + 4 dims structured)
 *   [188..217] perspective board per-slot (4 stats × 7 slots = 28 + 2 pad)
 *   [218..239] opponent board per-slot   (3 top threats × 4 + 10 summary)
 *   [240..255] global / phase / matchup (16 dims)
 *
 * All features are normalized to roughly [0, 1] or [-1, 1] so the MLP
 * doesn't need batch norm. Per-card win-rate priors are pulled from
 * data/ai-weights.json at module init when available.
 *
 * Training script: scripts/train_neural_eval.py — must keep its
 * FEATURE_DIM constant in lockstep with this file.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { GameState, BoardMinion, PlayerState, HeroClass, CardInstance } from '../shared/types.js';
import { getCardDef } from './cards.js';

// ── Configuration ──────────────────────────────────────────────────────

/** Total number of features the extractor produces. Must match the input
 * dimension of the trained network in neural-eval-weights.json. */
export const FEATURE_DIM = 256;

/** Schema version stamped into the weights JSON. Bumped whenever the
 * extractor's layout changes. Loader refuses weights with a different
 * version OR a different featureDim. */
export const WEIGHTS_SCHEMA_VERSION = 2;

const HERO_CLASSES: HeroClass[] = ['JIMMY', 'TALA', 'DARK', 'ANDERS', 'DES', 'ASTRID', 'AVA', 'LUCAS', 'IZZY'];

const NEURAL_BLEND = parseFloat(process.env.AI_NEURAL_BLEND ?? '0');

// ── Card win-rate prior (loaded from existing ai-weights.json) ─────────
//
// The existing distillation weights file has per-card stats. We use those
// as a soft prior on minion strength so the neural eval has access to
// "this card historically wins X% of games it's played in" without having
// to relearn that from scratch.
//
// Map: cardCode → winRate (0..1). Defaults to 0.5 for unknown cards.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AI_WEIGHTS_PATH = path.join(__dirname, '..', 'data', 'ai-weights.json');

const cardWinRate = new Map<string, number>();
try {
  if (fs.existsSync(AI_WEIGHTS_PATH)) {
    const raw = JSON.parse(fs.readFileSync(AI_WEIGHTS_PATH, 'utf-8')) as {
      cardStats?: Record<string, { winRate?: number; played?: number }>;
    };
    for (const [code, stats] of Object.entries(raw.cardStats ?? {})) {
      if (stats && typeof stats.winRate === 'number' && (stats.played ?? 0) > 50) {
        cardWinRate.set(code, stats.winRate);
      }
    }
  }
} catch {
  // Best effort — if ai-weights.json is missing or malformed we just
  // fall back to neutral 0.5 priors and the model learns from raw stats.
}

function getCardPrior(cardCode: string): number {
  return cardWinRate.get(cardCode) ?? 0.5;
}

// ── Bloom-style hand fingerprint ───────────────────────────────────────
//
// Hand encoding via the hashing trick: sum a deterministic per-cardCode
// embedding into a fixed-size bucket vector. No learned table needed —
// TS and Python both use the same hash so the dimensions agree without
// any vocabulary file. 60 dims of bloom + 4 structured dims at the end.

const HAND_BLOOM_DIMS = 60;

/** Deterministic 32-bit string hash (FNV-1a). Identical output in TS and
 * Python so the bloom embedding indices line up. */
function hashCode(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Two pseudorandom contributions per card spread across two bloom
 * indices and signed +1/-1, normalized at the call site by hand size. */
function fillHandBloom(features: number[], offset: number, hand: CardInstance[]): void {
  if (hand.length === 0) return;
  for (const card of hand) {
    const code = card.cardCode;
    const h1 = hashCode(code);
    const h2 = hashCode(code + ':2');
    const idx1 = h1 % HAND_BLOOM_DIMS;
    const idx2 = h2 % HAND_BLOOM_DIMS;
    const sign1 = (h1 >> 16) & 1 ? 1 : -1;
    const sign2 = (h2 >> 16) & 1 ? 1 : -1;
    features[offset + idx1] += sign1 / hand.length;
    features[offset + idx2] += sign2 / hand.length;
  }
}

// ── Weights loading ────────────────────────────────────────────────────

interface NeuralWeights {
  /** Schema version. v2 adds the featureDim field and the richer extractor. */
  version: number;
  /** Feature vector dimension this network expects. Must equal FEATURE_DIM. */
  featureDim: number;
  /** Trained-on date in ISO format, for diagnostics. */
  generatedAt: string;
  /** Number of self-play games the model was trained on. */
  trainedGames: number;
  /** Layer weight matrices in input → output order. Variable depth by tier. */
  W: number[][][];
  /** Layer bias vectors in input → output order. */
  b: number[][];
  /**
   * @deprecated v1 trained networks used named W1/W2/W3 fields. The loader
   * normalizes those into the W/b arrays at load time but new training
   * runs should produce the array form.
   */
  W1?: number[][];
  b1?: number[];
  W2?: number[][];
  b2?: number[];
  W3?: number[][];
  b3?: number[];
}

interface LoadedWeights {
  W: number[][][];
  b: number[][];
  meta: { version: number; featureDim: number; generatedAt: string; trainedGames: number };
}

let weights: LoadedWeights | null = null;

function loadWeightsFile(filePath: string): LoadedWeights | null {
  if (!fs.existsSync(filePath)) return null;
  let raw: NeuralWeights;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as NeuralWeights;
  } catch (e) {
    console.warn(`[AI-NEURAL] Failed to parse ${filePath}: ${String(e)}`);
    return null;
  }

  // Normalize legacy v1 format (W1/W2/W3) into the array form.
  if (!raw.W && raw.W1) {
    raw.W = [raw.W1, raw.W2!, raw.W3!];
    raw.b = [raw.b1!, raw.b2!, raw.b3!];
  }

  if (!raw.W || !raw.b) {
    console.warn(`[AI-NEURAL] Weights file at ${filePath} has no W/b arrays — ignoring`);
    return null;
  }

  const inputDim = raw.W[0]?.[0]?.length ?? 0;
  const declaredDim = raw.featureDim ?? inputDim;

  if (inputDim !== FEATURE_DIM || declaredDim !== FEATURE_DIM) {
    console.warn(
      `[AI-NEURAL] Refusing weights from ${filePath}: expected featureDim=${FEATURE_DIM} ` +
        `but file declares ${declaredDim} (matrix input dim ${inputDim}). ` +
        `Retrain with the current scripts/train_neural_eval.py.`
    );
    return null;
  }

  if ((raw.version ?? 1) !== WEIGHTS_SCHEMA_VERSION) {
    console.warn(
      `[AI-NEURAL] Weights version mismatch: expected v${WEIGHTS_SCHEMA_VERSION}, ` +
        `got v${raw.version ?? 1}. Retrain to update.`
    );
    return null;
  }

  return {
    W: raw.W,
    b: raw.b,
    meta: {
      version: raw.version ?? 1,
      featureDim: declaredDim,
      generatedAt: raw.generatedAt ?? 'unknown',
      trainedGames: raw.trainedGames ?? 0,
    },
  };
}

// Default weights path. Override at startup with NEURAL_WEIGHTS_PATH for the
// tournament harness, A/B testing, or any other "swap weights without
// editing files" scenario.
const WEIGHTS_PATH = process.env.NEURAL_WEIGHTS_PATH
  ? path.resolve(process.env.NEURAL_WEIGHTS_PATH)
  : path.join(__dirname, '..', 'data', 'neural-eval-weights.json');
weights = loadWeightsFile(WEIGHTS_PATH);
if (weights) {
  console.log(
    `[AI-NEURAL] Loaded weights v${weights.meta.version} ` +
      `(${weights.meta.trainedGames} games, generated ${weights.meta.generatedAt}, ` +
      `featureDim=${weights.meta.featureDim}, layers=${weights.W.length})`
  );
}

/** Returns true iff the neural evaluator is loaded and ready. Callers
 * should fall back to heuristic evaluation when this returns false. */
export function isNeuralAvailable(): boolean {
  return weights !== null && NEURAL_BLEND > 0;
}

/** Reload weights from disk — used by training loops that swap weights
 * between epochs without restarting the server. */
export function reloadNeuralWeights(): void {
  const fresh = loadWeightsFile(WEIGHTS_PATH);
  if (fresh) {
    weights = fresh;
    console.log('[AI-NEURAL] Reloaded weights');
  }
}

// ── Feature extraction ─────────────────────────────────────────────────

const PERSP_BLOCK_OFFSET = 0;
const OPP_BLOCK_OFFSET = 64;
const HAND_BLOOM_OFFSET = 128;
const HAND_STRUCTURED_OFFSET = HAND_BLOOM_OFFSET + HAND_BLOOM_DIMS; // 188
const PERSP_BOARD_OFFSET = HAND_STRUCTURED_OFFSET + 4; // 192
const OPP_BOARD_OFFSET = PERSP_BOARD_OFFSET + 30; // 222
const GLOBAL_OFFSET = 240;

/**
 * Convert a game state into a flat feature vector that the MLP can consume.
 * Returns a fresh number[] of length FEATURE_DIM. Defensive against
 * partial / mid-mutation states.
 */
export function extractFeatures(state: GameState, perspectivePlayerId: string): number[] {
  const features = new Array<number>(FEATURE_DIM).fill(0);

  const meIdx = state.players[0].playerId === perspectivePlayerId ? 0 : 1;
  const oppIdx = (1 - meIdx) as 0 | 1;
  const me = state.players[meIdx];
  const opp = state.players[oppIdx];
  if (!me || !opp) return features;

  fillPlayerBlock(features, PERSP_BLOCK_OFFSET, me);
  fillPlayerBlock(features, OPP_BLOCK_OFFSET, opp);
  fillHandBloom(features, HAND_BLOOM_OFFSET, me.hand);
  fillHandStructured(features, HAND_STRUCTURED_OFFSET, me.hand, me.mana);
  fillBoardPerSlot(features, PERSP_BOARD_OFFSET, me.board);
  fillBoardSummary(features, OPP_BOARD_OFFSET, opp.board);
  fillGlobalBlock(features, GLOBAL_OFFSET, state, me, opp, meIdx);

  return features;
}

/** 64-dim per-player block. Layout documented inline. */
function fillPlayerBlock(features: number[], offset: number, p: PlayerState): void {
  // 0-13: vital stats
  features[offset + 0]  = clamp01(p.health / 30);
  features[offset + 1]  = clamp01(p.maxHealth / 40);
  features[offset + 2]  = clamp01(p.armor / 30);
  features[offset + 3]  = clamp01(p.mana / 10);
  features[offset + 4]  = clamp01(p.maxMana / 10);
  features[offset + 5]  = clamp01(p.hand.length / 10);
  features[offset + 6]  = clamp01(p.fatigueDamage / 10);
  features[offset + 7]  = clamp01((p.weapon?.currentAttack ?? 0) / 10);
  features[offset + 8]  = clamp01((p.weapon?.durability ?? 0) / 5);
  features[offset + 9]  = clamp01(p.board.length / 7);
  features[offset + 10] = clamp01(sumBoardAttack(p.board) / 50);
  features[offset + 11] = clamp01(sumBoardHealth(p.board) / 50);
  features[offset + 12] = clamp01(maxBoardAttack(p.board) / 15);
  features[offset + 13] = clamp01(maxBoardHealth(p.board) / 15);

  // 14-23: keyword presence + counts
  let taunts = 0, shields = 0, stealths = 0, frozens = 0, lifesteal = 0;
  for (const m of p.board) {
    const def = getCardDef(m.cardCode);
    if (m.isSilenced) continue;
    if (def.keywords.includes('TAUNT')) taunts++;
    if (m.hasDivineShield) shields++;
    if (m.hasStealthUntilAttack) stealths++;
    if (m.isFrozen) frozens++;
    if (def.keywords.includes('LIFESTEAL')) lifesteal++;
  }
  features[offset + 14] = taunts > 0 ? 1 : 0;
  features[offset + 15] = clamp01(taunts / 7);
  features[offset + 16] = shields > 0 ? 1 : 0;
  features[offset + 17] = clamp01(shields / 7);
  features[offset + 18] = stealths > 0 ? 1 : 0;
  features[offset + 19] = clamp01(stealths / 7);
  features[offset + 20] = frozens > 0 ? 1 : 0;
  features[offset + 21] = clamp01(frozens / 7);
  features[offset + 22] = clamp01(lifesteal / 7);

  // 23-29: misc state
  features[offset + 23] = p.heroPowerUsed ? 1 : 0;
  features[offset + 24] = clamp01(p.heroAttackThisTurn / 10);
  features[offset + 25] = clamp01(p.heroAttacksRemaining / 2);
  features[offset + 26] = clamp01(p.graveyard.length / 30);
  features[offset + 27] = clamp01(p.secrets.length / 5);
  features[offset + 28] = clamp01(p.locations.length / 7);
  features[offset + 29] = p.heroPowerUpgraded ? 1 : 0;

  // 30: avg per-card win-rate prior of own board
  if (p.board.length > 0) {
    const sum = p.board.reduce((acc, m) => acc + getCardPrior(m.cardCode), 0);
    features[offset + 30] = clamp01(sum / p.board.length);
  } else {
    features[offset + 30] = 0.5;
  }

  // 31-39: hero class one-hot (9 hero classes)
  const cls = HERO_CLASSES.indexOf(p.heroClass);
  if (cls >= 0 && cls < 9) {
    features[offset + 31 + cls] = 1;
  }

  // 40-63: reserved for future expansion (kept zero so layout stays stable)
}

/** 4 structured hand-aggregate features after the bloom block. */
function fillHandStructured(features: number[], offset: number, hand: CardInstance[], currentMana: number): void {
  if (hand.length === 0) return;
  let costSum = 0;
  let playable = 0;
  let spells = 0;
  let minions = 0;
  for (const c of hand) {
    const def = getCardDef(c.cardCode);
    costSum += def.manaCost;
    if (def.manaCost <= currentMana) playable++;
    if (def.type === 'SPELL') spells++;
    if (def.type === 'MINION') minions++;
  }
  features[offset + 0] = clamp01(costSum / hand.length / 10); // mean cost
  features[offset + 1] = clamp01(playable / hand.length);     // playable now
  features[offset + 2] = clamp01(spells / hand.length);       // spell ratio
  features[offset + 3] = clamp01(minions / hand.length);      // minion ratio
}

/** Per-slot board details for the perspective player: 4 stats × 7 slots. */
function fillBoardPerSlot(features: number[], offset: number, board: BoardMinion[]): void {
  for (let i = 0; i < 7; i++) {
    const m = board[i];
    if (!m) continue;
    const slotOff = offset + i * 4;
    features[slotOff + 0] = clamp01(m.currentAttack / 15);
    features[slotOff + 1] = clamp01(m.currentHealth / 15);
    const def = getCardDef(m.cardCode);
    features[slotOff + 2] = !m.isSilenced && def.keywords.includes('TAUNT') ? 1 : 0;
    features[slotOff + 3] = m.hasDivineShield ? 1 : 0;
  }
}

/** Top-3 opponent threats by attack + 18 dims of summary state. */
function fillBoardSummary(features: number[], offset: number, board: BoardMinion[]): void {
  const sorted = [...board].sort((a, b) => b.currentAttack - a.currentAttack);
  for (let i = 0; i < 3; i++) {
    const m = sorted[i];
    if (!m) continue;
    const slotOff = offset + i * 4;
    features[slotOff + 0] = clamp01(m.currentAttack / 15);
    features[slotOff + 1] = clamp01(m.currentHealth / 15);
    const def = getCardDef(m.cardCode);
    features[slotOff + 2] = !m.isSilenced && def.keywords.includes('TAUNT') ? 1 : 0;
    features[slotOff + 3] = m.hasDivineShield ? 1 : 0;
  }
  // 18 dims of additional opponent board state (kept simple, room to grow)
  features[offset + 12] = clamp01(board.length / 7);
  features[offset + 13] = clamp01(sumBoardAttack(board) / 50);
  features[offset + 14] = clamp01(sumBoardHealth(board) / 50);
  // 15-29 reserved
}

/** Global / phase / matchup features (16 dims at GLOBAL_OFFSET). */
function fillGlobalBlock(
  features: number[],
  offset: number,
  state: GameState,
  me: PlayerState,
  opp: PlayerState,
  meIdx: 0 | 1
): void {
  const turn = state.turnNumber ?? 0;
  features[offset + 0] = clamp01(turn / 30);
  // Phase one-hot: early (turn ≤ 4), mid (5-9), late (10+)
  features[offset + 1] = turn <= 4 ? 1 : 0;
  features[offset + 2] = turn >= 5 && turn <= 9 ? 1 : 0;
  features[offset + 3] = turn >= 10 ? 1 : 0;

  // Asymmetric advantages
  features[offset + 4] = clamp((me.mana - opp.mana) / 10, -1, 1);
  features[offset + 5] = clamp((me.health - opp.health) / 30, -1, 1);
  features[offset + 6] = clamp((me.hand.length - opp.hand.length) / 10, -1, 1);
  features[offset + 7] = clamp((state.decks[meIdx].length - state.decks[1 - meIdx].length) / 30, -1, 1);
  features[offset + 8] = clamp((me.board.length - opp.board.length) / 7, -1, 1);
  features[offset + 9] = clamp((sumBoardAttack(me.board) - sumBoardAttack(opp.board)) / 30, -1, 1);
  features[offset + 10] = clamp((sumBoardHealth(me.board) - sumBoardHealth(opp.board)) / 30, -1, 1);

  // Turn ownership + first-player flag
  features[offset + 11] = state.currentPlayerIndex === meIdx ? 1 : 0;
  features[offset + 12] = meIdx === 0 ? 1 : 0;

  // Weapons
  features[offset + 13] = me.weapon ? 1 : 0;
  features[offset + 14] = opp.weapon ? 1 : 0;
  features[offset + 15] = clamp((me.secrets.length - opp.secrets.length) / 5, -1, 1);
}

// ── Forward pass ───────────────────────────────────────────────────────

/**
 * Run the MLP forward pass on a feature vector. ReLU on every hidden
 * layer, sigmoid on the output. Returns a scalar in [0, 1] interpreted
 * as the perspective player's win probability.
 */
export function neuralForward(features: number[]): number {
  if (!weights) {
    throw new Error('Neural weights not loaded — call isNeuralAvailable() first');
  }
  let h: number[] = features;
  for (let i = 0; i < weights.W.length - 1; i++) {
    h = relu(matVecAdd(weights.W[i], h, weights.b[i]));
  }
  // Final layer: linear, no ReLU. Sigmoid wraps the scalar output.
  const last = weights.W.length - 1;
  const out = matVecAdd(weights.W[last], h, weights.b[last])[0];
  return sigmoid(out);
}

/**
 * Public entry point. Extract features from `state` and run the network.
 * Returns the predicted win probability for `perspectivePlayerId` in
 * [0, 1], or null if neural eval is disabled or weights are missing.
 */
export function neuralEvaluate(
  state: GameState,
  perspectivePlayerId: string
): number | null {
  if (!isNeuralAvailable()) return null;
  const features = extractFeatures(state, perspectivePlayerId);
  return neuralForward(features);
}

/**
 * Blend the neural and heuristic evaluations using AI_NEURAL_BLEND.
 * Returns `heuristicValue` unchanged when neural eval is unavailable so
 * callers can drop this in without conditional branches.
 *
 * `heuristicValue` should already be normalized to roughly [0, 1] for
 * the blend to be meaningful.
 */
export function blendEval(
  state: GameState,
  perspectivePlayerId: string,
  heuristicValue: number
): number {
  const neural = neuralEvaluate(state, perspectivePlayerId);
  if (neural === null) return heuristicValue;
  return heuristicValue * (1 - NEURAL_BLEND) + neural * NEURAL_BLEND;
}

// ── Numerical helpers ──────────────────────────────────────────────────

function relu(v: number[]): number[] {
  const out = new Array<number>(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] > 0 ? v[i] : 0;
  return out;
}

function sigmoid(x: number): number {
  if (x > 30) return 1;
  if (x < -30) return 0;
  return 1 / (1 + Math.exp(-x));
}

function matVecAdd(W: number[][], v: number[], b: number[]): number[] {
  const out = new Array<number>(W.length);
  for (let i = 0; i < W.length; i++) {
    let sum = b[i];
    const row = W[i];
    for (let j = 0; j < row.length; j++) {
      sum += row[j] * v[j];
    }
    out[i] = sum;
  }
  return out;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function clamp01(x: number): number {
  return clamp(x, 0, 1);
}

// ── Board helpers ──────────────────────────────────────────────────────

function sumBoardAttack(board: BoardMinion[]): number {
  let s = 0;
  for (const m of board) s += m.currentAttack;
  return s;
}

function sumBoardHealth(board: BoardMinion[]): number {
  let s = 0;
  for (const m of board) s += m.currentHealth;
  return s;
}

function maxBoardAttack(board: BoardMinion[]): number {
  let m = 0;
  for (const x of board) if (x.currentAttack > m) m = x.currentAttack;
  return m;
}

function maxBoardHealth(board: BoardMinion[]): number {
  let m = 0;
  for (const x of board) if (x.currentHealth > m) m = x.currentHealth;
  return m;
}
