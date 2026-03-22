import type { CardInstance, CardDef } from '../shared/types.js';
import { getAllCardDefs } from './cards.js';
import { STARTER_DECKS } from '../shared/starterDecks.js';

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

/** Create two color-themed 60-card starter decks using shared definitions */
export function createTwoDecks(): [CardInstance[], CardInstance[]] {
  const redDeck = STARTER_DECKS.find(d => d.id === 'starter-jimmys-crew')!;
  const greenDeck = STARTER_DECKS.find(d => d.id === 'starter-talas-rangers')!;

  return [
    shuffle(redDeck.cards.map(code => makeInstance(code))),
    shuffle(greenDeck.cards.map(code => makeInstance(code))),
  ];
}

/** Create a deck from a list of card codes (for custom decks) */
export function createDeckFromList(cardCodes: string[]): CardInstance[] {
  return shuffle(cardCodes.map(code => makeInstance(code)));
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
