import type { CardDef, HeroClass } from './types.js';

export const DECK_SIZE = 30;
export const MAX_COPIES_PER_CARD = 2;
export const MAX_COPIES_LEGENDARY = 1;

export interface DeckValidationResult {
  valid: boolean;
  errors: string[];
  cardCount: number;
  manaCurve: Record<number, number>;
}

export function validateDeck(
  cardCodes: string[],
  heroClass: HeroClass,
  getCardDef: (code: string) => CardDef | undefined
): DeckValidationResult {
  const errors: string[] = [];
  const manaCurve: Record<number, number> = {};
  const codeCounts = new Map<string, number>();

  for (const code of cardCodes) {
    codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
    const def = getCardDef(code);
    if (!def) {
      errors.push(`Unknown card code: ${code}`);
      continue;
    }
    // Class restriction: can only include cards from your class or NEUTRAL
    if (def.heroClass !== 'NEUTRAL' && def.heroClass !== heroClass) {
      errors.push(`${def.name} is a ${def.heroClass} card, not usable by ${heroClass}`);
    }
    const bucket = Math.min(def.manaCost, 10);
    manaCurve[bucket] = (manaCurve[bucket] || 0) + 1;
  }

  if (cardCodes.length !== DECK_SIZE) {
    errors.push(`Deck must have exactly ${DECK_SIZE} cards (has ${cardCodes.length})`);
  }

  for (const [code, count] of codeCounts) {
    const def = getCardDef(code);
    const maxCopies = def?.rarity === 'LEGENDARY' ? MAX_COPIES_LEGENDARY : MAX_COPIES_PER_CARD;
    if (count > maxCopies) {
      errors.push(`${def?.name ?? code}: max ${maxCopies} copies (has ${count})`);
    }
  }

  // No Coin in constructed decks
  if (codeCounts.has('COIN')) {
    errors.push('The Coin cannot be included in a deck');
  }

  return {
    valid: errors.length === 0,
    errors,
    cardCount: cardCodes.length,
    manaCurve,
  };
}
