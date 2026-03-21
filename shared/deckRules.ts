export const DECK_SIZE = 60;
export const MAX_COPIES_PER_CARD = 4;

export interface DeckValidationResult {
  valid: boolean;
  errors: string[];
  cardCount: number;
  colorBreakdown: Record<string, number>;
}

export function validateDeck(
  cardCodes: string[],
  getCardDef: (code: string) => { typeA: string; color: string; name: string } | undefined
): DeckValidationResult {
  const errors: string[] = [];
  const colorBreakdown: Record<string, number> = {};
  const codeCounts = new Map<string, number>();
  let hasCharacter = false;

  for (const code of cardCodes) {
    codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
    const def = getCardDef(code);
    if (!def) {
      errors.push(`Unknown card code: ${code}`);
      continue;
    }
    colorBreakdown[def.color] = (colorBreakdown[def.color] || 0) + 1;
    if (def.typeA === 'CHARACTER') hasCharacter = true;
  }

  if (cardCodes.length !== DECK_SIZE) {
    errors.push(`Deck must have exactly ${DECK_SIZE} cards (has ${cardCodes.length})`);
  }

  for (const [code, count] of codeCounts) {
    if (count > MAX_COPIES_PER_CARD) {
      const def = getCardDef(code);
      errors.push(`${def?.name ?? code}: max ${MAX_COPIES_PER_CARD} copies (has ${count})`);
    }
  }

  if (!hasCharacter) {
    errors.push('Deck must contain at least 1 CHARACTER card');
  }

  return {
    valid: errors.length === 0,
    errors,
    cardCount: cardCodes.length,
    colorBreakdown,
  };
}
