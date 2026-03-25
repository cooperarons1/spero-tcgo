import type { GameState, LogCategory, PlayerStats } from '../shared/types.js';

export function addLog(
  game: GameState,
  playerIndex: 0 | 1 | null,
  message: string,
  category: LogCategory
): void {
  game.log.push({
    id: game.log.length,
    turnNumber: game.turnNumber,
    playerIndex,
    message,
    category,
  });
}

export function emptyStats(): PlayerStats {
  return {
    minionsPlayed: 0,
    spellsCast: 0,
    weaponsEquipped: 0,
    locationsPlayed: 0,
    heroPowerUses: 0,
    minionsKilled: 0,
    damageDealtToHeroes: 0,
    damageDealtToMinions: 0,
    healingDone: 0,
    cardsDrawn: 0,
    turnsPlayed: 0,
    manaSpent: 0,
  };
}
