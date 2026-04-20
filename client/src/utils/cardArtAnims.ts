// Manifest of cardCodes that have an animated WebM loop available at
// /cards/anims/{cardCode}.webm for the golden variant. Produced by
// scripts/animated-art/generate.py (Stable Video Diffusion on M5 MPS);
// populated by scripts/animated-art/refresh_manifest.py after each
// render batch.
//
// When `isGolden` on a card and its cardCode appears here, CardArt
// renders a looping <video> element instead of the static PNG. Missing
// here → fall back to PNG (golden overlay still applies, just no
// motion within the art).
export const CARD_ART_ANIMS = new Set<string>([
  // populated by pipeline
]);
