import type { GameState, PlayerState, BoardMinion, Weapon, EffectDef } from '../shared/types.js';
import { MAX_BOARD_SIZE, MAX_HAND_SIZE, HERO_POWER_COST } from '../shared/types.js';
import { getCardDef } from './cards.js';
import { addLog } from './log.js';
import { createBoardMinion, checkDeaths } from './combat.js';
import {
  executeEffect,
  executeEffects,
  effectNeedsTarget,
  effectsNeedTarget,
  getEffectsTargetType,
  getValidTargets,
  checkHeroDeath,
  drawCard,
} from './effects.js';
import { minionHasKeyword } from './keywords.js';

/** Play a card from hand */
export function playCard(
  game: GameState,
  playerId: string,
  cardInstanceId: string,
  position?: number,
  targetId?: string | null
): { success: boolean; error?: string; needsTarget?: boolean; validTargets?: string[] } {
  if (game.phase !== 'PLAYING') return { success: false, error: 'Game not in playing phase' };
  if (game.winner) return { success: false, error: 'Game is over' };

  const pIdx = game.players.findIndex(p => p.playerId === playerId);
  if (pIdx === -1) return { success: false, error: 'Player not in game' };
  if (pIdx !== game.currentPlayerIndex) return { success: false, error: 'Not your turn' };

  const player = game.players[pIdx] as PlayerState;
  const cardIdx = player.hand.findIndex(c => c.instanceId === cardInstanceId);
  if (cardIdx === -1) return { success: false, error: 'Card not in hand' };

  const cardInst = player.hand[cardIdx];
  const def = getCardDef(cardInst.cardCode);

  // Check mana
  if (def.manaCost > player.mana) return { success: false, error: 'Not enough mana' };

  // Type-specific logic
  if (def.type === 'MINION') {
    if (player.board.length >= MAX_BOARD_SIZE) return { success: false, error: 'Board is full (max 7)' };

    // Check if battlecry needs a target (plural effects take priority)
    const bcEffects = def.battlecryEffects ?? (def.battlecryEffect ? [def.battlecryEffect] : []);
    if (def.keywords.includes('BATTLECRY') && bcEffects.length > 0 && effectsNeedTarget(bcEffects)) {
      const targetType = getEffectsTargetType(bcEffects);
      const targets = getValidTargets(game, pIdx as 0 | 1, targetType);
      if (targets.length > 0 && !targetId) {
        return { success: false, needsTarget: true, validTargets: targets };
      }
    }

    // Deduct mana
    player.mana -= def.manaCost;
    game.playerStats[pIdx as 0 | 1].manaSpent += def.manaCost;

    // Remove from hand
    player.hand.splice(cardIdx, 1);

    // Create minion and place on board
    const minion = createBoardMinion(cardInst.cardCode);
    const pos = position ?? player.board.length;
    player.board.splice(Math.min(pos, player.board.length), 0, minion);

    addLog(game, pIdx as 0 | 1, `${player.playerName} plays ${def.name}`, 'PLAY');
    game.playerStats[pIdx as 0 | 1].minionsPlayed++;

    // Trigger Battlecry (plural effects take priority)
    if (def.keywords.includes('BATTLECRY') && bcEffects.length > 0) {
      addLog(game, pIdx as 0 | 1, `${def.name}'s Battlecry!`, 'EFFECT');
      executeEffects(game, pIdx as 0 | 1, bcEffects, targetId);
    }

  } else if (def.type === 'SPELL') {
    // Check if spell needs a target (plural effects take priority)
    const spEffects = def.spellEffects ?? (def.spellEffect ? [def.spellEffect] : []);
    if (spEffects.length > 0 && effectsNeedTarget(spEffects)) {
      const targetType = getEffectsTargetType(spEffects);
      const targets = getValidTargets(game, pIdx as 0 | 1, targetType);
      if (targets.length > 0 && !targetId) {
        return { success: false, needsTarget: true, validTargets: targets };
      }
      if (targets.length === 0) {
        return { success: false, error: 'No valid targets for this spell' };
      }
    }

    // Deduct mana
    player.mana -= def.manaCost;
    game.playerStats[pIdx as 0 | 1].manaSpent += def.manaCost;

    // Remove from hand
    player.hand.splice(cardIdx, 1);

    addLog(game, pIdx as 0 | 1, `${player.playerName} casts ${def.name}`, 'PLAY');
    game.playerStats[pIdx as 0 | 1].spellsCast++;

    // Execute spell effects (plural takes priority)
    if (spEffects.length > 0) {
      executeEffects(game, pIdx as 0 | 1, spEffects, targetId);
    }

    // Spell goes to graveyard
    player.graveyard.push(cardInst);

  } else if (def.type === 'WEAPON') {
    // Deduct mana
    player.mana -= def.manaCost;
    game.playerStats[pIdx as 0 | 1].manaSpent += def.manaCost;

    // Remove from hand
    player.hand.splice(cardIdx, 1);

    // Destroy existing weapon
    if (player.weapon) {
      addLog(game, pIdx as 0 | 1, `${player.playerName}'s old weapon is destroyed`, 'PLAY');
    }

    // Equip new weapon
    player.weapon = {
      cardCode: cardInst.cardCode,
      currentAttack: def.attack,
      durability: def.health,
    };

    addLog(game, pIdx as 0 | 1, `${player.playerName} equips ${def.name}`, 'PLAY');
    game.playerStats[pIdx as 0 | 1].weaponsEquipped++;
  }

  game.lastAction = `${player.playerName} plays ${def.name}.`;

  checkDeaths(game);
  checkHeroDeath(game);

  return { success: true };
}

/** Use hero power */
export function useHeroPower(
  game: GameState,
  playerId: string,
  targetId?: string | null
): { success: boolean; error?: string; needsTarget?: boolean; validTargets?: string[] } {
  if (game.phase !== 'PLAYING') return { success: false, error: 'Game not in playing phase' };
  if (game.winner) return { success: false, error: 'Game is over' };

  const pIdx = game.players.findIndex(p => p.playerId === playerId);
  if (pIdx === -1) return { success: false, error: 'Player not in game' };
  if (pIdx !== game.currentPlayerIndex) return { success: false, error: 'Not your turn' };

  const player = game.players[pIdx] as PlayerState;
  if (player.heroPowerUsed) return { success: false, error: 'Hero power already used this turn' };
  if (player.mana < HERO_POWER_COST) return { success: false, error: 'Not enough mana' };

  const oppIdx = (pIdx === 0 ? 1 : 0) as 0 | 1;

  switch (player.heroClass) {
    case 'JIMMY': {
      // Fireblast: Deal 2 damage to any target
      if (!targetId) {
        const targets = [
          ...game.players[0].board.filter(m => !m.hasStealthUntilAttack).map(m => m.instanceId),
          ...game.players[1].board.filter(m => !m.hasStealthUntilAttack).map(m => m.instanceId),
          'hero-0', 'hero-1',
        ];
        return { success: false, needsTarget: true, validTargets: targets };
      }
      player.mana -= HERO_POWER_COST;
      player.heroPowerUsed = true;
      game.playerStats[pIdx as 0 | 1].manaSpent += HERO_POWER_COST;
      game.playerStats[pIdx as 0 | 1].heroPowerUses++;
      executeEffect(game, pIdx as 0 | 1, { type: 'DEAL_DAMAGE', target: 'TARGET_ANY', value: 2 }, targetId);
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses Fireblast`, 'PLAY');
      break;
    }
    case 'TALA': {
      // Nature's Touch: Restore 2 health to any target
      if (!targetId) {
        const targets = [
          ...game.players[0].board.map(m => m.instanceId),
          ...game.players[1].board.map(m => m.instanceId),
          'hero-0', 'hero-1',
        ];
        return { success: false, needsTarget: true, validTargets: targets };
      }
      player.mana -= HERO_POWER_COST;
      player.heroPowerUsed = true;
      game.playerStats[pIdx as 0 | 1].manaSpent += HERO_POWER_COST;
      game.playerStats[pIdx as 0 | 1].heroPowerUses++;
      executeEffect(game, pIdx as 0 | 1, { type: 'RESTORE_HEALTH', target: 'TARGET_ANY', value: 2 }, targetId);
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses Nature's Touch`, 'PLAY');
      break;
    }
    case 'DEREK': {
      // Tinker: Draw a card (no target needed)
      player.mana -= HERO_POWER_COST;
      player.heroPowerUsed = true;
      game.playerStats[pIdx as 0 | 1].manaSpent += HERO_POWER_COST;
      game.playerStats[pIdx as 0 | 1].heroPowerUses++;
      drawCard(game, pIdx as 0 | 1);
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses Tinker — draws a card`, 'PLAY');
      break;
    }
    case 'ANDERS': {
      // Frost Bolt: Deal 1 damage to a minion and Freeze it
      const allMinions = [
        ...game.players[0].board.filter(m => !m.hasStealthUntilAttack).map(m => m.instanceId),
        ...game.players[1].board.filter(m => !m.hasStealthUntilAttack).map(m => m.instanceId),
      ];
      if (!targetId) {
        if (allMinions.length === 0) return { success: false, error: 'No minions to target' };
        return { success: false, needsTarget: true, validTargets: allMinions };
      }
      if (targetId.startsWith('hero-')) return { success: false, error: 'Must target a minion' };
      player.mana -= HERO_POWER_COST;
      player.heroPowerUsed = true;
      game.playerStats[pIdx as 0 | 1].manaSpent += HERO_POWER_COST;
      game.playerStats[pIdx as 0 | 1].heroPowerUses++;
      executeEffect(game, pIdx as 0 | 1, { type: 'DEAL_DAMAGE', target: 'TARGET_MINION', value: 1 }, targetId);
      executeEffect(game, pIdx as 0 | 1, { type: 'FREEZE_TARGET', target: 'TARGET_MINION' }, targetId);
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses Frost Bolt`, 'PLAY');
      break;
    }
    default:
      return { success: false, error: 'Unknown hero class' };
  }

  game.lastAction = `${player.playerName} uses hero power.`;
  checkDeaths(game);
  checkHeroDeath(game);

  return { success: true };
}
