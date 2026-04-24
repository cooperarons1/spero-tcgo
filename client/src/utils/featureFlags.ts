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
  /** Render golden card variants (gold frame, shimmer, overlay effects).
   * Re-enabled 2026-04-24 for per-card testing — 5 WebM loops exist
   * (AST021, AVA021, DRK032, JIM022, NEU_LOC03); every other card
   * falls through to the static shimmer sweep in Card.tsx. */
  GOLDEN_CARDS: true,
  /** Render golden hero portraits + hero-power animations. */
  GOLDEN_HEROES: true,
  /** Show golden tiles in the Collection grid (x2 per card pair).
   * Off again 2026-04-24 — pause golden work for now; the in-game
   * golden render + WebM testing can stay available via GOLDEN_CARDS,
   * but the Collection grid doesn't need to double the tile count. */
  COLLECTION_GOLDEN_TILES: false,
  /** Show dust currency + craft/disenchant UI. Shelved 2026-04-24 along
   * with SHOP_AND_PACKS — everyone gets the full collection on signup,
   * so crafting is moot. Handlers stay intact. */
  DUST: false,
  /** Show battle pass button + reward panel rows. */
  BATTLEPASS: false,
  /** Show Shop + Open Packs buttons. Shelved 2026-04-24 — every user
   * gets the full collection on signup (see buildFullCollection in
   * server/cards.ts), so the economy loop is off for now. Handlers +
   * backend routes intact; flip to true to reintroduce the economy. */
  SHOP_AND_PACKS: false,
  /** Mouse-parallax tilt on layered card art — shelved; kept as a flag
   * so the tilt math + handlers stay in tree and can be toggled back
   * on without a refactor. */
  CARD_MOUSE_TILT: false,
  /** Layered parallax (breathe + pan + fg/bg split) — shelved. When off,
   * CardArt renders the flat PNG and the layer files are never loaded. */
  CARD_LAYERED_PARALLAX: false,
} as const;
