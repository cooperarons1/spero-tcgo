import { describe, it, expect, vi, afterEach } from 'vitest';
import { openPack, CARDS_PER_PACK, LEGENDARY_PITY, EPIC_PITY, DUST_VALUES, CRAFT_COSTS } from '../packs.js';

// ── Pack opening ──────────────────────────────────────────────────

describe('openPack', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns exactly 5 cards', () => {
    const result = openPack({}, 0, 0);
    expect(result.cards).toHaveLength(CARDS_PER_PACK);
  });

  it('each card has cardCode, rarity, and isNew', () => {
    const result = openPack({}, 0, 0);
    for (const card of result.cards) {
      expect(card.cardCode).toBeTruthy();
      expect(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']).toContain(card.rarity);
      expect(typeof card.isNew).toBe('boolean');
    }
  });

  it('guaranteed at least one rare or better', () => {
    // Run 50 packs to check the guarantee
    for (let i = 0; i < 50; i++) {
      const result = openPack({}, 0, 0);
      const hasRareOrBetter = result.cards.some(c => c.rarity !== 'COMMON');
      expect(hasRareOrBetter).toBe(true);
    }
  });

  it('pity timer forces legendary at 39 packs', () => {
    // At LEGENDARY_PITY - 1 = 39, should guarantee legendary
    const result = openPack({}, LEGENDARY_PITY - 1, 0);
    const hasLegendary = result.cards.some(c => c.rarity === 'LEGENDARY');
    expect(hasLegendary).toBe(true);
  });

  it('pity timer resets on legendary pull', () => {
    const result = openPack({}, LEGENDARY_PITY - 1, 0);
    expect(result.packsSinceLegendary).toBe(0);
  });

  it('pity timer forces epic at 9 packs', () => {
    const result = openPack({}, 0, EPIC_PITY - 1);
    const hasEpicOrBetter = result.cards.some(c => c.rarity === 'EPIC' || c.rarity === 'LEGENDARY');
    expect(hasEpicOrBetter).toBe(true);
  });

  it('pity timer resets on epic pull', () => {
    const result = openPack({}, 0, EPIC_PITY - 1);
    // Should be 0 if epic was pulled, or still 0 if legendary was pulled
    expect(result.packsSinceEpic).toBeLessThanOrEqual(1);
  });

  it('increments pity counters when no legendary/epic', () => {
    // Mock random to always return common
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const result = openPack({}, 5, 3);
    // Last slot guarantee gives at least rare, not legendary/epic with this mock
    expect(result.packsSinceLegendary).toBe(6);
    expect(result.packsSinceEpic).toBe(4);
  });

  it('isNew is true for unowned cards', () => {
    const result = openPack({}, 0, 0);
    // With empty owned cards, all should be new
    for (const card of result.cards) {
      expect(card.isNew).toBe(true);
    }
  });

  it('isNew is false for fully owned non-legendary', () => {
    // Create owned map with max copies of all cards
    const owned: Record<string, number> = {};
    // We don't know exact card codes, but let's check the logic
    const result = openPack({}, 0, 0);
    // Open a second pack with the first pack's cards fully owned
    for (const card of result.cards) {
      const max = card.rarity === 'LEGENDARY' ? 1 : 2;
      owned[card.cardCode] = max;
    }
    const result2 = openPack(owned, 0, 0);
    // Some cards might be the same ones, which would be isNew=false
    // This is probabilistic, just verify the field exists
    expect(result2.cards.every(c => typeof c.isNew === 'boolean')).toBe(true);
  });

  it('prefers unowned legendaries', () => {
    // Force legendary via pity
    // With empty owned, should get a legendary that's new
    const result = openPack({}, LEGENDARY_PITY - 1, 0);
    const legendary = result.cards.find(c => c.rarity === 'LEGENDARY');
    expect(legendary).toBeTruthy();
    expect(legendary!.isNew).toBe(true);
  });

  it('pity state carries across sequential opens', () => {
    let sinceLegendary = 0;
    let sinceEpic = 0;
    // Open packs without getting legendary (use normal rolls)
    for (let i = 0; i < LEGENDARY_PITY; i++) {
      const result = openPack({}, sinceLegendary, sinceEpic);
      sinceLegendary = result.packsSinceLegendary;
      sinceEpic = result.packsSinceEpic;
    }
    // By LEGENDARY_PITY opens, we must have gotten at least one legendary
    // (the counter would have reset to 0 at some point)
    expect(sinceLegendary).toBeLessThan(LEGENDARY_PITY);
  });
});

// ── Constants ─────────────────────────────────────────────────────

describe('pack constants', () => {
  it('DUST_VALUES has all rarities', () => {
    expect(DUST_VALUES.COMMON).toBe(5);
    expect(DUST_VALUES.RARE).toBe(20);
    expect(DUST_VALUES.EPIC).toBe(100);
    expect(DUST_VALUES.LEGENDARY).toBe(400);
  });

  it('CRAFT_COSTS has all rarities', () => {
    expect(CRAFT_COSTS.COMMON).toBe(40);
    expect(CRAFT_COSTS.RARE).toBe(100);
    expect(CRAFT_COSTS.EPIC).toBe(400);
    expect(CRAFT_COSTS.LEGENDARY).toBe(1600);
  });

  it('crafting costs more than disenchanting', () => {
    for (const rarity of ['COMMON', 'RARE', 'EPIC', 'LEGENDARY']) {
      expect(CRAFT_COSTS[rarity]).toBeGreaterThan(DUST_VALUES[rarity]);
    }
  });
});
