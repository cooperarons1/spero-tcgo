/**
 * Pack Opening System — Miro TCG
 *
 * Pack rules (modeled after Hearthstone):
 * - 5 cards per pack
 * - Guaranteed at least 1 rare or better
 * - Pity timer: legendary guaranteed within 40 packs
 * - Epic pity timer: guaranteed within 10 packs
 * - No duplicate legendaries (can't open one you already own)
 * - Pack cost: 100 gold
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { CardDef, HeroClass } from '../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const allCards: CardDef[] = JSON.parse(readFileSync(path.join(__dirname, '..', 'data', 'cards.json'), 'utf-8'));

// Filter out tokens, coin, and secrets from packs (non-collectible)
const packCards = allCards.filter(c => {
  if (c.cardCode === 'COIN') return false;
  if (c.cardCode.includes('_TOKEN_')) return false;
  // Secrets are collectible — keep them
  return true;
});

const cardsByRarity = {
  COMMON: packCards.filter(c => c.rarity === 'COMMON'),
  RARE: packCards.filter(c => c.rarity === 'RARE'),
  EPIC: packCards.filter(c => c.rarity === 'EPIC'),
  LEGENDARY: packCards.filter(c => c.rarity === 'LEGENDARY'),
};

export const PACK_COST = 100; // gold
export const CARDS_PER_PACK = 5;

// Pity timers (packs since last)
export const LEGENDARY_PITY = 40;
export const EPIC_PITY = 10;

// Drop rates (Hearthstone-like)
// Each card slot: ~70% common, ~20% rare, ~5% epic, ~1% legendary
// But at least 1 rare guaranteed
function rollRarity(packsSinceLegendary: number, packsSinceEpic: number, isGuaranteedRareSlot: boolean): 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' {
  // Pity timer overrides
  if (packsSinceLegendary >= LEGENDARY_PITY - 1) return 'LEGENDARY';
  if (packsSinceEpic >= EPIC_PITY - 1) return 'EPIC';

  if (isGuaranteedRareSlot) {
    // This slot is at least rare
    const roll = Math.random();
    if (roll < 0.05) return 'LEGENDARY';
    if (roll < 0.20) return 'EPIC';
    return 'RARE';
  }

  const roll = Math.random();
  if (roll < 0.01) return 'LEGENDARY';
  if (roll < 0.05) return 'EPIC';
  if (roll < 0.23) return 'RARE';
  return 'COMMON';
}

export interface PackResult {
  cards: { cardCode: string; rarity: string; isNew: boolean }[];
  packsSinceLegendary: number;
  packsSinceEpic: number;
}

export function openPack(
  ownedCards: Record<string, number>,
  packsSinceLegendary: number,
  packsSinceEpic: number,
): PackResult {
  const result: { cardCode: string; rarity: string; isNew: boolean }[] = [];
  let gotRareOrBetter = false;
  let gotLegendary = false;
  let gotEpic = false;

  for (let i = 0; i < CARDS_PER_PACK; i++) {
    const isLastSlot = i === CARDS_PER_PACK - 1;
    const needsRare = isLastSlot && !gotRareOrBetter;

    const rarity = rollRarity(
      gotLegendary ? 0 : packsSinceLegendary,
      gotEpic ? 0 : packsSinceEpic,
      needsRare,
    );

    if (rarity === 'LEGENDARY') gotLegendary = true;
    if (rarity === 'EPIC') gotEpic = true;
    if (rarity !== 'COMMON') gotRareOrBetter = true;

    // Pick a card of this rarity
    let pool = cardsByRarity[rarity];

    // No duplicate legendaries — filter out owned ones
    if (rarity === 'LEGENDARY') {
      const unowned = pool.filter(c => (ownedCards[c.cardCode] ?? 0) === 0);
      if (unowned.length > 0) {
        pool = unowned;
      }
      // If all legendaries owned, allow duplicates (they'll convert to dust)
    }

    const card = pool[Math.floor(Math.random() * pool.length)];
    const currentOwned = ownedCards[card.cardCode] ?? 0;
    const maxCopies = rarity === 'LEGENDARY' ? 1 : 2;
    const isNew = currentOwned < maxCopies;

    result.push({
      cardCode: card.cardCode,
      rarity: card.rarity,
      isNew,
    });
  }

  return {
    cards: result,
    packsSinceLegendary: gotLegendary ? 0 : packsSinceLegendary + 1,
    packsSinceEpic: gotEpic ? 0 : packsSinceEpic + 1,
  };
}

// Dust values for disenchanting extras
export const DUST_VALUES: Record<string, number> = {
  COMMON: 5,
  RARE: 20,
  EPIC: 100,
  LEGENDARY: 400,
};

export const CRAFT_COSTS: Record<string, number> = {
  COMMON: 40,
  RARE: 100,
  EPIC: 400,
  LEGENDARY: 1600,
};
