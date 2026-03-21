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
    apEarned: 0,
    missionsLaunched: 0,
    missionsUnblocked: 0,
    cardsPlayed: 0,
    combatTricksUsed: 0,
    damageDealt: 0,
    duelsInitiated: 0,
    blocksAttempted: 0,
    blocksSucceeded: 0,
    buildsFaceDown: 0,
    actionsPlayed: 0,
    stacksLost: 0,
    turnsPlayed: 0,
    buildsUsed: 0,
    missionsBlocked: 0,
  };
}
