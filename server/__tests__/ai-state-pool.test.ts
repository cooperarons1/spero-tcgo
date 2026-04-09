import { describe, it, expect, beforeEach } from 'vitest';
import { gameStatePool, copyGameStateInto } from '../ai-state-pool.js';
import { createGame, confirmMulligan } from '../game.js';
import { resetInstanceCounter, resetTransientCounters } from '../deck.js';

/**
 * Tests for the GameState pool. These pin down:
 *   1. copyGameStateInto produces a structurally-equal but
 *      reference-distinct copy (no aliasing)
 *   2. mutating the copy doesn't affect the source
 *   3. acquireCloneScoped + popFrame round-trip recycles the same shell
 *   4. nested frames work like a stack
 *   5. The pool is a no-op when no frame is open (forward-compat)
 *
 * Without these, the optimization could silently corrupt AI rollouts
 * via state leaks across iterations.
 */

beforeEach(() => {
  resetInstanceCounter();
  resetTransientCounters();
  gameStatePool.reset();
});

function buildPlayingGame() {
  const g = createGame(
    [
      { id: 'p1', name: 'Alice', heroClass: 'DEREK' },
      { id: 'p2', name: 'Bob', heroClass: 'TALA' },
    ],
    { firstPlayerIndex: 0 }
  );
  confirmMulligan(g, 'p1', g.players[0].hand.map(() => false));
  confirmMulligan(g, 'p2', g.players[1].hand.map(() => false));
  return g;
}

describe('copyGameStateInto', () => {
  it('produces a copy that matches all scalar fields', () => {
    const src = buildPlayingGame();
    const dst = buildPlayingGame();
    src.turnNumber = 7;
    src.cardsPlayedThisTurn = 3;
    src.players[0].health = 12;
    src.players[0].mana = 4;
    src.players[1].armor = 5;
    copyGameStateInto(src, dst);
    expect(dst.turnNumber).toBe(7);
    expect(dst.cardsPlayedThisTurn).toBe(3);
    expect(dst.players[0].health).toBe(12);
    expect(dst.players[0].mana).toBe(4);
    expect(dst.players[1].armor).toBe(5);
  });

  it('hand contents copy correctly', () => {
    const src = buildPlayingGame();
    const dst = buildPlayingGame();
    copyGameStateInto(src, dst);
    expect(dst.players[0].hand.length).toBe(src.players[0].hand.length);
    for (let i = 0; i < src.players[0].hand.length; i++) {
      expect(dst.players[0].hand[i].cardCode).toBe(src.players[0].hand[i].cardCode);
      expect(dst.players[0].hand[i].instanceId).toBe(src.players[0].hand[i].instanceId);
      // Reference-distinct: mutating dst hand item must not affect src
      expect(dst.players[0].hand[i]).not.toBe(src.players[0].hand[i]);
    }
  });

  it('mutating the copy does not affect the source', () => {
    const src = buildPlayingGame();
    const dst = buildPlayingGame();
    copyGameStateInto(src, dst);
    const srcHandLen = src.players[0].hand.length;

    // Mutate dst
    dst.players[0].health = 1;
    dst.players[0].hand.length = 0;
    dst.turnNumber = 99;

    // Source should be unchanged
    expect(src.players[0].health).not.toBe(1);
    expect(src.players[0].hand.length).toBe(srcHandLen);
    expect(src.turnNumber).not.toBe(99);
  });

  it('drops the log (matches cloneGame behavior)', () => {
    const src = buildPlayingGame();
    src.log.push({ id: 1, turnNumber: 1, playerIndex: 0, message: 'test', category: 'GAME' });
    const dst = buildPlayingGame();
    copyGameStateInto(src, dst);
    expect(dst.log.length).toBe(0);
  });

  it('handles null mulliganChoices correctly', () => {
    const src = buildPlayingGame();
    src.mulliganChoices = [null, null];
    const dst = buildPlayingGame();
    copyGameStateInto(src, dst);
    expect(dst.mulliganChoices[0]).toBeNull();
    expect(dst.mulliganChoices[1]).toBeNull();
  });
});

describe('gameStatePool frame lifecycle', () => {
  it('acquire without frame returns a fresh shell each time', () => {
    const g = buildPlayingGame();
    const a = gameStatePool.acquireCloneScoped(g);
    const b = gameStatePool.acquireCloneScoped(g);
    expect(a).not.toBe(b);
    // Stats: 2 acquires, 0 hits (pool was empty)
    const stats = gameStatePool.stats();
    expect(stats.acquires).toBe(2);
    expect(stats.hits).toBe(0);
  });

  it('popFrame recycles all clones from the matching push', () => {
    const g = buildPlayingGame();
    gameStatePool.pushFrame();
    const a = gameStatePool.acquireCloneScoped(g);
    const b = gameStatePool.acquireCloneScoped(g);
    const c = gameStatePool.acquireCloneScoped(g);
    gameStatePool.popFrame();
    // After popFrame, the freelist should hold all 3
    expect(gameStatePool.stats().currentFree).toBe(3);
    // Subsequent acquireCloneScoped should hit the pool
    const d = gameStatePool.acquireCloneScoped(g);
    expect([a, b, c]).toContain(d);
    expect(gameStatePool.stats().hits).toBe(1);
  });

  it('nested frames pop in LIFO order', () => {
    const g = buildPlayingGame();
    gameStatePool.pushFrame();
    gameStatePool.acquireCloneScoped(g); // outer frame: 1 clone
    gameStatePool.pushFrame();
    gameStatePool.acquireCloneScoped(g); // inner frame: 1 clone
    gameStatePool.acquireCloneScoped(g); // inner frame: 2 clones
    gameStatePool.popFrame(); // recycle inner frame's 2
    expect(gameStatePool.stats().currentFree).toBe(2);
    gameStatePool.popFrame(); // recycle outer frame's 1
    expect(gameStatePool.stats().currentFree).toBe(3);
  });

  it('popFrame with no matching push is a no-op', () => {
    expect(() => gameStatePool.popFrame()).not.toThrow();
    expect(gameStatePool.stats().currentFree).toBe(0);
  });

  it('acquireCloneScoped without an open frame still returns a valid clone', () => {
    const g = buildPlayingGame();
    const a = gameStatePool.acquireCloneScoped(g);
    expect(a.players[0].playerId).toBe('p1');
    expect(a.players[1].playerId).toBe('p2');
    expect(a.turnNumber).toBe(g.turnNumber);
    // It just won't be reused — that's fine, the pool degrades
    // gracefully when callers haven't opted in.
    expect(gameStatePool.stats().currentFree).toBe(0);
  });

  it('recycled clone is mutation-safe (no aliasing with source)', () => {
    const g = buildPlayingGame();
    gameStatePool.pushFrame();
    const a = gameStatePool.acquireCloneScoped(g);
    a.players[0].health = 1;
    a.players[0].hand.length = 0;
    gameStatePool.popFrame();

    // Acquire again — same shell, fresh contents from g
    gameStatePool.pushFrame();
    const b = gameStatePool.acquireCloneScoped(g);
    expect(b).toBe(a); // same recycled object
    expect(b.players[0].health).toBe(g.players[0].health); // not 1
    expect(b.players[0].hand.length).toBe(g.players[0].hand.length); // not 0
    gameStatePool.popFrame();
  });
});
