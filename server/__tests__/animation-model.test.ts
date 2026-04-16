import { describe, it, expect } from 'vitest';
import {
  getAnimationParams,
  getDefaultAnimParams,
  isAnimModelAvailable,
} from '../animation-model.js';

// The 38 param names are a contract with the client (GameBoard.tsx maps
// each to a CSS custom property). If this list drifts, renames land as a
// test failure instead of a silent fallback at runtime.
const EXPECTED_PARAM_NAMES = [
  'entrance_duration', 'entrance_scale_from', 'entrance_scale_to',
  'entrance_opacity_from', 'entrance_translate_y', 'entrance_overshoot',
  'attack_lunge_dist', 'attack_lunge_dur', 'attack_recoil_dur', 'attack_shake_intensity',
  'death_fade_dur', 'death_scale_to', 'death_particle_count',
  'death_particle_spread', 'death_particle_speed',
  'spell_proj_dur', 'spell_proj_arc', 'spell_impact_scale',
  'spell_impact_dur', 'spell_impact_brightness',
  'dmg_flash_dur', 'dmg_flash_r', 'dmg_flash_g', 'dmg_flash_b', 'dmg_shake_amp',
  'buff_pulse_scale', 'buff_pulse_dur', 'buff_glow_intensity',
  'buff_glow_r', 'buff_glow_g', 'buff_glow_b',
  'draw_slide_dur', 'draw_slide_dist', 'draw_flip_dur',
  'delay_offset', 'color_shift_h', 'color_shift_s', 'color_shift_l',
];

// Bounds derived from PARAM_DEFS in animation-model.ts. Kept as a static
// table so the test catches accidental range widening/narrowing too.
const PARAM_BOUNDS: Record<string, [number, number]> = {
  entrance_duration: [0.15, 0.80], entrance_scale_from: [0.00, 0.80],
  entrance_scale_to: [0.90, 1.20], entrance_opacity_from: [0.00, 0.50],
  entrance_translate_y: [-60, 60], entrance_overshoot: [0.00, 0.30],
  attack_lunge_dist: [10, 80], attack_lunge_dur: [0.10, 0.50],
  attack_recoil_dur: [0.10, 0.40], attack_shake_intensity: [0, 15],
  death_fade_dur: [0.20, 0.80], death_scale_to: [0.00, 0.50],
  death_particle_count: [0, 16], death_particle_spread: [20, 120],
  death_particle_speed: [40, 200],
  spell_proj_dur: [0.15, 0.60], spell_proj_arc: [-40, 40],
  spell_impact_scale: [0.80, 2.00], spell_impact_dur: [0.10, 0.50],
  spell_impact_brightness: [0.5, 2.0],
  dmg_flash_dur: [0.10, 0.60], dmg_flash_r: [0.50, 1.00],
  dmg_flash_g: [0.00, 0.50], dmg_flash_b: [0.00, 0.50], dmg_shake_amp: [0, 12],
  buff_pulse_scale: [1.00, 1.40], buff_pulse_dur: [0.20, 0.80],
  buff_glow_intensity: [0.00, 1.00], buff_glow_r: [0.00, 1.00],
  buff_glow_g: [0.00, 1.00], buff_glow_b: [0.00, 1.00],
  draw_slide_dur: [0.20, 0.70], draw_slide_dist: [50, 200],
  draw_flip_dur: [0.15, 0.50],
  delay_offset: [0.00, 0.30], color_shift_h: [-30, 30],
  color_shift_s: [-0.3, 0.3], color_shift_l: [-0.2, 0.2],
};

describe('getDefaultAnimParams', () => {
  it('returns all 38 expected params', () => {
    const p = getDefaultAnimParams();
    expect(Object.keys(p).sort()).toEqual([...EXPECTED_PARAM_NAMES].sort());
  });

  it('every default is inside its declared [min, max] range', () => {
    const p = getDefaultAnimParams();
    for (const [name, [min, max]] of Object.entries(PARAM_BOUNDS)) {
      expect(p[name], `${name} below min`).toBeGreaterThanOrEqual(min);
      expect(p[name], `${name} above max`).toBeLessThanOrEqual(max);
    }
  });

  it('every value is a finite number', () => {
    const p = getDefaultAnimParams();
    for (const [name, v] of Object.entries(p)) {
      expect(Number.isFinite(v), `${name} not finite`).toBe(true);
    }
  });
});

// No trained weights file ships with the repo — these tests lock in the
// graceful-degradation path so a regression (throw instead of null) lands
// here rather than crashing broadcastGameState() in production.
describe('animation-model without trained weights', () => {
  it('isAnimModelAvailable returns false', () => {
    expect(isAnimModelAvailable()).toBe(false);
  });

  it('getAnimationParams returns null for any card / context', () => {
    expect(getAnimationParams('NEU001', 'entrance')).toBeNull();
    expect(getAnimationParams('NEU001', 'attack')).toBeNull();
    expect(getAnimationParams('DOES_NOT_EXIST', 'entrance')).toBeNull();
  });
});
