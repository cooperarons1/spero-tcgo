import { describe, it, expect } from 'vitest';
import { createBoardMinion } from '../combat.js';
import { minionHasKeyword, hasActiveTaunt, getTauntMinions } from '../keywords.js';
import { getAllCardDefs } from '../cards.js';

/**
 * Combat + keyword tests. Combat is the most error-prone subsystem in
 * the engine (per the morning audit) so anything we can pin down with
 * a unit test is a save against future regressions.
 *
 * These intentionally don't test the full attack() flow — that needs a
 * fully wired GameState with both players, decks, etc. Instead they
 * test the building blocks: createBoardMinion, keyword detection, taunt
 * filtering. The integration-level attack flow can be added later.
 */

describe('createBoardMinion', () => {
  // Find a vanilla minion to test with — first MINION in the catalog
  // that has zero keywords (so we know we're not picking up Charge etc.).
  const all = getAllCardDefs();
  const vanilla = all.find(c => c.type === 'MINION' && c.keywords.length === 0);
  // Find a minion with TAUNT
  const tauntCard = all.find(c => c.type === 'MINION' && c.keywords.includes('TAUNT'));
  // Find a CHARGE minion
  const chargeCard = all.find(c => c.type === 'MINION' && c.keywords.includes('CHARGE'));
  // Find a DIVINE_SHIELD minion
  const dsCard = all.find(c => c.type === 'MINION' && c.keywords.includes('DIVINE_SHIELD'));

  it('vanilla minion starts with summoning sickness (canAttack=false)', () => {
    if (!vanilla) {
      // Card pool has no zero-keyword minion — skip rather than fail
      return;
    }
    const m = createBoardMinion(vanilla.cardCode);
    expect(m.canAttack).toBe(false);
    expect(m.currentAttack).toBe(vanilla.attack);
    expect(m.currentHealth).toBe(vanilla.health);
    expect(m.maxHealth).toBe(vanilla.health);
    expect(m.attacksRemaining).toBe(1);
    expect(m.isFrozen).toBe(false);
    expect(m.isSilenced).toBe(false);
    expect(m.hasDivineShield).toBe(false);
    expect(m.enchantments).toEqual([]);
  });

  it('CHARGE minion starts with canAttack=true (no summoning sickness)', () => {
    if (!chargeCard) return;
    const m = createBoardMinion(chargeCard.cardCode);
    expect(m.canAttack).toBe(true);
  });

  it('DIVINE_SHIELD minion starts with hasDivineShield=true', () => {
    if (!dsCard) return;
    const m = createBoardMinion(dsCard.cardCode);
    expect(m.hasDivineShield).toBe(true);
  });

  it('TAUNT minion is detected by minionHasKeyword(TAUNT)', () => {
    if (!tauntCard) return;
    const m = createBoardMinion(tauntCard.cardCode);
    expect(minionHasKeyword(m, 'TAUNT')).toBe(true);
  });

  it('silenced TAUNT minion no longer has TAUNT', () => {
    if (!tauntCard) return;
    const m = createBoardMinion(tauntCard.cardCode);
    m.isSilenced = true;
    expect(minionHasKeyword(m, 'TAUNT')).toBe(false);
  });

  it('every createBoardMinion gets a unique instanceId', () => {
    if (!vanilla) return;
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const m = createBoardMinion(vanilla.cardCode);
      expect(ids.has(m.instanceId), `duplicate instanceId ${m.instanceId} on iter ${i}`).toBe(false);
      ids.add(m.instanceId);
    }
  });
});

describe('taunt filtering', () => {
  const all = getAllCardDefs();
  const vanilla = all.find(c => c.type === 'MINION' && c.keywords.length === 0);
  const tauntCard = all.find(c => c.type === 'MINION' && c.keywords.includes('TAUNT'));

  it('hasActiveTaunt is false on a board with only vanilla minions', () => {
    if (!vanilla) return;
    const board = [
      createBoardMinion(vanilla.cardCode),
      createBoardMinion(vanilla.cardCode),
    ];
    expect(hasActiveTaunt(board)).toBe(false);
  });

  it('hasActiveTaunt is true when one minion has TAUNT', () => {
    if (!vanilla || !tauntCard) return;
    const board = [
      createBoardMinion(vanilla.cardCode),
      createBoardMinion(tauntCard.cardCode),
    ];
    expect(hasActiveTaunt(board)).toBe(true);
  });

  it('getTauntMinions returns only the taunt subset', () => {
    if (!vanilla || !tauntCard) return;
    const board = [
      createBoardMinion(vanilla.cardCode),
      createBoardMinion(tauntCard.cardCode),
      createBoardMinion(vanilla.cardCode),
    ];
    const taunts = getTauntMinions(board);
    expect(taunts).toHaveLength(1);
    expect(minionHasKeyword(taunts[0], 'TAUNT')).toBe(true);
  });

  it('hasActiveTaunt false on an empty board', () => {
    expect(hasActiveTaunt([])).toBe(false);
  });
});
