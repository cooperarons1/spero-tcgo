import type { GameState } from '../shared/types.js';
import { addLog } from './log.js';

/**
 * Hero Power Upgrade Conditions — checked after relevant game events.
 * Each hero has a condition tracked via upgradeProgress + playerStats:
 *   Jimmy: Kill 3 enemy minions
 *   Tala: Heal 10+ total HP
 *   Derek: Draw 5+ cards from effects
 *   Anders: Freeze 4+ minions (upgradeProgress)
 *   Des: Destroy 4 enemy minions
 *   Astrid: Have 3+ Divine Shield minions at once
 *   Ava: Summon 8+ minions total
 *   Lucas: Return 3+ enemy minions (upgradeProgress)
 *   Izzy: Gain 10+ armor total (upgradeProgress)
 */
export function checkHeroPowerUpgrade(game: GameState, playerIndex: 0 | 1): void {
  const player = game.players[playerIndex];
  if (player.heroPowerUpgraded) return;

  const stats = game.playerStats[playerIndex];
  let shouldUpgrade = false;

  switch (player.heroClass) {
    case 'JIMMY':
      if (stats.minionsKilled >= 3) shouldUpgrade = true;
      break;
    case 'TALA':
      if (stats.healingDone >= 10) shouldUpgrade = true;
      break;
    case 'DEREK':
      if (stats.cardsDrawnFromEffects >= 5) shouldUpgrade = true;
      break;
    case 'ANDERS':
      if (player.upgradeProgress >= 4) shouldUpgrade = true;
      break;
    case 'DES':
      if (stats.minionsKilled >= 4) shouldUpgrade = true;
      break;
    case 'ASTRID':
      if (player.board.filter(m => m.hasDivineShield).length >= 3) shouldUpgrade = true;
      break;
    case 'AVA':
      if (stats.minionsPlayed + stats.heroPowerUses >= 8) shouldUpgrade = true;
      break;
    case 'LUCAS':
      if (player.upgradeProgress >= 3) shouldUpgrade = true;
      break;
    case 'IZZY':
      if (player.upgradeProgress >= 10) shouldUpgrade = true;
      break;
  }

  if (shouldUpgrade) {
    player.heroPowerUpgraded = true;
    addLog(game, playerIndex, `${player.playerName}'s hero power has been UPGRADED!`, 'EFFECT');
  }
}
