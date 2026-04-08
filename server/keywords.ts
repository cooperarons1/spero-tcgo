import type { Keyword, BoardMinion } from '../shared/types.js';
import { getCardDef } from './cards.js';

/**
 * P2: cache the resolved card definition on the minion the first time it's
 * looked up. The hot AI loop calls minionHasKeyword thousands of times per
 * turn (taunt checks, divine shield checks, sort comparators) and each call
 * was doing a fresh Map lookup + def access. The closure here keeps things
 * type-safe without polluting BoardMinion's public type.
 */
function getCardDefCached(minion: BoardMinion): ReturnType<typeof getCardDef> {
  // Stash on a hidden property; non-enumerable so JSON.stringify ignores it.
  const m = minion as BoardMinion & { __def?: ReturnType<typeof getCardDef> };
  if (m.__def) return m.__def;
  const def = getCardDef(minion.cardCode);
  Object.defineProperty(m, '__def', {
    value: def,
    enumerable: false,
    writable: true,
    configurable: true,
  });
  return def;
}

/** Check if a minion currently has a keyword (accounting for silence) */
export function minionHasKeyword(minion: BoardMinion, keyword: Keyword): boolean {
  if (minion.isSilenced) return false;

  const def = getCardDefCached(minion);
  if (def.keywords.includes(keyword)) return true;

  // Check enchantments for added keywords
  for (const ench of minion.enchantments) {
    if (ench.addedKeywords?.includes(keyword)) return true;
  }

  return false;
}

/** Check if any enemy minion has Taunt */
export function hasActiveTaunt(board: BoardMinion[]): boolean {
  return board.some(m => minionHasKeyword(m, 'TAUNT') && !m.hasStealthUntilAttack);
}

/** Get all Taunt minions on a board */
export function getTauntMinions(board: BoardMinion[]): BoardMinion[] {
  return board.filter(m => minionHasKeyword(m, 'TAUNT') && !m.hasStealthUntilAttack);
}

/** Check if a minion can be targeted (not Stealthed) */
export function canBeTargeted(minion: BoardMinion): boolean {
  return !minion.hasStealthUntilAttack;
}

/** Apply summoning sickness rules based on keywords */
export function applySummonRules(minion: BoardMinion): void {
  if (minionHasKeyword(minion, 'CHARGE')) {
    minion.canAttack = true;
  }
  if (minionHasKeyword(minion, 'WINDFURY')) {
    minion.attacksRemaining = 2;
  }
  if (minionHasKeyword(minion, 'STEALTH')) {
    minion.hasStealthUntilAttack = true;
  }
}
