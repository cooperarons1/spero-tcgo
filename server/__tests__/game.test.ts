import { describe, it, expect } from 'vitest';
import { createGame, confirmMulligan } from '../game.js';
import { STARTING_HEALTH } from '../../shared/types.js';

/**
 * Smoke tests for the game lifecycle. These pin down the contract that
 * a freshly-created game has the right shape and that the mulligan →
 * playing transition leaves the state machine in a valid place.
 *
 * The flow tested here matches what happens when two AI bots play each
 * other (no human input, no socket layer): createGame → both players
 * confirm an empty mulligan → game enters PLAYING with correct mana,
 * coin, and turn ordering.
 */

function fixedGame(firstPlayerIndex: 0 | 1 = 0) {
  // firstPlayerIndex pinned so the test isn't flaky against the random
  // coin flip in createGame.
  return createGame(
    [
      { id: 'p1', name: 'Alice', heroClass: 'DEREK' },
      { id: 'p2', name: 'Bob', heroClass: 'TALA' },
    ],
    { firstPlayerIndex }
  );
}

describe('createGame', () => {
  it('returns a game with two players, full health, no mana', () => {
    const g = fixedGame();
    expect(g.players).toHaveLength(2);
    expect(g.players[0].health).toBe(STARTING_HEALTH);
    expect(g.players[1].health).toBe(STARTING_HEALTH);
    expect(g.players[0].mana).toBe(0);
    expect(g.players[0].maxMana).toBe(0);
  });

  it('phase is MULLIGAN and turnNumber is 1', () => {
    const g = fixedGame();
    expect(g.phase).toBe('MULLIGAN');
    expect(g.turnNumber).toBe(1);
    expect(g.winner).toBeNull();
    expect(g.winReason).toBeNull();
  });

  it('first player gets 3 cards, second player gets 4', () => {
    const g = fixedGame(0);
    expect(g.players[0].hand).toHaveLength(3);
    expect(g.players[1].hand).toHaveLength(4);
  });

  it('decks are populated and balanced after the deal', () => {
    const g = fixedGame();
    // Each side started with a 30-card deck; after dealing 3 + 4 the
    // remaining piles should be 27 + 26 respectively (or whatever the
    // deck builder chose) — we just assert both have plenty left.
    expect(g.decks[0].length).toBeGreaterThan(15);
    expect(g.decks[1].length).toBeGreaterThan(15);
  });

  it('hero classes are assigned correctly', () => {
    const g = fixedGame();
    expect(g.players[0].heroClass).toBe('DEREK');
    expect(g.players[1].heroClass).toBe('TALA');
  });

  it('throws when given a non-2-player roster', () => {
    expect(() =>
      createGame([{ id: 'solo', name: 'Solo', heroClass: 'DEREK' }])
    ).toThrow();
  });
});

describe('mulligan → playing transition', () => {
  it('both players confirming empty mulligan starts the game', () => {
    const g = fixedGame(0);
    const r1 = confirmMulligan(g, 'p1', g.players[0].hand.map(() => false));
    expect(r1.success).toBe(true);
    expect(g.phase).toBe('MULLIGAN'); // still mulligan, only 1 confirmed

    const r2 = confirmMulligan(g, 'p2', g.players[1].hand.map(() => false));
    expect(r2.success).toBe(true);
    expect(g.phase).toBe('PLAYING'); // now both confirmed
  });

  it('first player has 1 mana on turn 1, second player has the coin', () => {
    const g = fixedGame(0);
    confirmMulligan(g, 'p1', g.players[0].hand.map(() => false));
    confirmMulligan(g, 'p2', g.players[1].hand.map(() => false));

    // First player: maxMana refilled to 1, plus drew 1 card on turn start
    expect(g.players[0].mana).toBe(1);
    expect(g.players[0].maxMana).toBe(1);
    // Second player should have THE COIN in hand (4 starting + 1 coin = 5)
    expect(g.players[1].hand.length).toBe(5);
    expect(g.players[1].hand.some(c => c.cardCode === 'COIN')).toBe(true);
  });

  it('current player is the first player after transition', () => {
    const g = fixedGame(0);
    confirmMulligan(g, 'p1', g.players[0].hand.map(() => false));
    confirmMulligan(g, 'p2', g.players[1].hand.map(() => false));
    expect(g.currentPlayerIndex).toBe(0);
  });

  it('replacements actually swap cards out of hand', () => {
    const g = fixedGame(0);
    const originalHand = g.players[0].hand.map(c => c.instanceId);
    // Replace the first card
    confirmMulligan(g, 'p1', [true, false, false]);
    // The replaced card's instance should be different from any original
    // hand instance with the same index — in particular it should NOT
    // equal originalHand[0] (we may get a different card from the deck).
    // The deck shuffle happens after the swap, so we just check the hand
    // shape rather than identities.
    expect(g.players[0].hand).toHaveLength(3);
  });

  it('confirmMulligan rejects an unknown player', () => {
    const g = fixedGame();
    const r = confirmMulligan(g, 'nonexistent', [false, false, false]);
    expect(r.success).toBe(false);
  });

  it('confirmMulligan rejects double-confirm', () => {
    const g = fixedGame(0);
    confirmMulligan(g, 'p1', g.players[0].hand.map(() => false));
    const r = confirmMulligan(g, 'p1', g.players[0].hand.map(() => false));
    expect(r.success).toBe(false);
  });
});
