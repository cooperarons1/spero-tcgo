import { describe, it, expect, beforeEach } from 'vitest';
import { createGame, confirmMulligan } from '../game.js';
import { attack, createBoardMinion } from '../combat.js';
import { resetInstanceCounter, resetTransientCounters } from '../deck.js';
import type { GameState, HeroClass } from '../../shared/types.js';

/**
 * LIFESTEAL + DES040 Dominion Control Rod wiring coverage.
 *
 * LIFESTEAL is the sustain keyword applied to several DES minions
 * during the 2026-04-22 balance pass. DES040 is a 1/4 weapon with the
 * on-hero-attack trigger "deal 1 damage to all enemy minions".
 */

beforeEach(() => {
  resetInstanceCounter();
  resetTransientCounters();
});

function freshGame(myClass: HeroClass = 'DES', oppClass: HeroClass = 'TALA'): GameState {
  const g = createGame(
    [
      { id: 'p1', name: 'Alice', heroClass: myClass },
      { id: 'p2', name: 'Bob', heroClass: oppClass },
    ],
    { firstPlayerIndex: 0 }
  );
  confirmMulligan(g, 'p1', g.players[0].hand.map(() => false));
  confirmMulligan(g, 'p2', g.players[1].hand.map(() => false));
  return g;
}

describe('LIFESTEAL keyword', () => {
  it('heals the attacker by damage dealt when attacking an enemy minion', () => {
    const g = freshGame('DES', 'TALA');
    // Wound DES so there's room to heal
    g.players[0].health = 20;
    const me = g.players[0];
    const opp = g.players[1];
    // Romulus (DES029) is a 5/5 LIFESTEAL minion per the 2026-04-22 patch
    const attacker = createBoardMinion('DES029');
    attacker.canAttack = true;
    me.board.push(attacker);
    const target = createBoardMinion('NEU099');
    opp.board.push(target);
    const before = me.health;

    const res = attack(g, 'p1', attacker.instanceId, target.instanceId);
    expect(res.success).toBe(true);

    // LIFESTEAL heals by the attacker's damage (attacker.currentAttack = 5)
    expect(me.health).toBeGreaterThan(before);
    expect(me.health).toBeLessThanOrEqual(me.maxHealth);
  });

  it('heals when attacking the enemy hero', () => {
    const g = freshGame('DES', 'TALA');
    g.players[0].health = 20;
    const me = g.players[0];
    const attacker = createBoardMinion('DES029');
    attacker.canAttack = true;
    me.board.push(attacker);

    const res = attack(g, 'p1', attacker.instanceId, 'hero-1');
    expect(res.success).toBe(true);
    expect(me.health).toBe(20 + 5); // DES029 attack = 5
  });

  it('does not heal past maxHealth', () => {
    const g = freshGame('DES', 'TALA');
    const me = g.players[0];
    const opp = g.players[1];
    me.health = me.maxHealth; // already full
    const attacker = createBoardMinion('DES029');
    attacker.canAttack = true;
    me.board.push(attacker);
    const target = createBoardMinion('NEU099');
    opp.board.push(target);

    attack(g, 'p1', attacker.instanceId, target.instanceId);
    expect(me.health).toBe(me.maxHealth);
  });

  it('does not heal when LIFESTEAL minion is silenced', () => {
    const g = freshGame('DES', 'TALA');
    g.players[0].health = 20;
    const me = g.players[0];
    const opp = g.players[1];
    const attacker = createBoardMinion('DES029');
    attacker.canAttack = true;
    attacker.isSilenced = true;
    me.board.push(attacker);
    const target = createBoardMinion('NEU099');
    opp.board.push(target);

    attack(g, 'p1', attacker.instanceId, target.instanceId);
    expect(me.health).toBe(20); // no heal
  });
});

describe('DES040 Dominion Control Rod', () => {
  it('deals 1 damage to all enemy minions after hero attacks', () => {
    const g = freshGame('DES', 'TALA');
    const me = g.players[0];
    const opp = g.players[1];
    // Equip Dominion Control Rod (1/4 weapon, 2 mana)
    me.weapon = { cardCode: 'DES040', currentAttack: 1, durability: 4 };
    me.heroAttacksRemaining = 1;
    me.heroAttackThisTurn = 0;

    // Two non-Taunt enemy minions (NEU085 Pierre and NEU066 Chomp) so
    // the hero can attack past them to face.
    const m1 = createBoardMinion('NEU085'); // 4/5 vanilla
    const m2 = createBoardMinion('NEU066'); // 4/4 BC: Deal 2 damage to all other minions — already resolved since we're pushing directly
    opp.board.push(m1, m2);
    const h1_before = m1.currentHealth;
    const h2_before = m2.currentHealth;

    const res = attack(g, 'p1', `hero-0`, 'hero-1');
    expect(res.success).toBe(true);

    // Both enemy minions took 1 damage from the rod's after-attack trigger
    expect(m1.currentHealth).toBe(h1_before - 1);
    expect(m2.currentHealth).toBe(h2_before - 1);
  });

  it('only fires on hero attacks, not minion attacks', () => {
    const g = freshGame('DES', 'TALA');
    const me = g.players[0];
    const opp = g.players[1];
    // Player equips rod but attacks with a minion, not the hero
    me.weapon = { cardCode: 'DES040', currentAttack: 1, durability: 4 };
    const attacker = createBoardMinion('NEU085');
    attacker.canAttack = true;
    me.board.push(attacker);
    const bystander = createBoardMinion('NEU085'); // non-taunt
    opp.board.push(bystander);
    const bystanderHp = bystander.currentHealth;

    const res = attack(g, 'p1', attacker.instanceId, 'hero-1');
    expect(res.success).toBe(true);

    // Bystander did NOT take the +1 AOE because the attack came from a
    // minion, not the hero.
    expect(bystander.currentHealth).toBe(bystanderHp);
  });
});
