import type { CardInstance, CardDef } from '../shared/types.js';
import { getAllCardDefs } from './cards.js';

let nextInstanceId = 1;

export function makeInstance(cardCode: string): CardInstance {
  return {
    instanceId: `ci-${nextInstanceId++}`,
    cardCode,
    faceUp: true,
  };
}

export function resetInstanceCounter(): void {
  nextInstanceId = 1;
}

export function createDeck(): CardInstance[] {
  const allDefs = getAllCardDefs();
  return allDefs.map((def: CardDef) => makeInstance(def.cardCode));
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
