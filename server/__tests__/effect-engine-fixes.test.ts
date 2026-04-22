import { describe, it, expect, beforeEach } from 'vitest';
import { createGame, confirmMulligan } from '../game.js';
import { createBoardMinion } from '../combat.js';
import { executeEffects } from '../effects.js';
import { checkSecrets } from '../secrets.js';
import { resetInstanceCounter, resetTransientCounters } from '../deck.js';
import type { GameState, HeroClass } from '../../shared/types.js';

/**
 * Regression tests for the 2026-04-22 effect-engine cleanup. Each bug
 * was found by scripts/card-lint.py walking cards.json and checking that
 * every (effect.type, effect.target) combo actually has a live branch
 * in server/effects.ts. Before this pass, the flagged cards' effects
 * silently no-op'd at runtime.
 */

beforeEach(() => {
  resetInstanceCounter();
  resetTransientCounters();
});

function freshGame(a: HeroClass = 'DES', b: HeroClass = 'TALA'): GameState {
  const g = createGame(
    [
      { id: 'p1', name: 'Alice', heroClass: a },
      { id: 'p2', name: 'Bob', heroClass: b },
    ],
    { firstPlayerIndex: 0 }
  );
  confirmMulligan(g, 'p1', g.players[0].hand.map(() => false));
  confirmMulligan(g, 'p2', g.players[1].hand.map(() => false));
  return g;
}

describe('DESTROY_MINION target=RANDOM_ENEMY', () => {
  it('picks a random living enemy minion and destroys it', () => {
    const g = freshGame();
    const opp = g.players[1];
    opp.board.push(createBoardMinion('NEU085'));
    opp.board.push(createBoardMinion('NEU099'));
    const before = opp.board.length;

    executeEffects(g, 0, [{ type: 'DESTROY_MINION', target: 'RANDOM_ENEMY' }]);

    expect(opp.board.length).toBe(before - 1);
  });

  it('no-ops safely with no enemy minions', () => {
    const g = freshGame();
    expect(() =>
      executeEffects(g, 0, [{ type: 'DESTROY_MINION', target: 'RANDOM_ENEMY' }])
    ).not.toThrow();
  });
});

describe('SILENCE_TARGET target=ALL_ENEMY_MINIONS (AVA029)', () => {
  it('silences every enemy minion', () => {
    const g = freshGame();
    const opp = g.players[1];
    const a = createBoardMinion('NEU099');   // 6/6 Taunt
    const b = createBoardMinion('NEU085');
    opp.board.push(a, b);
    executeEffects(g, 0, [{ type: 'SILENCE_TARGET', target: 'ALL_ENEMY_MINIONS' }]);
    expect(a.isSilenced).toBe(true);
    expect(b.isSilenced).toBe(true);
  });
});

describe('STEAL_MINION (DES024 Elixir of Domination)', () => {
  it('moves an enemy minion with attack <= maxAttack to friendly board', () => {
    const g = freshGame('DES', 'TALA');
    const me = g.players[0];
    const opp = g.players[1];
    const weakling = createBoardMinion('NEU085');  // 4/5 at 5 mana
    opp.board.push(weakling);
    const targetId = weakling.instanceId;

    executeEffects(
      g,
      0,
      [{ type: 'STEAL_MINION', target: 'TARGET_ENEMY_MINION', maxAttack: 5 }],
      targetId
    );

    expect(opp.board.find(m => m.instanceId === targetId)).toBeUndefined();
    expect(me.board.find(m => m.instanceId === targetId)).toBeDefined();
  });

  it('refuses to steal a minion above maxAttack', () => {
    const g = freshGame('DES', 'TALA');
    const me = g.players[0];
    const opp = g.players[1];
    const big = createBoardMinion('NEU099');  // 6/6 taunt
    opp.board.push(big);

    executeEffects(
      g,
      0,
      [{ type: 'STEAL_MINION', target: 'TARGET_ENEMY_MINION', maxAttack: 3 }],
      big.instanceId
    );

    // Still on opponent's board
    expect(opp.board).toContain(big);
    expect(me.board).not.toContain(big);
  });
});

describe('DESTROY_FROZEN_MINION (AND039 Shatter)', () => {
  it('destroys a targeted frozen enemy minion', () => {
    const g = freshGame();
    const opp = g.players[1];
    const m = createBoardMinion('NEU085');
    m.isFrozen = true;
    opp.board.push(m);

    executeEffects(
      g,
      0,
      [{ type: 'DESTROY_FROZEN_MINION', target: 'TARGET_ENEMY_MINION' }],
      m.instanceId
    );

    expect(opp.board).not.toContain(m);
  });

  it('leaves non-frozen minions alone', () => {
    const g = freshGame();
    const opp = g.players[1];
    const m = createBoardMinion('NEU085');
    opp.board.push(m);

    executeEffects(
      g,
      0,
      [{ type: 'DESTROY_FROZEN_MINION', target: 'TARGET_ENEMY_MINION' }],
      m.instanceId
    );

    expect(opp.board).toContain(m);
  });
});

describe('AST_S02 Second Chance re-summon via secrets.ts', () => {
  it('re-summons the dying friendly minion with 1 Health', () => {
    const g = freshGame('ASTRID', 'DEREK');
    const me = g.players[0];

    // Arm the secret on me
    me.secrets.push({ instanceId: 'sec-1', cardCode: 'AST_S02', ownerPlayerIndex: 0 });

    // Fire the WHEN_FRIENDLY_MINION_DIES trigger with a dead minion's code
    const before = me.board.length;
    checkSecrets(g, 'WHEN_FRIENDLY_MINION_DIES', {
      actingPlayerIndex: 1,
      deadMinionCardCode: 'NEU085',
      deadMinionOwnerIndex: 0,
    });

    expect(me.board.length).toBe(before + 1);
    const resummoned = me.board[me.board.length - 1];
    expect(resummoned.cardCode).toBe('NEU085');
    expect(resummoned.currentHealth).toBe(1);
  });
});
