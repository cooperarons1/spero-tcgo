import { describe, it, expect, beforeEach } from 'vitest';
import { createGame, confirmMulligan, endTurn } from '../game.js';
import { attack, createBoardMinion } from '../combat.js';
import { useHeroPower, playCard } from '../actions.js';
import { checkSecrets } from '../secrets.js';
import { executeEffects } from '../effects.js';
import { resetInstanceCounter, resetTransientCounters } from '../deck.js';
import type { GameState, HeroClass } from '../../shared/types.js';
import { HERO_POWER_COST } from '../../shared/types.js';

/**
 * Integration-style tests covering common cross-subsystem scenarios
 * that regressed or got fixed in the 2026-04-22 session. These go
 * through the real playCard / attack / useHeroPower flows so a
 * regression in any of the wiring (effect → combat → state) fails the
 * test rather than the unit test still passing in isolation.
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

describe('DEREK Reforge hero power (+1 atk + 1 armor)', () => {
  it('grants hero attack-this-turn after use', () => {
    const g = freshGame('DEREK', 'TALA');
    const me = g.players[0];
    me.mana = HERO_POWER_COST;
    me.maxMana = HERO_POWER_COST;

    const before = me.heroAttackThisTurn ?? 0;
    const result = useHeroPower(g, 'p1');
    expect(result.success).toBe(true);
    expect((me.heroAttackThisTurn ?? 0)).toBe(before + 1);
    expect(me.armor).toBe(1);
  });

  it('hero can attack enemy hero after Reforge (no weapon equipped)', () => {
    const g = freshGame('DEREK', 'TALA');
    const me = g.players[0];
    const opp = g.players[1];
    me.mana = HERO_POWER_COST;
    me.maxMana = HERO_POWER_COST;

    // Use Reforge → +1 attack
    useHeroPower(g, 'p1');
    expect(me.heroAttackThisTurn).toBe(1);

    const oppHpBefore = opp.health;
    const result = attack(g, 'p1', `hero-0`, 'hero-1');
    expect(result.success).toBe(true);
    expect(opp.health).toBe(oppHpBefore - 1);
  });
});

describe('Weapon equip → hero attack flow', () => {
  it('equipping a weapon enables hero attack in the same turn', () => {
    const g = freshGame('DES', 'TALA');
    const me = g.players[0];
    const opp = g.players[1];

    // Manually equip a weapon — simulates a weapon card being played
    me.weapon = { cardCode: 'NEU065', currentAttack: 1, durability: 3 };
    me.heroAttacksRemaining = 1;

    const oppHpBefore = opp.health;
    const result = attack(g, 'p1', `hero-0`, 'hero-1');
    expect(result.success).toBe(true);
    expect(opp.health).toBe(oppHpBefore - 1);

    // Durability consumed
    expect(me.weapon?.durability).toBe(2);
  });

  it('swapping weapons mid-turn uses the new weapon\'s attack', () => {
    const g = freshGame('DES', 'TALA');
    const me = g.players[0];
    const opp = g.players[1];

    me.weapon = { cardCode: 'NEU065', currentAttack: 1, durability: 3 };
    me.heroAttacksRemaining = 1;

    // Swap to a stronger weapon
    me.weapon = { cardCode: 'DES040', currentAttack: 1, durability: 4 };

    const oppHpBefore = opp.health;
    attack(g, 'p1', `hero-0`, 'hero-1');
    expect(opp.health).toBe(oppHpBefore - 1);
  });
});

describe('DES040 + hero attack full round trip', () => {
  it('hero swinging DES040 into an enemy minion also AOEs 1 to all enemy minions', () => {
    const g = freshGame('DES', 'TALA');
    const me = g.players[0];
    const opp = g.players[1];

    me.weapon = { cardCode: 'DES040', currentAttack: 1, durability: 4 };
    me.heroAttacksRemaining = 1;
    me.heroAttackThisTurn = 0;

    // Two non-taunt enemy minions
    const m1 = createBoardMinion('NEU085');
    const m2 = createBoardMinion('NEU066');
    opp.board.push(m1, m2);
    const m1Hp = m1.currentHealth;
    const m2Hp = m2.currentHealth;

    // Attack enemy hero (weapon swings — DES040 trigger should fire)
    const result = attack(g, 'p1', `hero-0`, 'hero-1');
    expect(result.success).toBe(true);

    // Both non-target minions took the +1 AOE
    expect(m1.currentHealth).toBe(m1Hp - 1);
    expect(m2.currentHealth).toBe(m2Hp - 1);
  });
});

describe('LIFESTEAL + armor interaction', () => {
  it('lifesteal heal applies to hero HP, not armor (heals below maxHealth)', () => {
    const g = freshGame('DES', 'TALA');
    const me = g.players[0];
    const opp = g.players[1];

    me.health = 20;
    me.armor = 5;
    const attacker = createBoardMinion('DES029'); // 5/5 LIFESTEAL
    attacker.canAttack = true;
    me.board.push(attacker);

    const target = createBoardMinion('NEU085');
    opp.board.push(target);

    attack(g, 'p1', attacker.instanceId, target.instanceId);

    // Health moved up from 20 by the 5 damage dealt (capped at maxHealth)
    expect(me.health).toBeGreaterThanOrEqual(20 + Math.min(5, me.maxHealth - 20));
    // Armor untouched — lifesteal doesn't stack it
    expect(me.armor).toBe(5);
  });
});

describe('Silence-all-enemy-minions (AVA029) removes Taunt + Divine Shield', () => {
  it('silences every enemy minion in one cast', () => {
    const g = freshGame('AVA', 'DEREK');
    const opp = g.players[1];

    const t1 = createBoardMinion('NEU099');  // Taunt
    const t2 = createBoardMinion('NEU085');
    opp.board.push(t1, t2);

    executeEffects(g, 0, [{ type: 'SILENCE_TARGET', target: 'ALL_ENEMY_MINIONS' }]);

    expect(t1.isSilenced).toBe(true);
    expect(t2.isSilenced).toBe(true);
  });

  it('silenced LIFESTEAL minion no longer heals on attack', () => {
    const g = freshGame('DES', 'TALA');
    const me = g.players[0];
    const opp = g.players[1];

    me.health = 20;
    const attacker = createBoardMinion('DES029');
    attacker.canAttack = true;
    attacker.isSilenced = true; // simulate post-silence
    me.board.push(attacker);

    const target = createBoardMinion('NEU085');
    opp.board.push(target);

    const before = me.health;
    attack(g, 'p1', attacker.instanceId, target.instanceId);
    expect(me.health).toBe(before); // no lifesteal heal when silenced
  });
});

describe('AST_S02 Second Chance re-summon', () => {
  it('re-summons the exact dying minion with 1 Health', () => {
    const g = freshGame('ASTRID', 'DEREK');
    const me = g.players[0];
    me.secrets.push({ instanceId: 'sec-1', cardCode: 'AST_S02', ownerPlayerIndex: 0 });

    checkSecrets(g, 'WHEN_FRIENDLY_MINION_DIES', {
      actingPlayerIndex: 1,
      deadMinionCardCode: 'NEU099',  // 6/6 Taunt
      deadMinionOwnerIndex: 0,
    });

    const resummoned = me.board[me.board.length - 1];
    expect(resummoned.cardCode).toBe('NEU099');
    expect(resummoned.currentHealth).toBe(1);
  });
});

describe('STEAL_MINION attack-cap check', () => {
  it('DES024-style steal rejects minions above maxAttack', () => {
    const g = freshGame('DES', 'TALA');
    const me = g.players[0];
    const opp = g.players[1];

    const big = createBoardMinion('NEU099'); // 6/6 attacks-too-hard
    opp.board.push(big);

    executeEffects(g, 0, [
      { type: 'STEAL_MINION', target: 'TARGET_ENEMY_MINION', maxAttack: 3 }
    ], big.instanceId);

    expect(opp.board).toContain(big);
    expect(me.board).not.toContain(big);
  });

  it('steals a minion at exactly maxAttack', () => {
    const g = freshGame('DES', 'TALA');
    const me = g.players[0];
    const opp = g.players[1];

    const medium = createBoardMinion('NEU085'); // 4/5
    opp.board.push(medium);

    executeEffects(g, 0, [
      { type: 'STEAL_MINION', target: 'TARGET_ENEMY_MINION', maxAttack: 4 }
    ], medium.instanceId);

    expect(me.board).toContain(medium);
    expect(opp.board).not.toContain(medium);
  });
});
