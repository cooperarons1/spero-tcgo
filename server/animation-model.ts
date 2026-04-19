/**
 * Neural animation parameter predictor for Miro TCG.
 *
 * Loads trained weights from data/animation-weights.json and runs a forward
 * pass to predict animation parameters from card features. The MLP was
 * trained by scripts/animation-model/train.py using Gemma 4 VLM teacher
 * labels.
 *
 * Architecture: FEATURE_DIM → 256 → ReLU → 128 → ReLU → 64 → ReLU → PARAM_DIM → Sigmoid
 *
 * Output is a dict of named animation parameters (durations, scales,
 * particle counts, etc.) that the client applies as CSS custom properties.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { CardDef, HeroClass } from '../shared/types.js';
import { getCardDef } from './cards.js';

// ── Schema constants ──────────────────────────────────────────────────

const CARD_TYPES = ['MINION', 'SPELL', 'WEAPON', 'LOCATION'] as const;
const RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;
const HERO_CLASSES: HeroClass[] = [
  'JIMMY', 'TALA', 'DEREK', 'ANDERS', 'DES',
  'ASTRID', 'AVA', 'LUCAS', 'IZZY',
];
const HERO_CLASSES_WITH_NEUTRAL = [...HERO_CLASSES, 'NEUTRAL'] as const;
const KEYWORDS = [
  'TAUNT', 'CHARGE', 'DIVINE_SHIELD', 'BATTLECRY', 'DEATHRATTLE',
  'FREEZE', 'WINDFURY', 'STEALTH', 'SECRET', 'COMBO', 'BOND', 'COLLAR',
] as const;
const EFFECT_TYPES = [
  'DEAL_DAMAGE', 'DEAL_DAMAGE_ALL_ENEMIES', 'DEAL_DAMAGE_ALL_MINIONS',
  'RESTORE_HEALTH', 'DRAW_CARDS', 'BUFF_MINION', 'BUFF_ALL_FRIENDLY',
  'BUFF_ALL_FRIENDLY_MINIONS', 'SUMMON_MINION', 'DESTROY_MINION',
  'FREEZE_TARGET', 'GRANT_KEYWORD', 'GAIN_ARMOR_AND_DRAW',
  'GAIN_TEMPORARY_MANA', 'RETURN_TO_HAND', 'SILENCE_TARGET',
  'STEAL_MINION', 'SPELL_DISCOUNT', 'DESTROY_FROZEN_MINION',
  'DEAL_DAMAGE_BASED_ON_ARMOR',
] as const;
const ANIM_CONTEXTS = [
  'entrance', 'attack', 'death', 'spell',
  'damage', 'buff', 'draw', 'idle',
] as const;

type AnimContext = typeof ANIM_CONTEXTS[number];

// FEATURE_DIM = 4 + 4 + 10 + 3 + 12 + 20 + 8 = 61
const FEATURE_DIM = CARD_TYPES.length + RARITIES.length + HERO_CLASSES_WITH_NEUTRAL.length
  + 3 + KEYWORDS.length + EFFECT_TYPES.length + ANIM_CONTEXTS.length;

// ── Animation parameter definitions ──────────────────────────────────

interface ParamDef {
  name: string;
  min: number;
  max: number;
  default: number;
}

const PARAM_DEFS: ParamDef[] = [
  // Entrance
  { name: 'entrance_duration', min: 0.15, max: 0.80, default: 0.35 },
  { name: 'entrance_scale_from', min: 0.00, max: 0.80, default: 0.30 },
  { name: 'entrance_scale_to', min: 0.90, max: 1.20, default: 1.00 },
  { name: 'entrance_opacity_from', min: 0.00, max: 0.50, default: 0.00 },
  { name: 'entrance_translate_y', min: -60, max: 60, default: 30 },
  { name: 'entrance_overshoot', min: 0.00, max: 0.30, default: 0.05 },
  // Attack
  { name: 'attack_lunge_dist', min: 10, max: 80, default: 40 },
  { name: 'attack_lunge_dur', min: 0.10, max: 0.50, default: 0.30 },
  { name: 'attack_recoil_dur', min: 0.10, max: 0.40, default: 0.20 },
  { name: 'attack_shake_intensity', min: 0, max: 15, default: 5 },
  // Death
  { name: 'death_fade_dur', min: 0.20, max: 0.80, default: 0.50 },
  { name: 'death_scale_to', min: 0.00, max: 0.50, default: 0.00 },
  { name: 'death_particle_count', min: 0, max: 16, default: 8 },
  { name: 'death_particle_spread', min: 20, max: 120, default: 60 },
  { name: 'death_particle_speed', min: 40, max: 200, default: 100 },
  // Spell
  { name: 'spell_proj_dur', min: 0.15, max: 0.60, default: 0.40 },
  { name: 'spell_proj_arc', min: -40, max: 40, default: 0 },
  { name: 'spell_impact_scale', min: 0.80, max: 2.00, default: 1.20 },
  { name: 'spell_impact_dur', min: 0.10, max: 0.50, default: 0.30 },
  { name: 'spell_impact_brightness', min: 0.5, max: 2.0, default: 1.50 },
  // Damage
  { name: 'dmg_flash_dur', min: 0.10, max: 0.60, default: 0.30 },
  { name: 'dmg_flash_r', min: 0.50, max: 1.00, default: 1.00 },
  { name: 'dmg_flash_g', min: 0.00, max: 0.50, default: 0.10 },
  { name: 'dmg_flash_b', min: 0.00, max: 0.50, default: 0.10 },
  { name: 'dmg_shake_amp', min: 0, max: 12, default: 4 },
  // Buff
  { name: 'buff_pulse_scale', min: 1.00, max: 1.40, default: 1.15 },
  { name: 'buff_pulse_dur', min: 0.20, max: 0.80, default: 0.40 },
  { name: 'buff_glow_intensity', min: 0.00, max: 1.00, default: 0.60 },
  { name: 'buff_glow_r', min: 0.00, max: 1.00, default: 0.30 },
  { name: 'buff_glow_g', min: 0.00, max: 1.00, default: 0.90 },
  { name: 'buff_glow_b', min: 0.00, max: 1.00, default: 0.30 },
  // Draw
  { name: 'draw_slide_dur', min: 0.20, max: 0.70, default: 0.50 },
  { name: 'draw_slide_dist', min: 50, max: 200, default: 120 },
  { name: 'draw_flip_dur', min: 0.15, max: 0.50, default: 0.30 },
  // General
  { name: 'delay_offset', min: 0.00, max: 0.30, default: 0.00 },
  { name: 'color_shift_h', min: -30, max: 30, default: 0 },
  { name: 'color_shift_s', min: -0.3, max: 0.3, default: 0 },
  { name: 'color_shift_l', min: -0.2, max: 0.2, default: 0 },
];

const PARAM_DIM = PARAM_DEFS.length;

export type AnimationParams = Record<string, number>;

// ── Weights loading ──────────────────────────────────────────────────

interface AnimWeightsFile {
  version: number;
  featureDim: number;
  outputDim: number;
  paramNames: string[];
  W: number[][][];
  b: number[][];
}

interface LoadedAnimWeights {
  W: number[][][];
  b: number[][];
  paramNames: string[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEIGHTS_PATH = path.join(__dirname, '..', 'data', 'animation-weights.json');

let animWeights: LoadedAnimWeights | null = null;

function loadAnimWeights(): LoadedAnimWeights | null {
  if (!fs.existsSync(WEIGHTS_PATH)) {
    console.log('[ANIM-MODEL] No weights file found at', WEIGHTS_PATH);
    return null;
  }

  let raw: AnimWeightsFile;
  try {
    raw = JSON.parse(fs.readFileSync(WEIGHTS_PATH, 'utf-8'));
  } catch (e) {
    console.warn('[ANIM-MODEL] Failed to parse weights:', e);
    return null;
  }

  if (!raw.W || !raw.b) {
    console.warn('[ANIM-MODEL] Weights file missing W/b arrays');
    return null;
  }

  const inputDim = raw.W[0]?.[0]?.length ?? 0;
  if (inputDim !== FEATURE_DIM) {
    console.warn(
      `[ANIM-MODEL] Feature dim mismatch: expected ${FEATURE_DIM}, got ${inputDim}. Retrain.`
    );
    return null;
  }

  console.log(
    `[ANIM-MODEL] Loaded animation weights: ${raw.W.length} layers, ` +
    `${inputDim}→${raw.W[raw.W.length - 1].length} dims`
  );

  return { W: raw.W, b: raw.b, paramNames: raw.paramNames ?? PARAM_DEFS.map(p => p.name) };
}

// Try to load on module init
animWeights = loadAnimWeights();

export function isAnimModelAvailable(): boolean {
  return animWeights !== null;
}

// ── Feature extraction ───────────────────────────────────────────────

function oneHot(value: string, options: readonly string[]): number[] {
  return options.map(o => o === value ? 1 : 0);
}

function multiHot(values: string[], options: readonly string[]): number[] {
  const set = new Set(values);
  return options.map(o => set.has(o) ? 1 : 0);
}

function getEffectTypes(card: any): string[] {
  const types: string[] = [];
  for (const key of ['spellEffect', 'battlecry', 'deathrattle', 'heropower']) {
    const e = card[key];
    if (!e) continue;
    if (Array.isArray(e)) {
      for (const x of e) if (x?.type) types.push(x.type);
    } else if (e.type) {
      types.push(e.type);
    }
  }
  return types;
}

function extractAnimFeatures(cardCode: string, context: AnimContext): number[] {
  const card = getCardDef(cardCode) as any;
  const features: number[] = [];

  features.push(...oneHot(card.type ?? 'MINION', CARD_TYPES));
  features.push(...oneHot(card.rarity ?? 'COMMON', RARITIES));
  features.push(...oneHot(card.heroClass ?? 'NEUTRAL', HERO_CLASSES_WITH_NEUTRAL));

  features.push(Math.min((card.manaCost ?? 0) / 10, 1));
  features.push(Math.min((card.attack ?? 0) / 12, 1));
  features.push(Math.min((card.health ?? 0) / 12, 1));

  features.push(...multiHot(card.keywords ?? [], KEYWORDS));
  features.push(...multiHot(getEffectTypes(card), EFFECT_TYPES));
  features.push(...oneHot(context, ANIM_CONTEXTS));

  return features;
}

// ── Forward pass ─────────────────────────────────────────────────────

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

function relu(v: number[]): number[] {
  const out = new Array<number>(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] > 0 ? v[i] : 0;
  return out;
}

function sigmoidVec(v: number[]): number[] {
  return v.map(x => {
    if (x > 30) return 1;
    if (x < -30) return 0;
    return 1 / (1 + Math.exp(-x));
  });
}

function animForward(features: number[]): number[] {
  if (!animWeights) throw new Error('Animation weights not loaded');

  let h = features;
  const numLayers = animWeights.W.length;

  for (let i = 0; i < numLayers - 1; i++) {
    h = relu(matVecAdd(animWeights.W[i], h, animWeights.b[i]));
  }

  // Final layer with sigmoid (output in [0, 1])
  const last = numLayers - 1;
  h = sigmoidVec(matVecAdd(animWeights.W[last], h, animWeights.b[last]));

  return h;
}

// ── Denormalization ──────────────────────────────────────────────────

function denormalize(normalized: number[]): AnimationParams {
  const params: AnimationParams = {};
  for (let i = 0; i < PARAM_DEFS.length && i < normalized.length; i++) {
    const def = PARAM_DEFS[i];
    params[def.name] = def.min + normalized[i] * (def.max - def.min);
  }
  return params;
}

// ── Public API ───────────────────────────────────────────────────────

// Forward-pass output is deterministic for a given (cardCode, context),
// so we memoize across broadcasts. A match touches <100 unique cardCodes;
// ~8 contexts each → cache stays small (<1k entries) for a whole session.
const animParamsCache = new Map<string, AnimationParams>();

/**
 * Get predicted animation parameters for a card + animation context.
 * Returns null if the model is not available.
 */
export function getAnimationParams(
  cardCode: string,
  context: AnimContext,
): AnimationParams | null {
  if (!animWeights) return null;
  const key = `${cardCode}|${context}`;
  const cached = animParamsCache.get(key);
  if (cached) return cached;

  try {
    const features = extractAnimFeatures(cardCode, context);
    const normalized = animForward(features);
    const params = denormalize(normalized);
    animParamsCache.set(key, params);
    return params;
  } catch {
    return null;
  }
}

// Maps an animation context to the PARAM_DEFS prefixes owned by that
// context. We query the MLP once per relevant context and only take the
// params that belong to it — attack_* from 'attack' pass, death_* from
// 'death' pass, etc. Without this, every param would be biased toward
// the one context used as the input one-hot.
const CONTEXT_PARAM_PREFIXES: Record<AnimContext, readonly string[]> = {
  entrance: ['entrance_'],
  attack: ['attack_'],
  death: ['death_'],
  spell: ['spell_'],
  damage: ['dmg_'],
  buff: ['buff_'],
  draw: ['draw_'],
  // Non-context-specific params (card-level tint + timing) ride on 'idle'.
  idle: ['delay_offset', 'color_shift_'],
};

function contextsForCardType(type: string | undefined): AnimContext[] {
  switch (type) {
    case 'MINION':
      return ['entrance', 'attack', 'death', 'damage', 'buff', 'draw', 'idle'];
    case 'SPELL':
      return ['spell', 'damage', 'draw', 'idle'];
    case 'WEAPON':
      return ['entrance', 'attack', 'draw', 'idle'];
    case 'LOCATION':
      return ['entrance', 'draw', 'idle'];
    default:
      return ['entrance', 'draw', 'idle'];
  }
}

/**
 * Merged animation params for a card across every context relevant to
 * its type. Each context's forward pass contributes only the params it
 * owns (attack_* from 'attack' pass, etc.), so the returned flat map is
 * what the client needs to drive every animation that card can take
 * part in. Returns null if the model isn't loaded or the card is
 * unknown.
 */
export function getCardAnimParams(cardCode: string): AnimationParams | null {
  if (!animWeights) return null;
  let card: any;
  try {
    card = getCardDef(cardCode);
  } catch {
    // Unknown cardCode — getCardDef throws instead of returning null.
    // Graceful degrade so a stale cardCode in game state doesn't kill
    // the broadcast.
    return null;
  }
  if (!card) return null;

  const merged: AnimationParams = {};
  for (const ctx of contextsForCardType(card.type)) {
    const p = getAnimationParams(cardCode, ctx);
    if (!p) continue;
    const prefixes = CONTEXT_PARAM_PREFIXES[ctx];
    for (const [name, val] of Object.entries(p)) {
      for (const pre of prefixes) {
        if (name === pre || name.startsWith(pre)) {
          merged[name] = val;
          break;
        }
      }
    }
  }
  return Object.keys(merged).length > 0 ? merged : null;
}

/**
 * Get default animation parameters (no model needed).
 */
export function getDefaultAnimParams(): AnimationParams {
  const params: AnimationParams = {};
  for (const def of PARAM_DEFS) {
    params[def.name] = def.default;
  }
  return params;
}
