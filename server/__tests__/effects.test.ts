import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyDamageToMinion,
  applyDamageToHero,
  silenceMinion,
} from '../effects.js';
import { createBoardMinion } from '../combat.js';
import { resetInstanceCounter, resetTransientCounters } from '../deck.js';
import { getAllCardDefs } from '../cards.js';
import type { PlayerState, BoardMinion } from '../../shared/types.js';
import { STARTING_HEALTH } from '../../shared/types.js';

/**
 * Effects subsystem tests. The audit flagged effects as the most
 * complex/error-prone subsystem in the engine. Damage application,
 * divine-shield-pop, armor absorption, and silence cleanup are the
 * primitives most other effects build on, so they get covered first.
 */

beforeEach(() => {
  resetInstanceCounter();
  resetTransientCounters();
});

function makeHero(): PlayerState {
  return {
    playerId: 'p',
    playerName: 'Test',
    heroClass: 'DEREK',
    health: STARTING_HEALTH,
    maxHealth: STARTING_HEALTH,
    armor: 0,
    mana: 0,
    maxMana: 0,
    hand: [],
    board: [],
    weapon: null,
    locations: [],
    heroPowerUsed: false,
    heroAttackThisTurn: 0,
    heroAttacksRemaining: 1,
    fatigueDamage: 0,
    graveyard: [],
    secrets: [],
    heroPowerUpgraded: false,
    upgradeProgress: 0,
    spellDiscount: 0,
  };
}

describe('applyDamageToMinion', () => {
  const all = getAllCardDefs();
  const vanillaMinion = all.find(c => c.type === 'MINION' && c.keywords.length === 0 && c.health >= 5);
  const dsMinion = all.find(c => c.type === 'MINION' && c.keywords.includes('DIVINE_SHIELD'));

  it('reduces currentHealth by the damage amount', () => {
    if (!vanillaMinion) return;
    const m = createBoardMinion(vanillaMinion.cardCode);
    const hpBefore = m.currentHealth;
    applyDamageToMinion(m, 2);
    expect(m.currentHealth).toBe(hpBefore - 2);
  });

  it('does nothing for zero or negative damage', () => {
    if (!vanillaMinion) return;
    const m = createBoardMinion(vanillaMinion.cardCode);
    const hpBefore = m.currentHealth;
    applyDamageToMinion(m, 0);
    applyDamageToMinion(m, -5);
    expect(m.currentHealth).toBe(hpBefore);
  });

  it('divine shield absorbs the first damage and pops', () => {
    if (!dsMinion) return;
    const m = createBoardMinion(dsMinion.cardCode);
    expect(m.hasDivineShield).toBe(true);
    const hpBefore = m.currentHealth;
    applyDamageToMinion(m, 5);
    expect(m.hasDivineShield).toBe(false);
    expect(m.currentHealth).toBe(hpBefore); // shield ate it
  });

  it('after divine shield pop, second damage hits health', () => {
    if (!dsMinion) return;
    const m = createBoardMinion(dsMinion.cardCode);
    applyDamageToMinion(m, 1); // pops shield
    const hpAfterPop = m.currentHealth;
    applyDamageToMinion(m, 2); // hits health
    expect(m.currentHealth).toBe(hpAfterPop - 2);
  });
});

describe('applyDamageToHero', () => {
  it('reduces health by damage amount', () => {
    const h = makeHero();
    applyDamageToHero(h, 4);
    expect(h.health).toBe(STARTING_HEALTH - 4);
  });

  it('armor absorbs damage first, then overflow goes to health', () => {
    const h = makeHero();
    h.armor = 3;
    applyDamageToHero(h, 5);
    expect(h.armor).toBe(0);
    expect(h.health).toBe(STARTING_HEALTH - 2); // 5 dmg - 3 armor = 2 to face
  });

  it('armor that exceeds damage absorbs all and is partly consumed', () => {
    const h = makeHero();
    h.armor = 10;
    applyDamageToHero(h, 4);
    expect(h.armor).toBe(6);
    expect(h.health).toBe(STARTING_HEALTH);
  });

  it('does nothing for zero damage', () => {
    const h = makeHero();
    h.armor = 5;
    applyDamageToHero(h, 0);
    expect(h.armor).toBe(5);
    expect(h.health).toBe(STARTING_HEALTH);
  });
});

describe('silenceMinion', () => {
  const all = getAllCardDefs();
  const dsMinion = all.find(c => c.type === 'MINION' && c.keywords.includes('DIVINE_SHIELD'));
  const tauntMinion = all.find(c => c.type === 'MINION' && c.keywords.includes('TAUNT'));

  it('clears divine shield', () => {
    if (!dsMinion) return;
    const m = createBoardMinion(dsMinion.cardCode);
    expect(m.hasDivineShield).toBe(true);
    silenceMinion(m);
    expect(m.hasDivineShield).toBe(false);
    expect(m.isSilenced).toBe(true);
  });

  it('clears frozen state', () => {
    if (!tauntMinion) return;
    const m = createBoardMinion(tauntMinion.cardCode);
    m.isFrozen = true;
    silenceMinion(m);
    expect(m.isFrozen).toBe(false);
  });

  it('clears stealth-until-attack', () => {
    if (!tauntMinion) return;
    const m = createBoardMinion(tauntMinion.cardCode);
    m.hasStealthUntilAttack = true;
    silenceMinion(m);
    expect(m.hasStealthUntilAttack).toBe(false);
  });

  it('strips enchantments and resets stats to base', () => {
    if (!tauntMinion) return;
    const m = createBoardMinion(tauntMinion.cardCode);
    const baseAttack = m.currentAttack;
    const baseMaxHp = m.maxHealth;
    // Add a buff
    m.currentAttack += 3;
    m.maxHealth += 3;
    m.currentHealth += 3;
    m.enchantments.push({ source: 'TEST', attackMod: 3, healthMod: 3 });
    silenceMinion(m);
    expect(m.currentAttack).toBe(baseAttack);
    expect(m.maxHealth).toBe(baseMaxHp);
    expect(m.enchantments).toEqual([]);
  });
});
