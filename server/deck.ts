import type { CardInstance, HeroClass } from '../shared/types.js';
import { STARTER_DECKS } from '../shared/starterDecks.js';

let nextInstanceId = 1;

export function makeInstance(cardCode: string): CardInstance {
  return {
    instanceId: `ci-${nextInstanceId++}`,
    cardCode,
  };
}

export function resetInstanceCounter(): void {
  nextInstanceId = 1;
}

/**
 * Monotonic ID factory shared by combat.ts (board minions), actions.ts
 * (secrets, locations) and any other code path that previously used
 * `Date.now()-${Math.random().toString(36).slice(2,6)}` style IDs.
 *
 * The old approach had only ~1.6M states of randomness in the suffix.
 * Under heavy parallel simulation that birthday-collides on the order of
 * tens of thousands of games and silently corrupts findMinion() lookups
 * (the wrong minion takes damage). This counter is process-local and
 * monotonic — collisions are impossible within a process. Across forked
 * worker processes IDs may collide, but each worker has its own GameState
 * universe so cross-worker collisions don't matter.
 *
 * Reset by createGame() (via resetInstanceCounter + resetTransientCounters)
 * so unit tests and back-to-back simulations stay deterministic.
 */
let nextTransientId = 1;
export function nextTransientInstanceId(prefix: string): string {
  return `${prefix}-${nextTransientId++}`;
}

export function resetTransientCounters(): void {
  nextTransientId = 1;
}

/** Create two starter decks (Jimmy vs Tala by default) */
export function createTwoDecks(): [CardInstance[], CardInstance[]] {
  const jimmyDeck = STARTER_DECKS.find(d => d.id === 'starter-jimmy')!;
  const talaDeck = STARTER_DECKS.find(d => d.id === 'starter-tala')!;

  return [
    shuffle(jimmyDeck.cards.map(code => makeInstance(code))),
    shuffle(talaDeck.cards.map(code => makeInstance(code))),
  ];
}

/** Get the hero class for a starter deck by its ID */
export function getStarterDeckHeroClass(deckId: string): HeroClass {
  const deck = STARTER_DECKS.find(d => d.id === deckId);
  return deck?.heroClass ?? 'JIMMY';
}

/** Create a deck from a list of card codes */
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
