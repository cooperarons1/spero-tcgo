import type { Keyword, BoardMinion } from '../shared/types.js';
import { getCardDef } from './cards.js';

/** Check if a minion currently has a keyword (accounting for silence) */
export function minionHasKeyword(minion: BoardMinion, keyword: Keyword): boolean {
  if (minion.isSilenced) return false;

  const def = getCardDef(minion.cardCode);
  if (def.keywords.includes(keyword)) return true;

  // Check enchantments for added keywords
  for (const ench of minion.enchantments) {
    if (ench.addedKeywords?.includes(keyword)) return true;
  }

  return false;
}

/** Check if any enemy minion has Taunt */
export function hasActiveTaunt(board: BoardMinion[]): boolean {
  return board.some(m => minionHasKeyword(m, 'TAUNT') && !minionHasKeyword(m, 'STEALTH'));
}

/** Get all Taunt minions on a board */
export function getTauntMinions(board: BoardMinion[]): BoardMinion[] {
  return board.filter(m => minionHasKeyword(m, 'TAUNT') && !minionHasKeyword(m, 'STEALTH'));
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
