import { describe, it, expect } from 'vitest';
import { getAllCardDefs } from '../cards.js';

/**
 * Data-integrity tests for weapon cards. The mulligan screen, weapon
 * slot render, and inventory pack flow all assume every WEAPON card
 * has valid attack + health (durability) fields set. If a data edit
 * silently zeroes those, the mulligan shows blank badges and the
 * weapon slot renders 0/0.
 *
 * These tests run against data/cards.json through getAllCardDefs()
 * so they fail fast on ship if the data regresses.
 */

describe('weapon card data integrity', () => {
  const all = getAllCardDefs();
  const weapons = all.filter(c => c.type === 'WEAPON');

  it('has at least one weapon in the pool', () => {
    expect(weapons.length).toBeGreaterThan(0);
  });

  it('every weapon has attack >= 1', () => {
    for (const w of weapons) {
      expect(w.attack, `${w.cardCode} ${w.name} attack`).toBeGreaterThanOrEqual(1);
    }
  });

  it('every weapon has durability (health) >= 1', () => {
    for (const w of weapons) {
      expect(w.health, `${w.cardCode} ${w.name} durability`).toBeGreaterThanOrEqual(1);
    }
  });

  it('every weapon has a heroClass (weapons are class-locked or neutral)', () => {
    const validClasses = new Set([
      'JIMMY', 'TALA', 'DEREK', 'ANDERS', 'DES',
      'ASTRID', 'AVA', 'LUCAS', 'IZZY', 'NEUTRAL',
    ]);
    for (const w of weapons) {
      expect(validClasses.has(w.heroClass), `${w.cardCode} ${w.name} heroClass=${w.heroClass}`).toBe(true);
    }
  });

  it('every weapon has a non-negative manaCost', () => {
    for (const w of weapons) {
      expect(w.manaCost, `${w.cardCode} ${w.name} manaCost`).toBeGreaterThanOrEqual(0);
    }
  });
});
