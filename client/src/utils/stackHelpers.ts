import type { ClientStack, ClientCardInstance } from '../../../shared/types';
import cardData from '../../../data/cards.json';

const cardMap = new Map(cardData.map((c: any) => [c.cardCode, c]));

export function getCardDef(cardCode: string) {
  return cardMap.get(cardCode);
}

/** Calculate visible power of a client stack */
export function clientStackPower(stack: ClientStack): number {
  let total = 0;
  for (const c of stack.cards) {
    if (!c.faceUp || !c.cardCode) continue;
    const def = getCardDef(c.cardCode);
    if (def && (def.typeA === 'CHARACTER' || def.typeA === 'EQUIPMENT')) {
      total += def.power;
    }
  }
  return total;
}

/** Calculate visible smarts of a client stack */
export function clientStackSmarts(stack: ClientStack): number {
  let total = 0;
  for (const c of stack.cards) {
    if (!c.faceUp || !c.cardCode) continue;
    const def = getCardDef(c.cardCode);
    if (def && (def.typeA === 'CHARACTER' || def.typeA === 'EQUIPMENT')) {
      total += def.smarts;
    }
  }
  return total;
}

/** Get the top visible character name */
export function topCharacterName(stack: ClientStack): string {
  for (let i = stack.cards.length - 1; i >= 0; i--) {
    const c = stack.cards[i];
    if (!c.faceUp || !c.cardCode) continue;
    const def = getCardDef(c.cardCode);
    if (def && def.typeA === 'CHARACTER') return def.name;
  }
  return 'Unknown';
}

/** Get the stack's color from its base character */
export function clientStackColor(stack: ClientStack): string {
  for (const c of stack.cards) {
    if (!c.cardCode) continue;
    const def = getCardDef(c.cardCode);
    if (def && def.typeA === 'CHARACTER') return def.color;
  }
  return 'none';
}
