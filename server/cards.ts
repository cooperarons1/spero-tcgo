import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { CardDef, HeroClass } from '../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const raw = JSON.parse(readFileSync(path.join(__dirname, '..', 'data', 'cards.json'), 'utf-8'));

const cardDefs: Map<string, CardDef> = new Map();
for (const c of raw) {
  cardDefs.set(c.cardCode, c as CardDef);
}

export function getCardDef(cardCode: string): CardDef {
  const def = cardDefs.get(cardCode);
  if (!def) throw new Error(`Unknown cardCode: ${cardCode}`);
  return def;
}

export function getAllCardDefs(): CardDef[] {
  return Array.from(cardDefs.values());
}

export function getCardsByClass(heroClass: HeroClass): CardDef[] {
  return getAllCardDefs().filter((c) => c.heroClass === heroClass);
}

export function getCardsByClassAndNeutral(heroClass: HeroClass): CardDef[] {
  return getAllCardDefs().filter(
    (c) => c.heroClass === heroClass || c.heroClass === 'NEUTRAL'
  );
}

// Every player gets the full collection on signup — shop + pack
// opening are shelved, so the only purpose of `ownedCards` now is
// deckbuilding eligibility. 2 copies of every non-legendary,
// 1 of every legendary; tokens and COIN are excluded (they're never
// deckbuild-eligible).
export function buildFullCollection(): Record<string, number> {
  const owned: Record<string, number> = {};
  for (const c of cardDefs.values()) {
    if (c.cardCode === 'COIN' || c.cardCode.includes('_TOKEN_')) continue;
    owned[c.cardCode] = c.rarity === 'LEGENDARY' ? 1 : 2;
  }
  return owned;
}
