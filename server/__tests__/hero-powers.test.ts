import { describe, it, expect, beforeEach } from 'vitest';
import { createGame, confirmMulligan } from '../game.js';
import { useHeroPower } from '../actions.js';
import { resetInstanceCounter, resetTransientCounters } from '../deck.js';
import { createBoardMinion } from '../combat.js';
import type { GameState, HeroClass } from '../../shared/types.js';
import { HERO_POWER_COST, STARTING_HEALTH } from '../../shared/types.js';

/**
 * Hero-power correctness tests for the HS-classic mapping.
 *   JIMMY=Hunter, IZZY=Mage, ASTRID=Rogue, TALA=Priest, ANDERS=Warrior,
 *   AVA=Paladin, LUCAS=Shaman, DES=Warlock, DEREK=Druid.
 *
 * Each test spins a fresh game, gives the acting player enough mana, and
 * asserts the correct side-effect. Shared invariants (cost, once-per-turn
 * gate) live in the first two describes.
 */

beforeEach(() => {
  resetInstanceCounter();
  resetTransientCounters();
});

function freshGame(myClass: HeroClass, oppClass: HeroClass = 'TALA'): GameState {
  const g = createGame(
    [
      { id: 'p1', name: 'Alice', heroClass: myClass },
      { id: 'p2', name: 'Bob', heroClass: oppClass },
    ],
    { firstPlayerIndex: 0 }
  );
  confirmMulligan(g, 'p1', g.players[0].hand.map(() => false));
  confirmMulligan(g, 'p2', g.players[1].hand.map(() => false));
  // Ensure enough mana to fire
  g.players[0].mana = HERO_POWER_COST;
  g.players[0].maxMana = HERO_POWER_COST;
  return g;
}

describe('hero power — shared invariants', () => {
  it('spends 2 mana', () => {
    const g = freshGame('ANDERS');
    g.players[0].mana = 5;
    useHeroPower(g, 'p1', null);
    expect(g.players[0].mana).toBe(5 - HERO_POWER_COST);
  });

  it('cannot be used twice in one turn', () => {
    const g = freshGame('ANDERS');
    g.players[0].mana = 10;
    const first = useHeroPower(g, 'p1', null);
    expect(first.success).toBe(true);
    const second = useHeroPower(g, 'p1', null);
    expect(second.success).toBe(false);
  });

  it('fails when caster has <2 mana', () => {
    const g = freshGame('ANDERS');
    g.players[0].mana = 1;
    const r = useHeroPower(g, 'p1', null);
    expect(r.success).toBe(false);
  });
});

describe('JIMMY — Steady Shot', () => {
  it('deals 2 damage to the enemy hero, no picker', () => {
    const g = freshGame('JIMMY');
    const oppHp = g.players[1].health;
    const r = useHeroPower(g, 'p1', null);
    expect(r.success).toBe(true);
    expect(g.players[1].health).toBe(oppHp - 2);
  });
});

describe('IZZY — Fireblast', () => {
  it('requires a target', () => {
    const g = freshGame('IZZY');
    const r = useHeroPower(g, 'p1', null);
    expect(r.needsTarget).toBe(true);
  });

  it('deals 1 damage to the chosen hero', () => {
    const g = freshGame('IZZY');
    const oppHp = g.players[1].health;
    useHeroPower(g, 'p1', 'hero-1');
    expect(g.players[1].health).toBe(oppHp - 1);
  });
});

describe('ASTRID — Dagger Mastery', () => {
  it('equips a 1/2 Wicked Knife', () => {
    const g = freshGame('ASTRID');
    useHeroPower(g, 'p1', null);
    expect(g.players[0].weapon?.cardCode).toBe('AST_TOKEN_DAGGER');
    expect(g.players[0].weapon?.currentAttack).toBe(1);
    expect(g.players[0].weapon?.durability).toBe(2);
  });

  it('replaces an existing weapon', () => {
    const g = freshGame('ASTRID');
    g.players[0].weapon = { cardCode: 'FAKE_WEAPON', currentAttack: 3, durability: 3 };
    useHeroPower(g, 'p1', null);
    expect(g.players[0].weapon?.cardCode).toBe('AST_TOKEN_DAGGER');
  });
});

describe('TALA — Lesser Heal', () => {
  it('restores 2 to chosen hero, capped at maxHealth', () => {
    const g = freshGame('TALA');
    g.players[0].health = 20;
    useHeroPower(g, 'p1', 'hero-0');
    expect(g.players[0].health).toBe(22);
  });

  it('does not overheal', () => {
    const g = freshGame('TALA');
    g.players[0].health = STARTING_HEALTH - 1;
    useHeroPower(g, 'p1', 'hero-0');
    expect(g.players[0].health).toBe(STARTING_HEALTH);
  });
});

describe('ANDERS — Armor Up!', () => {
  it('grants 2 armor, no target', () => {
    const g = freshGame('ANDERS');
    const before = g.players[0].armor;
    useHeroPower(g, 'p1', null);
    expect(g.players[0].armor).toBe(before + 2);
  });
});

describe('AVA — Reinforce', () => {
  it('summons a 1/1 Silver Hand Recruit', () => {
    const g = freshGame('AVA');
    const before = g.players[0].board.length;
    useHeroPower(g, 'p1', null);
    expect(g.players[0].board.length).toBe(before + 1);
    const summoned = g.players[0].board[g.players[0].board.length - 1];
    expect(summoned.cardCode).toBe('NEU_TOKEN_RECRUIT');
  });

  it('fails when board is full', () => {
    const g = freshGame('AVA');
    for (let i = 0; i < 7; i++) {
      g.players[0].board.push(createBoardMinion('NEU_TOKEN_RECRUIT', 0));
    }
    const r = useHeroPower(g, 'p1', null);
    expect(r.success).toBe(false);
  });
});

describe('LUCAS — Totemic Call', () => {
  it('summons one of four orbs', () => {
    const g = freshGame('LUCAS');
    useHeroPower(g, 'p1', null);
    const summoned = g.players[0].board[0];
    expect(['LUC_ORB_FIRE', 'LUC_ORB_WATER', 'LUC_ORB_AIR', 'LUC_ORB_HEALING']).toContain(summoned.cardCode);
  });

  it('does not summon a duplicate orb', () => {
    const g = freshGame('LUCAS');
    g.players[0].board.push(createBoardMinion('LUC_ORB_FIRE', 0));
    g.players[0].board.push(createBoardMinion('LUC_ORB_WATER', 0));
    g.players[0].board.push(createBoardMinion('LUC_ORB_AIR', 0));
    // Only Healing orb remains
    useHeroPower(g, 'p1', null);
    expect(g.players[0].board[3].cardCode).toBe('LUC_ORB_HEALING');
  });

  it('fails when all four orbs are already summoned', () => {
    const g = freshGame('LUCAS');
    for (const code of ['LUC_ORB_FIRE', 'LUC_ORB_WATER', 'LUC_ORB_AIR', 'LUC_ORB_HEALING']) {
      g.players[0].board.push(createBoardMinion(code, 0));
    }
    const r = useHeroPower(g, 'p1', null);
    expect(r.success).toBe(false);
  });
});

describe('DES — Life Tap', () => {
  it('draws 1 card and deals 2 damage to self', () => {
    const g = freshGame('DES');
    const handBefore = g.players[0].hand.length;
    const hpBefore = g.players[0].health;
    useHeroPower(g, 'p1', null);
    expect(g.players[0].hand.length).toBe(handBefore + 1);
    expect(g.players[0].health).toBe(hpBefore - 2);
  });
});

describe('DEREK — Shapeshift', () => {
  it('grants +1 attack this turn and +1 armor', () => {
    const g = freshGame('DEREK');
    const atkBefore = g.players[0].heroAttackThisTurn ?? 0;
    const armorBefore = g.players[0].armor;
    useHeroPower(g, 'p1', null);
    expect(g.players[0].heroAttackThisTurn).toBe(atkBefore + 1);
    expect(g.players[0].armor).toBe(armorBefore + 1);
  });
});
