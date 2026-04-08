import { describe, it, expect, beforeEach } from 'vitest';
import {
  makeInstance,
  resetInstanceCounter,
  nextTransientInstanceId,
  resetTransientCounters,
  createTwoDecks,
  createDeckFromList,
  shuffle,
} from '../deck.js';

/**
 * Deck factory + ID counter tests. Pins down the C2 instance-ID fix
 * we landed in the morning engine pass: nextTransientInstanceId is now
 * a process-local monotonic counter, NOT the old
 *   Date.now()+Math.random().toString(36).slice(2,6)
 * which had a ~1.6M-state suffix and birthday-collided in heavy parallel
 * simulation.
 *
 * The test asserts: monotonic, unique, resettable, prefix-respected.
 * If anyone ever swaps it back to a random suffix, this test catches it.
 */

beforeEach(() => {
  resetInstanceCounter();
  resetTransientCounters();
});

describe('makeInstance', () => {
  it('generates monotonically increasing instance IDs', () => {
    const a = makeInstance('TEST');
    const b = makeInstance('TEST');
    const c = makeInstance('TEST');
    expect(a.instanceId).toBe('ci-1');
    expect(b.instanceId).toBe('ci-2');
    expect(c.instanceId).toBe('ci-3');
  });

  it('preserves the cardCode', () => {
    const a = makeInstance('CODE_X');
    expect(a.cardCode).toBe('CODE_X');
  });

  it('resetInstanceCounter restarts from 1', () => {
    makeInstance('A');
    makeInstance('B');
    resetInstanceCounter();
    const c = makeInstance('C');
    expect(c.instanceId).toBe('ci-1');
  });
});

describe('nextTransientInstanceId (C2 fix)', () => {
  it('honors the prefix', () => {
    expect(nextTransientInstanceId('bm')).toBe('bm-1');
    expect(nextTransientInstanceId('sec')).toBe('sec-2');
    expect(nextTransientInstanceId('loc')).toBe('loc-3');
  });

  it('is monotonic (no collisions across 10K iterations)', () => {
    // The old random-suffix approach would have collided around the
    // birthday bound (sqrt(36^4) ≈ 1300 events) — this fast loop would
    // have failed within milliseconds before C2.
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const id = nextTransientInstanceId('bm');
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
    expect(ids.size).toBe(10_000);
  });

  it('resetTransientCounters restarts from 1', () => {
    nextTransientInstanceId('bm');
    nextTransientInstanceId('bm');
    resetTransientCounters();
    expect(nextTransientInstanceId('bm')).toBe('bm-1');
  });
});

describe('createTwoDecks', () => {
  it('returns two non-empty starter decks', () => {
    const [a, b] = createTwoDecks();
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
  });

  it('decks contain CardInstance objects with valid cardCodes', () => {
    const [a] = createTwoDecks();
    for (const c of a) {
      expect(typeof c.cardCode).toBe('string');
      expect(c.cardCode.length).toBeGreaterThan(0);
      expect(c.instanceId).toMatch(/^ci-\d+$/);
    }
  });
});

describe('createDeckFromList', () => {
  it('creates one CardInstance per cardCode in the list (shuffled)', () => {
    // createDeckFromList shuffles internally, so order is randomized
    // but the multiset of cardCodes must match the input.
    const list = ['A', 'B', 'C', 'A'];
    const deck = createDeckFromList(list);
    expect(deck).toHaveLength(4);
    expect(deck.map(c => c.cardCode).sort()).toEqual(list.slice().sort());
  });

  it('every instance gets a unique instanceId', () => {
    const list = ['X', 'X', 'X', 'X', 'X'];
    const deck = createDeckFromList(list);
    const ids = new Set(deck.map(c => c.instanceId));
    expect(ids.size).toBe(5);
  });
});

describe('shuffle', () => {
  it('returns an array of the same length', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = shuffle(arr);
    expect(shuffled).toHaveLength(arr.length);
  });

  it('preserves the multiset of elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    expect(shuffled.slice().sort()).toEqual(arr.slice().sort());
  });

  it('does NOT mutate the input array (returns a new one)', () => {
    const arr = [1, 2, 3, 4, 5];
    const before = [...arr];
    shuffle(arr);
    // shuffle returns a new array but mutating the input would be a regression
    expect(arr).toEqual(before);
  });
});
