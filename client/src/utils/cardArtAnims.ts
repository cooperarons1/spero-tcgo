// cardCodes listed here have /cards/anims/{cardCode}.webm available.
// CardArt renders the WebM loop in golden mode when this Set contains
// the cardCode; otherwise the static PNG is used (gold overlay still
// applies — just no motion within the art).
// Rebuilt 2026-04-24 from `ls client/public/cards/anims/*.webm`.
export const CARD_ART_ANIMS = new Set<string>([
  "AST021",   // Calculated Force — arcane burst spell
  "AVA021",   // Abram — paladin tank
  "DRK032",   // Prema — druid taunt DR
  "JIM022",   // Arrow Rush — hunter spell
  "NEU_LOC03", // Aster Peak Observatory — location
]);
