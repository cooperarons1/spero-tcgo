import { describe, it, expect } from 'vitest';
import { getAllCardDefs, getCardDef, getCardsByClass } from '../cards.js';

/**
 * Smoke + invariant tests for the static card catalog at data/cards.json.
 *
 * These run on every commit so a malformed card def lands as a test
 * failure instead of as an in-game runtime crash. The catalog has ~319
 * cards across 9 hero classes; an unrecognized field or a missing
 * cardCode would otherwise only show up the first time a player drew
 * the card in question.
 */

const REQUIRED_FIELDS = [
  'cardCode',
  'name',
  'manaCost',
  'type',
  'rarity',
  'heroClass',
  'keywords',
] as const;

const VALID_TYPES = ['MINION', 'SPELL', 'WEAPON', 'LOCATION'] as const;
const VALID_RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;
const VALID_HERO_CLASSES = [
  'NEUTRAL',
  'DEREK',
  'TALA',
  'JIMMY',
  'ANDERS',
  'DES',
  'ASTRID',
  'AVA',
  'LUCAS',
  'IZZY',
] as const;

describe('card catalog', () => {
  const all = getAllCardDefs();

  it('loads at least one card', () => {
    expect(all.length).toBeGreaterThan(0);
  });

  it('every card has every required field', () => {
    for (const c of all) {
      for (const field of REQUIRED_FIELDS) {
        expect(c[field], `${c.cardCode ?? '<unknown>'}.${field}`).toBeDefined();
      }
    }
  });

  it('every cardCode is unique', () => {
    const seen = new Set<string>();
    for (const c of all) {
      expect(seen.has(c.cardCode), `duplicate cardCode ${c.cardCode}`).toBe(false);
      seen.add(c.cardCode);
    }
  });

  it('every type is one of the four legal types', () => {
    for (const c of all) {
      expect(VALID_TYPES, `${c.cardCode} type ${c.type}`).toContain(c.type);
    }
  });

  it('every rarity is one of the four legal rarities', () => {
    for (const c of all) {
      expect(VALID_RARITIES, `${c.cardCode} rarity ${c.rarity}`).toContain(c.rarity);
    }
  });

  it('every heroClass is in the canonical 10-entry whitelist', () => {
    for (const c of all) {
      expect(VALID_HERO_CLASSES, `${c.cardCode} heroClass ${c.heroClass}`).toContain(c.heroClass);
    }
  });

  it('mana cost is a non-negative integer in [0, 12]', () => {
    for (const c of all) {
      expect(Number.isInteger(c.manaCost), `${c.cardCode} non-int manaCost ${c.manaCost}`).toBe(true);
      expect(c.manaCost).toBeGreaterThanOrEqual(0);
      expect(c.manaCost).toBeLessThanOrEqual(12);
    }
  });

  it('every minion has attack and health both >= 0', () => {
    for (const c of all) {
      if (c.type !== 'MINION') continue;
      expect(c.attack ?? -1, `${c.cardCode} minion attack`).toBeGreaterThanOrEqual(0);
      expect(c.health ?? -1, `${c.cardCode} minion health`).toBeGreaterThanOrEqual(1);
    }
  });

  it('keywords is always an array', () => {
    for (const c of all) {
      expect(Array.isArray(c.keywords), `${c.cardCode} keywords not array`).toBe(true);
    }
  });

  it('getCardDef throws on unknown cardCode', () => {
    expect(() => getCardDef('NOPE-DOES-NOT-EXIST')).toThrow();
  });

  it('every hero class has at least 15 cards (catalog completeness)', () => {
    const classes = ['DEREK', 'TALA', 'JIMMY', 'ANDERS', 'DES', 'ASTRID', 'AVA', 'LUCAS', 'IZZY'] as const;
    for (const cls of classes) {
      const cards = getCardsByClass(cls);
      expect(cards.length, `${cls} card count`).toBeGreaterThanOrEqual(15);
    }
  });

  it('NEUTRAL pool has at least 30 cards', () => {
    const neutral = getCardsByClass('NEUTRAL');
    expect(neutral.length).toBeGreaterThanOrEqual(30);
  });
});
