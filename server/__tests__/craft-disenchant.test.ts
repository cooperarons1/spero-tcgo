import { describe, it, expect } from 'vitest';
import { craftCard, disenchantCard, CRAFT_COSTS, DUST_VALUES } from '../packs.js';

/**
 * Pure craft + disenchant logic extracted from shop.ts handler. These
 * tests pin down the economic invariants (cost, cap, refund value)
 * independently of the Firestore tx.
 */

describe('craftCard', () => {
  it('COMMON craft costs 40 dust and increments ownership', () => {
    const r = craftCard({
      cardCode: 'NEU065', rarity: 'COMMON',
      currentDust: 100, ownedCards: {},
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cost).toBe(40);
    expect(r.newDust).toBe(60);
    expect(r.newCount).toBe(1);
    expect(r.newOwnedCards['NEU065']).toBe(1);
  });

  it('LEGENDARY craft costs 1600 dust', () => {
    const r = craftCard({
      cardCode: 'NEU107', rarity: 'LEGENDARY',
      currentDust: 2000, ownedCards: {},
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cost).toBe(1600);
    expect(r.newDust).toBe(400);
  });

  it('RARE costs 100, EPIC costs 400', () => {
    expect(CRAFT_COSTS.RARE).toBe(100);
    expect(CRAFT_COSTS.EPIC).toBe(400);
  });

  it('rejects when dust < cost', () => {
    const r = craftCard({
      cardCode: 'NEU107', rarity: 'LEGENDARY',
      currentDust: 1599, ownedCards: {},
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('Not enough dust');
  });

  it('rejects crafting at COMMON cap (2)', () => {
    const r = craftCard({
      cardCode: 'NEU065', rarity: 'COMMON',
      currentDust: 100, ownedCards: { NEU065: 2 },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('Already own max copies');
  });

  it('rejects crafting at LEGENDARY cap (1)', () => {
    const r = craftCard({
      cardCode: 'NEU107', rarity: 'LEGENDARY',
      currentDust: 2000, ownedCards: { NEU107: 1 },
    });
    expect(r.ok).toBe(false);
  });

  it('does not mutate the input ownedCards (immutability)', () => {
    const owned = { NEU065: 1 };
    craftCard({
      cardCode: 'NEU065', rarity: 'COMMON',
      currentDust: 100, ownedCards: owned,
    });
    expect(owned.NEU065).toBe(1);  // input unchanged
  });

  it('unknown rarity falls back to 40 dust', () => {
    const r = craftCard({
      cardCode: 'WEIRD', rarity: 'MYTHIC' as any,
      currentDust: 100, ownedCards: {},
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cost).toBe(40);
  });
});

describe('disenchantCard', () => {
  it('COMMON disenchant refunds 5 dust and decrements ownership', () => {
    const r = disenchantCard({
      cardCode: 'NEU065', rarity: 'COMMON',
      currentDust: 0, ownedCards: { NEU065: 1 },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dustGained).toBe(5);
    expect(r.newDust).toBe(5);
    expect(r.newCount).toBe(0);
    expect(r.newOwnedCards['NEU065']).toBe(0);
  });

  it('LEGENDARY disenchant refunds 400 dust', () => {
    const r = disenchantCard({
      cardCode: 'NEU107', rarity: 'LEGENDARY',
      currentDust: 100, ownedCards: { NEU107: 1 },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dustGained).toBe(400);
    expect(r.newDust).toBe(500);
  });

  it('RARE refunds 20, EPIC refunds 100', () => {
    expect(DUST_VALUES.RARE).toBe(20);
    expect(DUST_VALUES.EPIC).toBe(100);
  });

  it('rejects when not owned', () => {
    const r = disenchantCard({
      cardCode: 'NEU065', rarity: 'COMMON',
      currentDust: 0, ownedCards: {},
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("don't own");
  });

  it('rejects when count is 0', () => {
    const r = disenchantCard({
      cardCode: 'NEU065', rarity: 'COMMON',
      currentDust: 0, ownedCards: { NEU065: 0 },
    });
    expect(r.ok).toBe(false);
  });

  it('allows disenchanting down from 2 → 1 for COMMON', () => {
    const r = disenchantCard({
      cardCode: 'NEU065', rarity: 'COMMON',
      currentDust: 0, ownedCards: { NEU065: 2 },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newCount).toBe(1);
  });

  it('does not mutate the input ownedCards', () => {
    const owned = { NEU065: 2 };
    disenchantCard({
      cardCode: 'NEU065', rarity: 'COMMON',
      currentDust: 0, ownedCards: owned,
    });
    expect(owned.NEU065).toBe(2);
  });
});

describe('craft ↔ disenchant economy math', () => {
  it('crafting then disenchanting loses 35 dust per COMMON', () => {
    // Crafting costs 40, disenchanting refunds 5 — net loss 35.
    const craft = craftCard({
      cardCode: 'NEU065', rarity: 'COMMON',
      currentDust: 40, ownedCards: {},
    });
    expect(craft.ok).toBe(true);
    if (!craft.ok) return;
    const disenchant = disenchantCard({
      cardCode: 'NEU065', rarity: 'COMMON',
      currentDust: craft.newDust, ownedCards: craft.newOwnedCards,
    });
    expect(disenchant.ok).toBe(true);
    if (!disenchant.ok) return;
    expect(disenchant.newDust).toBe(5);   // started 40, ended 5
  });

  it('disenchant value is always < craft cost (no infinite dust farm)', () => {
    for (const rarity of ['COMMON', 'RARE', 'EPIC', 'LEGENDARY']) {
      expect(DUST_VALUES[rarity]).toBeLessThan(CRAFT_COSTS[rarity]);
    }
  });
});
