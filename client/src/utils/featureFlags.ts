/**
 * Feature flags for shelved / WIP UI surfaces.
 *
 * Golden cards + golden heroes were shipped but are being taken out
 * of the visible UI while the "real" animation approach is designed
 * as a side project. The data layer (isGolden on CardInstance,
 * rankedWins tracking, ownedGolden inventory) stays intact so no
 * progress is lost when they return — this file just gates the
 * rendering.
 */

export const FEATURE_FLAGS = {
  /** Render golden card variants (gold frame, shimmer, overlay effects). */
  GOLDEN_CARDS: false,
  /** Render golden hero portraits + hero-power animations. */
  GOLDEN_HEROES: false,
  /** Show golden tiles in the Collection grid (x2 per card pair). */
  COLLECTION_GOLDEN_TILES: false,
} as const;
