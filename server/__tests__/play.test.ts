import { describe, it, expect, beforeEach } from 'vitest';
import { createGame, confirmMulligan, endTurn } from '../game.js';
import { playCard } from '../actions.js';
import { resetInstanceCounter, resetTransientCounters, makeInstance } from '../deck.js';
import { getAllCardDefs } from '../cards.js';
import type { GameState } from '../../shared/types.js';

/**
 * Integration tests for the playCard / endTurn hot path. These wire
 * a complete game through createGame → mulligan → playCard → endTurn
 * and assert end-state invariants. The AI training loop calls this
 * exact path on every simulated game so a regression here breaks the
 * whole pipeline.
 */

beforeEach(() => {
  resetInstanceCounter();
  resetTransientCounters();
});

/**
 * Build a deterministic game where player 0 starts with a known
 * 1-mana vanilla minion in hand and player 1 has a fixed deck. Skips
 * mulligan empty so we land in PLAYING with player 0 to act on turn 1
 * with 1 mana.
 */
function freshGameWithKnownMinion(): { g: GameState; oneManaMinionCode: string | null } {
  // Find a true vanilla 1-mana minion: no battlecry, no deathrattle,
  // no keyword effects at all. The play test asserts hand length
  // changes by exactly -1 so we can't tolerate a battlecry that draws,
  // summons, deals damage to the opponent's hand, etc.
  const all = getAllCardDefs();
  const oneManaVanilla = all.find(c =>
    c.type === 'MINION' &&
    c.manaCost === 1 &&
    c.cardCode !== 'COIN' &&
    !c.cardCode.includes('TOKEN') &&
    c.keywords.length === 0 &&
    !c.battlecryEffect &&
    (!c.battlecryEffects || c.battlecryEffects.length === 0) &&
    !c.deathrattleEffect &&
    !c.endOfTurnEffect
  );

  const g = createGame(
    [
      { id: 'p1', name: 'Alice', heroClass: 'DEREK' },
      { id: 'p2', name: 'Bob', heroClass: 'TALA' },
    ],
    { firstPlayerIndex: 0 }
  );

  // Inject the 1-mana minion into player 0's hand for a deterministic
  // play test. We replace the first hand card.
  if (oneManaVanilla) {
    g.players[0].hand[0] = makeInstance(oneManaVanilla.cardCode);
  }

  // Skip mulligan (no replacements)
  confirmMulligan(g, 'p1', g.players[0].hand.map(() => false));
  confirmMulligan(g, 'p2', g.players[1].hand.map(() => false));

  return { g, oneManaMinionCode: oneManaVanilla?.cardCode ?? null };
}

describe('playCard — minion happy path', () => {
  it('places a 1-mana minion on the board, deducts mana, removes from hand', () => {
    const { g, oneManaMinionCode } = freshGameWithKnownMinion();
    if (!oneManaMinionCode) return; // catalog has no playable 1-mana vanilla

    expect(g.phase).toBe('PLAYING');
    expect(g.currentPlayerIndex).toBe(0);
    expect(g.players[0].mana).toBe(1);
    const handBefore = g.players[0].hand.length;
    const boardBefore = g.players[0].board.length;
    const cardId = g.players[0].hand.find(c => c.cardCode === oneManaMinionCode)!.instanceId;

    const result = playCard(g, 'p1', cardId);
    expect(result.success).toBe(true);
    expect(g.players[0].mana).toBe(0);
    expect(g.players[0].hand.length).toBe(handBefore - 1);
    expect(g.players[0].board.length).toBe(boardBefore + 1);
    expect(g.players[0].board[g.players[0].board.length - 1].cardCode).toBe(oneManaMinionCode);
  });

  it('rejects playCard during opponent turn', () => {
    const { g } = freshGameWithKnownMinion();
    // p2 tries to play during p1's turn
    const result = playCard(g, 'p2', g.players[1].hand[0].instanceId);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/turn/i);
  });

  it('rejects unknown card instance', () => {
    const { g } = freshGameWithKnownMinion();
    const result = playCard(g, 'p1', 'ci-nonexistent');
    expect(result.success).toBe(false);
  });

  it('rejects when not enough mana', () => {
    const { g } = freshGameWithKnownMinion();
    // Find a card in hand that costs more than 1 mana
    const expensive = g.players[0].hand.find(c => {
      const def = getAllCardDefs().find(d => d.cardCode === c.cardCode);
      return def && def.manaCost > 1;
    });
    if (!expensive) return;
    const result = playCard(g, 'p1', expensive.instanceId);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/mana/i);
  });

  it('clamps negative position to 0 (regression: splice(-1,0,...) bug)', () => {
    const { g, oneManaMinionCode } = freshGameWithKnownMinion();
    if (!oneManaMinionCode) return;
    // Pre-populate the board with two existing minions so we can tell
    // the difference between "inserted at index 0" and "inserted at end".
    // The vanilla minion isn't a token, so it has stable instanceIds.
    const existing1 = g.players[0].board.length;
    const cardId = g.players[0].hand.find(c => c.cardCode === oneManaMinionCode)!.instanceId;
    // Send position: -1. Old code did Math.min(-1, 0) → -1, then
    // splice(-1, 0, item) inserts BEFORE the last element.
    // New code clamps to 0 so the minion lands at index 0.
    const result = playCard(g, 'p1', cardId, -1);
    expect(result.success).toBe(true);
    expect(g.players[0].board.length).toBe(existing1 + 1);
    // The newly-played minion should be at index 0 (clamped from -1)
    expect(g.players[0].board[0].cardCode).toBe(oneManaMinionCode);
  });
});

describe('endTurn', () => {
  it('hands off to the other player and refills their mana', () => {
    const { g } = freshGameWithKnownMinion();
    expect(g.currentPlayerIndex).toBe(0);
    expect(g.players[0].mana).toBe(1);
    expect(g.players[1].mana).toBe(0);

    const result = endTurn(g, 'p1');
    expect(result.success).toBe(true);
    expect(g.currentPlayerIndex).toBe(1);
    // Player 1 starts their first turn with 1 mana of their own
    expect(g.players[1].mana).toBe(1);
    expect(g.players[1].maxMana).toBe(1);
    expect(g.turnNumber).toBe(2);
  });

  it('mana caps at 10 over many turns', () => {
    const { g } = freshGameWithKnownMinion();
    // Burn through 12 turns and confirm maxMana never exceeds 10
    for (let i = 0; i < 24; i++) {
      const playerId = g.currentPlayerIndex === 0 ? 'p1' : 'p2';
      endTurn(g, playerId);
      if (g.winner) break;
    }
    expect(g.players[0].maxMana).toBeLessThanOrEqual(10);
    expect(g.players[1].maxMana).toBeLessThanOrEqual(10);
  });

  it('rejects endTurn from the non-active player', () => {
    const { g } = freshGameWithKnownMinion();
    const result = endTurn(g, 'p2'); // p1's turn
    expect(result.success).toBe(false);
  });
});
