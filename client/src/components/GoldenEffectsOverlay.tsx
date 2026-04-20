/**
 * Layered visual-effect overlay for golden card variants.
 *
 * Renders absolutely-positioned effect layers INSIDE the card art
 * region — the parent container should be `position: relative` and
 * clip overflow. Used by BoardMinionCard, HandCard, and Card's art
 * wrapper. Each layer is driven by CSS custom properties + the
 * rarity prop gates which ones fire, giving progressively richer
 * motion on rarer cards:
 *
 *   COMMON:    shimmer + pulse
 *   RARE:      + particles
 *   EPIC:      + edge lightning
 *   LEGENDARY: + prism wash + glitter
 *
 * `cardCode` seeds the per-particle/per-glitter positions + delays
 * so two minions with the same cardCode have identical motion and
 * different cardCodes animate distinctly.
 */
import React, { useMemo } from 'react';

export type CardRarityForEffects =
  | 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

interface Props {
  cardCode: string;
  rarity: CardRarityForEffects;
  /** When false, renders nothing. Driven by the caller's golden flag. */
  enabled?: boolean;
  /** Per-card animation parameters predicted by the rank-loss MLP
   * (from ClientGameState.animParams[cardCode]). When provided, the
   * overlay uses these to drive color/duration/intensity so every
   * card has motion tied to its learned signature. Missing → fall
   * back to a deterministic cardCode hash. */
  params?: Record<string, number>;
}

// Simple fast hash → 32-bit int, seeded by cardCode.
function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// Deterministic RNG seeded by cardCode. Returns floats in [0, 1).
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function GoldenEffectsOverlay({ cardCode, rarity, enabled = true, params }: Props) {
  const layout = useMemo(() => {
    const rng = mulberry32(hash32(cardCode));

    // Prefer rank-loss MLP predictions for color + rhythm + intensity.
    // Fall back to the cardCode hash when params aren't available (e.g.
    // Collection screen without live game state). Either way every card
    // is per-card distinct.
    const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
    const h = hash32(cardCode);

    // Pulse color — use predicted buff_glow RGB in [0,1], else hash bucket.
    const pulseRgb = (() => {
      if (params && params.buff_glow_r != null) {
        return {
          r: clamp(Math.round(params.buff_glow_r * 255), 120, 255),
          g: clamp(Math.round((params.buff_glow_g ?? 0.75) * 255), 120, 255),
          b: clamp(Math.round((params.buff_glow_b ?? 0.15) * 255), 20, 255),
        };
      }
      const hueRoll = h % 100;
      return hueRoll < 60 ? { r: 251, g: 191, b: 36 }
           : hueRoll < 80 ? { r: 252, g: 211, b: 77 }
           : hueRoll < 90 ? { r: 245, g: 158, b: 11 }
                          : { r: 254, g: 240, b: 138 };
    })();

    // Pulse period — buff_pulse_dur is 0.2-0.8s (transient-scale), remap
    // to a calm 2.8-6s idle loop per card.
    const pulseDur = params?.buff_pulse_dur != null
      ? 2.8 + clamp((params.buff_pulse_dur - 0.2) / 0.6, 0, 1) * 3.2
      : 2.8 + (h % 30) / 10;

    // Pulse intensity — from buff_glow_intensity [0..1], biased gentle.
    const pulseIntensity = params?.buff_glow_intensity != null
      ? clamp(0.4 + params.buff_glow_intensity * 1.0, 0.4, 1.4)
      : 0.8 + (h % 40) / 100;

    // Prism drift — ±color_shift_h is predicted in degrees (-30..30),
    // halve for subtlety.
    const prismMax = params?.color_shift_h != null
      ? Math.max(4, Math.min(18, Math.abs(params.color_shift_h) * 0.5))
      : 6 + (h % 10);
    const prismDur = params?.entrance_duration != null
      ? 7 + params.entrance_duration * 10
      : 7 + (h % 50) / 10;

    // Particles — death_particle_count (0-16) clamped to 3-6 for idle.
    const particleCount = params?.death_particle_count != null
      ? Math.round(clamp(params.death_particle_count / 3, 3, 6))
      : 5;
    const particleSpeed = params?.death_particle_speed != null
      ? 3 + (200 - params.death_particle_speed) / 100
      : 4;
    const particles = Array.from({ length: particleCount }, () => ({
      left: `${8 + rng() * 84}%`,
      dur: particleSpeed + rng() * 2,
      delay: rng() * 3,
    }));

    // Glitter count — death_particle_spread (20-120) → 6-14 sparks.
    const glitterCount = params?.death_particle_spread != null
      ? Math.round(clamp(params.death_particle_spread / 10, 6, 14))
      : 10;
    const glitter = Array.from({ length: glitterCount }, () => ({
      left: `${rng() * 100}%`,
      top: `${rng() * 100}%`,
      dur: 1.2 + rng() * 1.4,
      delay: rng() * 2.2,
    }));

    // Edge-lightning stagger — use attack_shake_intensity (0-15) to
    // offset cycles so no two cards flash in sync.
    const lightningStagger = params?.attack_shake_intensity != null
      ? clamp(params.attack_shake_intensity * 0.3, 0, 4.5)
      : (h % 40) / 10;

    return {
      particles, glitter, pulseRgb, pulseDur, prismMax,
      prismDur, lightningStagger, pulseIntensity,
    };
  }, [cardCode, params]);

  if (!enabled) return null;

  const showParticles = rarity !== 'COMMON';
  const showLightning = rarity === 'EPIC' || rarity === 'LEGENDARY';
  const showPrism = rarity === 'LEGENDARY';
  const showGlitter = rarity === 'LEGENDARY';

  const pulseVars = {
    '--pulse-r': layout.pulseRgb.r,
    '--pulse-g': layout.pulseRgb.g,
    '--pulse-b': layout.pulseRgb.b,
    '--pulse-dur': `${layout.pulseDur}s`,
    '--pulse-intensity': layout.pulseIntensity,
  } as React.CSSProperties;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={pulseVars}>
      {/* Layer 1: radial pulse — baseline glow for every gold card */}
      <div className="gold-pulse" />

      {/* Layer 2: particle drift — RARE and up */}
      {showParticles && layout.particles.map((p, i) => (
        <span
          key={`p${i}`}
          className="gold-particle"
          style={{
            left: p.left,
            bottom: 0,
            ['--p-dur' as string]: `${p.dur}s`,
            ['--p-delay' as string]: `${p.delay}s`,
          } as React.CSSProperties}
        />
      ))}

      {/* Layer 3: edge lightning — EPIC and up */}
      {showLightning && (
        <div
          className="gold-lightning"
          style={{ ['--lightning-stagger' as string]: `${layout.lightningStagger}s` } as React.CSSProperties}
        />
      )}

      {/* Layer 4: prism wash — LEGENDARY only */}
      {showPrism && (
        <div
          className="gold-prism"
          style={{
            ['--prism-max' as string]: `${layout.prismMax}deg`,
            ['--prism-dur' as string]: `${layout.prismDur}s`,
          } as React.CSSProperties}
        />
      )}

      {/* Layer 5: glitter — LEGENDARY only */}
      {showGlitter && layout.glitter.map((g, i) => (
        <span
          key={`g${i}`}
          className="gold-glitter"
          style={{
            left: g.left,
            top: g.top,
            ['--t-dur' as string]: `${g.dur}s`,
            ['--t-delay' as string]: `${g.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
