import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addToQueue,
  removeFromQueue,
  isInQueue,
  processQueue,
  calculateElo,
} from '../matchmaking.js';
import type { HeroClass } from '../../shared/types.js';

function makeEntry(uid: string, elo = 1000, mode: 'casual' | 'ranked' = 'casual', queuedAt = Date.now()) {
  return {
    uid,
    socketId: `sock-${uid}`,
    displayName: uid,
    heroClass: 'JIMMY' as HeroClass,
    deckCards: Array(30).fill('JIM001'),
    queuedAt,
    elo,
    mode,
  };
}

// ── ELO calculation ───────────────────────────────────────────────

describe('calculateElo', () => {
  it('equal ELO: winner gains ~16, loser loses ~16', () => {
    const { newWinnerElo, newLoserElo } = calculateElo(1000, 1000);
    expect(newWinnerElo).toBe(1016);
    expect(newLoserElo).toBe(984);
    expect(newWinnerElo + newLoserElo).toBe(2000); // zero-sum
  });

  it('favorite wins: gains less than 16', () => {
    const { newWinnerElo } = calculateElo(1500, 1000);
    expect(newWinnerElo - 1500).toBeLessThan(16);
    expect(newWinnerElo).toBeGreaterThan(1500);
  });

  it('underdog wins: gains more than 16', () => {
    const { newWinnerElo } = calculateElo(1000, 1500);
    expect(newWinnerElo - 1000).toBeGreaterThan(16);
  });

  it('loser always loses points', () => {
    const { newLoserElo } = calculateElo(1000, 1500);
    expect(newLoserElo).toBeLessThan(1500);
  });

  it('is approximately zero-sum', () => {
    const { newWinnerElo, newLoserElo } = calculateElo(1200, 800);
    // Rounding may cause ±1 drift
    expect(Math.abs((newWinnerElo + newLoserElo) - 2000)).toBeLessThanOrEqual(1);
  });
});

// ── Queue operations ──────────────────────────────────────────────

describe('queue operations', () => {
  beforeEach(() => {
    // Clear queue by removing all known entries
    for (const uid of ['p1', 'p2', 'p3', 'p4', 'p5']) {
      removeFromQueue(uid);
    }
  });

  it('addToQueue + isInQueue', () => {
    addToQueue(makeEntry('p1'));
    expect(isInQueue('p1')).toBe(true);
  });

  it('removeFromQueue clears entry', () => {
    addToQueue(makeEntry('p1'));
    removeFromQueue('p1');
    expect(isInQueue('p1')).toBe(false);
  });

  it('removeFromQueue on nonexistent uid is safe', () => {
    expect(() => removeFromQueue('nobody')).not.toThrow();
  });

  it('addToQueue replaces existing entry for same uid', () => {
    addToQueue(makeEntry('p1', 1000));
    addToQueue(makeEntry('p1', 1200));
    expect(isInQueue('p1')).toBe(true);
    // Verify only one entry by matching
    addToQueue(makeEntry('p2', 1200));
    const result = processQueue();
    expect(result.matched).not.toBeNull();
  });

  it('defaults ELO to 1000 when not provided', () => {
    addToQueue({ uid: 'p1', socketId: 's1', displayName: 'P1', heroClass: 'JIMMY' as HeroClass, deckCards: [], queuedAt: Date.now(), mode: 'casual' });
    addToQueue(makeEntry('p2', 1000));
    const result = processQueue();
    expect(result.matched).not.toBeNull();
  });
});

// ── Queue matching ────────────────────────────────────────────────

describe('processQueue', () => {
  beforeEach(() => {
    for (const uid of ['p1', 'p2', 'p3', 'p4', 'p5']) {
      removeFromQueue(uid);
    }
  });

  it('returns null match with 0 entries', () => {
    const result = processQueue();
    expect(result.matched).toBeNull();
    expect(result.timedOut).toHaveLength(0);
  });

  it('returns null match with 1 entry', () => {
    addToQueue(makeEntry('p1'));
    const result = processQueue();
    expect(result.matched).toBeNull();
  });

  it('matches 2 same-mode entries', () => {
    addToQueue(makeEntry('p1', 1000, 'casual'));
    addToQueue(makeEntry('p2', 1000, 'casual'));
    const result = processQueue();
    expect(result.matched).not.toBeNull();
    expect(result.matched![0].uid).toBeTruthy();
    expect(result.matched![1].uid).toBeTruthy();
  });

  it('does not match different modes', () => {
    addToQueue(makeEntry('p1', 1000, 'casual'));
    addToQueue(makeEntry('p2', 1000, 'ranked'));
    const result = processQueue();
    expect(result.matched).toBeNull();
  });

  it('does not match far ELO at t=0', () => {
    const now = Date.now();
    addToQueue(makeEntry('p1', 1000, 'casual', now));
    addToQueue(makeEntry('p2', 1500, 'casual', now));
    const result = processQueue();
    // 500 ELO gap > 200 allowed range at t=0
    expect(result.matched).toBeNull();
  });

  it('matches far ELO after 60s (range = Infinity)', () => {
    const past = Date.now() - 61_000;
    addToQueue(makeEntry('p1', 1000, 'casual', past));
    addToQueue(makeEntry('p2', 2000, 'casual', past));
    const result = processQueue();
    expect(result.matched).not.toBeNull();
  });

  it('times out entries after 5 minutes', () => {
    const old = Date.now() - 6 * 60 * 1000; // 6 minutes ago
    addToQueue(makeEntry('p1', 1000, 'casual', old));
    const result = processQueue();
    expect(result.timedOut).toHaveLength(1);
    expect(result.timedOut[0].uid).toBe('p1');
    expect(isInQueue('p1')).toBe(false);
  });

  it('matched players are removed from queue', () => {
    addToQueue(makeEntry('p1', 1000, 'casual'));
    addToQueue(makeEntry('p2', 1000, 'casual'));
    processQueue();
    expect(isInQueue('p1')).toBe(false);
    expect(isInQueue('p2')).toBe(false);
  });
});
