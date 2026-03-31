import type { GameState, PlayerState, BoardMinion, BoardLocation, Weapon, EffectDef } from '../shared/types.js';
import { MAX_BOARD_SIZE, MAX_HAND_SIZE, HERO_POWER_COST, MAX_SECRETS } from '../shared/types.js';
import { checkSecrets } from './secrets.js';
import { getCardDef, getAllCardDefs } from './cards.js';
import { makeInstance } from './deck.js';
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
  applyDamageToHero,
} from './effects.js';
import { minionHasKeyword } from './keywords.js';
import { checkHeroPowerUpgrade } from './upgrade.js';

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
      if (targets.length === 0) {
        return { success: false, error: 'No valid targets for this battlecry' };
      }
      if (!targetId) {
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

    // Bond: check if partner is already on board
    if (def.keywords.includes('BOND') && def.bondPartnerCode && def.bondEffect) {
      const partner = player.board.find(m => m.cardCode === def.bondPartnerCode && m.instanceId !== minion.instanceId);
      if (partner) {
        addLog(game, pIdx as 0 | 1, `Bond activates! ${def.name} and ${getCardDef(def.bondPartnerCode).name}!`, 'EFFECT');
        // Buff both the played minion and the partner
        executeEffect(game, pIdx as 0 | 1, { ...def.bondEffect, target: 'SELF' }, minion.instanceId);
        executeEffect(game, pIdx as 0 | 1, { ...def.bondEffect, target: 'SELF' }, partner.instanceId);
      }
    }

    // Trigger Battlecry (plural effects take priority)
    if (def.keywords.includes('BATTLECRY') && bcEffects.length > 0) {
      addLog(game, pIdx as 0 | 1, `${def.name}'s Battlecry!`, 'EFFECT');
      executeEffects(game, pIdx as 0 | 1, bcEffects, targetId);
    }

    // Special: Des Aster Puppetmaster — Collar ALL enemy minions on battlecry
    if (def.cardCode === 'DES_COLLAR_03' && def.keywords.includes('BATTLECRY')) {
      const opp = game.players[(pIdx === 0 ? 1 : 0) as 0 | 1];
      for (const m of opp.board) {
        if (!m.isCollared) {
          m.isCollared = true;
          m.collarOwnerIndex = pIdx as 0 | 1;
        }
      }
      if (opp.board.length > 0) {
        addLog(game, pIdx as 0 | 1, `All enemy minions are Collared!`, 'EFFECT');
      }
    }

    // Check opponent's WHEN_MINION_PLAYED secrets
    checkSecrets(game, 'WHEN_MINION_PLAYED', {
      actingPlayerIndex: pIdx as 0 | 1,
      minionInstanceId: minion.instanceId,
    });

  } else if (def.type === 'SPELL') {
    // ─── Secret spell ───
    if (def.secretTrigger) {
      if (player.secrets.some(s => s.cardCode === cardInst.cardCode)) {
        return { success: false, error: 'You already have this secret active' };
      }
      if (player.secrets.length >= MAX_SECRETS) {
        return { success: false, error: 'Maximum 5 secrets' };
      }
      player.mana -= def.manaCost;
      game.playerStats[pIdx as 0 | 1].manaSpent += def.manaCost;
      player.hand.splice(cardIdx, 1);
      player.secrets.push({
        instanceId: `secret-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        cardCode: cardInst.cardCode,
        ownerPlayerIndex: pIdx as 0 | 1,
      });
      addLog(game, pIdx as 0 | 1, `${player.playerName} plays a secret`, 'PLAY');
      game.playerStats[pIdx as 0 | 1].spellsCast++;
      game.lastAction = `${player.playerName} plays a secret.`;
      return { success: true };
    }

    // ─── Normal spell ───
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

    // Check opponent's WHEN_SPELL_CAST secrets (after mana spent, before effects)
    const spellSecretResult = checkSecrets(game, 'WHEN_SPELL_CAST', {
      actingPlayerIndex: pIdx as 0 | 1,
      spellCardCode: cardInst.cardCode,
    });

    // Execute spell effects unless countered
    if (!spellSecretResult.countered && spEffects.length > 0) {
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

  } else if (def.type === 'LOCATION') {
    // Board space check: minions + locations combined
    if (player.board.length + player.locations.length >= MAX_BOARD_SIZE) {
      return { success: false, error: 'Board is full (max 7 minions + locations)' };
    }

    // Deduct mana
    player.mana -= def.manaCost;
    game.playerStats[pIdx as 0 | 1].manaSpent += def.manaCost;

    // Remove from hand
    player.hand.splice(cardIdx, 1);

    // Create BoardLocation
    const location: BoardLocation = {
      instanceId: `loc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      cardCode: cardInst.cardCode,
      durability: def.health,
      maxDurability: def.health,
      cooldownRemaining: 1, // 1-turn cooldown after playing
      activatedThisTurn: false,
    };

    player.locations.push(location);
    addLog(game, pIdx as 0 | 1, `${player.playerName} places ${def.name}`, 'PLAY');
    game.playerStats[pIdx as 0 | 1].locationsPlayed++;
  }

  game.lastAction = `${player.playerName} plays ${def.name}.`;

  // COMBO mechanic: if player played another card this turn, trigger combo effects
  if (game.cardsPlayedThisTurn > 0 && def.keywords.includes('COMBO')) {
    const comboEffects = def.comboEffects ?? (def.comboEffect ? [def.comboEffect] : []);
    if (comboEffects.length > 0) {
      addLog(game, pIdx as 0 | 1, `Combo! ${def.name}'s bonus effect triggers!`, 'EFFECT');
      executeEffects(game, pIdx as 0 | 1, comboEffects, targetId);
    }
  }
  game.cardsPlayedThisTurn++;

  checkDeaths(game);
  checkHeroDeath(game);

  // Check hero power upgrade for both players
  // Hero power upgrades removed
  // checkHeroPowerUpgrade(game, 0);
  // checkHeroPowerUpgrade(game, 1);

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

  // Hero powers are base only (no upgrades)
  const upgraded = false;
  switch (player.heroClass) {
    case 'JIMMY': {
      // Orra Arrow: Deal 2 damage to any target (upgraded: 2 dmg + 1 dmg to adjacent)
      const dmg = 2;
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
      // Collect adjacent minion IDs BEFORE dealing damage (death removes from board)
      let adjacentIds: string[] = [];
      if (upgraded) {
        for (const p of game.players) {
          const idx = p.board.findIndex(m => m.instanceId === targetId);
          if (idx >= 0) {
            if (idx > 0) adjacentIds.push(p.board[idx - 1].instanceId);
            if (idx < p.board.length - 1) adjacentIds.push(p.board[idx + 1].instanceId);
            break;
          }
        }
      }
      executeEffect(game, pIdx as 0 | 1, { type: 'DEAL_DAMAGE', target: 'TARGET_ANY', value: dmg }, targetId);
      if (upgraded && adjacentIds.length > 0) {
        for (const adjId of adjacentIds) {
          // Only damage if still alive on board
          const stillAlive = game.players.some(p => p.board.some(m => m.instanceId === adjId));
          if (stillAlive) {
            executeEffect(game, pIdx as 0 | 1, { type: 'DEAL_DAMAGE', target: 'TARGET_ANY', value: 1 }, adjId);
          }
        }
      }
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses ${'Orra Arrow'}`, 'PLAY');
      break;
    }
    case 'TALA': {
      // Nature's Touch: +1/+1 (upgraded: +1/+2)
      const buff = upgraded ? 1 : 1;
      const friendlyMinionsTala = game.players[pIdx].board;
      if (!targetId) {
        if (friendlyMinionsTala.length === 0) return { success: false, error: 'No friendly minions to target' };
        return { success: false, needsTarget: true, validTargets: friendlyMinionsTala.map(m => m.instanceId) };
      }
      const isMyMinionTala = game.players[pIdx].board.some(m => m.instanceId === targetId);
      if (!isMyMinionTala) return { success: false, error: 'Must target a friendly minion' };
      player.mana -= HERO_POWER_COST;
      player.heroPowerUsed = true;
      game.playerStats[pIdx as 0 | 1].manaSpent += HERO_POWER_COST;
      game.playerStats[pIdx as 0 | 1].heroPowerUses++;
      const healthBuff = upgraded ? 2 : 1;
      executeEffect(game, pIdx as 0 | 1, { type: 'BUFF_MINION', target: 'TARGET_FRIENDLY_MINION', attackBuff: buff, healthBuff }, targetId);
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses ${upgraded ? "Nature's Embrace" : "Nature's Touch"}`, 'PLAY');
      break;
    }
    case 'DEREK': {
      // Tinker: Draw a card (upgraded: draw 1, costs 1 less — implemented as 1 mana refund)
      player.mana -= HERO_POWER_COST;
      player.heroPowerUsed = true;
      game.playerStats[pIdx as 0 | 1].manaSpent += HERO_POWER_COST;
      game.playerStats[pIdx as 0 | 1].heroPowerUses++;
      drawCard(game, pIdx as 0 | 1, true);
      if (upgraded) {
        player.mana = Math.min(player.mana + 1, player.maxMana);
        addLog(game, pIdx as 0 | 1, `${player.playerName} uses Master Tinker — draws a card (1 mana refunded)`, 'PLAY');
      } else {
        addLog(game, pIdx as 0 | 1, `${player.playerName} uses Tinker — draws a card`, 'PLAY');
      }
      break;
    }
    case 'ANDERS': {
      // Hockbandy Strike: 1 dmg + freeze (upgraded: 1 dmg + freeze target + 1 adjacent)
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
      executeEffect(game, pIdx as 0 | 1, { type: 'DEAL_DAMAGE', target: 'TARGET_MINION', value: 2 }, targetId);
      executeEffect(game, pIdx as 0 | 1, { type: 'FREEZE_TARGET', target: 'TARGET_MINION' }, targetId);
      if (upgraded) {
        // Freeze 1 adjacent minion (the one to the right, or left if rightmost)
        for (const p of game.players) {
          const idx = p.board.findIndex(m => m.instanceId === targetId);
          if (idx >= 0) {
            if (idx < p.board.length - 1) p.board[idx + 1].isFrozen = true;
            else if (idx > 0) p.board[idx - 1].isFrozen = true;
            break;
          }
        }
      }
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses ${'Hockbandy Strike'}`, 'PLAY');
      break;
    }
    case 'DES': {
      // Orra Siphon: 1 dmg to enemy hero (upgraded: 1 dmg + random enemy gets -1 atk)
      const dmg = 1;
      player.mana -= HERO_POWER_COST;
      player.heroPowerUsed = true;
      game.playerStats[pIdx as 0 | 1].manaSpent += HERO_POWER_COST;
      game.playerStats[pIdx as 0 | 1].heroPowerUses++;
      applyDamageToHero(game.players[oppIdx], dmg);
      game.playerStats[pIdx as 0 | 1].damageDealtToHeroes += dmg;
      if (upgraded && game.players[oppIdx].board.length > 0) {
        const randomEnemy = game.players[oppIdx].board[Math.floor(Math.random() * game.players[oppIdx].board.length)];
        randomEnemy.currentAttack = Math.max(0, randomEnemy.currentAttack - 1);
        randomEnemy.enchantments.push({ source: 'des-upgraded-hp', attackMod: -1, healthMod: 0 });
      }
      checkHeroDeath(game);
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses ${'Orra Siphon'}`, 'PLAY');
      break;
    }
    case 'ASTRID': {
      // Mighty Guard: Divine Shield (upgraded: + 0/+2)
      const friendlyMinions = game.players[pIdx].board.filter(m => !m.hasDivineShield);
      if (!targetId) {
        if (friendlyMinions.length === 0) return { success: false, error: 'No valid friendly minions' };
        return { success: false, needsTarget: true, validTargets: friendlyMinions.map(m => m.instanceId) };
      }
      const isMyMinion = game.players[pIdx].board.some(m => m.instanceId === targetId);
      if (!isMyMinion) return { success: false, error: 'Must target a friendly minion' };
      player.mana -= HERO_POWER_COST;
      player.heroPowerUsed = true;
      game.playerStats[pIdx as 0 | 1].manaSpent += HERO_POWER_COST;
      game.playerStats[pIdx as 0 | 1].heroPowerUses++;
      executeEffect(game, pIdx as 0 | 1, { type: 'GRANT_KEYWORD', target: 'TARGET_FRIENDLY_MINION', grantKeyword: 'DIVINE_SHIELD' }, targetId);
      if (upgraded) {
        executeEffect(game, pIdx as 0 | 1, { type: 'BUFF_MINION', target: 'TARGET_FRIENDLY_MINION', attackBuff: 0, healthBuff: 2 }, targetId);
      }
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses ${upgraded ? 'Radiant Guard' : 'Mighty Guard'}`, 'PLAY');
      break;
    }
    case 'AVA': {
      // Deploy Drone: 1/1 (upgraded: 1/1 with Taunt)
      if (player.board.length >= MAX_BOARD_SIZE) return { success: false, error: 'Board is full' };
      player.mana -= HERO_POWER_COST;
      player.heroPowerUsed = true;
      game.playerStats[pIdx as 0 | 1].manaSpent += HERO_POWER_COST;
      game.playerStats[pIdx as 0 | 1].heroPowerUses++;
      executeEffect(game, pIdx as 0 | 1, { type: 'SUMMON_MINION', target: 'NONE', summonCardCode: 'AVA_TOKEN_01' });
      if (upgraded) {
        // Give the newly summoned token Taunt via enchantment
        const lastMinion = player.board[player.board.length - 1];
        if (lastMinion) {
          lastMinion.enchantments.push({ source: 'ava-upgraded-hp', attackMod: 0, healthMod: 0, addedKeywords: ['TAUNT'] });
        }
      }
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses ${upgraded ? 'Deploy Guardian' : 'Deploy Drone'}`, 'PLAY');
      break;
    }
    case 'LUCAS': {
      // Coyote's Trick: Add a random 1-cost card to your hand (combo enabler)
      player.mana -= HERO_POWER_COST;
      player.heroPowerUsed = true;
      game.playerStats[pIdx as 0 | 1].manaSpent += HERO_POWER_COST;
      game.playerStats[pIdx as 0 | 1].heroPowerUses++;
      // Find all 1-cost cards from Lucas class + neutral
      const oneCostCards = getAllCardDefs().filter(c =>
        c.manaCost <= 1 && (c.heroClass === 'LUCAS' || c.heroClass === 'NEUTRAL')
        && c.cardCode !== 'COIN' && !c.cardCode.includes('TOKEN')
      );
      if (oneCostCards.length > 0 && player.hand.length < MAX_HAND_SIZE) {
        const pick = oneCostCards[Math.floor(Math.random() * oneCostCards.length)];
        player.hand.push(makeInstance(pick.cardCode));
        addLog(game, pIdx as 0 | 1, `${player.playerName} uses Coyote's Trick — adds ${pick.name} to hand`, 'PLAY');
      } else {
        addLog(game, pIdx as 0 | 1, `${player.playerName} uses Coyote's Trick`, 'PLAY');
      }
      break;
    }
    case 'IZZY': {
      // Chart Course: 2 armor, draw 1 if 5+ armor (upgraded: 3 armor + draw 1)
      player.mana -= HERO_POWER_COST;
      player.heroPowerUsed = true;
      game.playerStats[pIdx as 0 | 1].manaSpent += HERO_POWER_COST;
      game.playerStats[pIdx as 0 | 1].heroPowerUses++;
      const armorGain = upgraded ? 3 : 2;
      executeEffect(game, pIdx as 0 | 1, { type: 'GAIN_ARMOR', target: 'NONE', value: armorGain });
      if (upgraded || player.armor >= 5) {
        drawCard(game, pIdx as 0 | 1, true);
      }
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses ${'Chart Course'}`, 'PLAY');
      break;
    }
    default:
      return { success: false, error: 'Unknown hero class' };
  }

  game.lastAction = `${player.playerName} uses hero power.`;
  checkDeaths(game);
  checkHeroDeath(game);

  // Check hero power upgrade for both players
  // Hero power upgrades removed
  // checkHeroPowerUpgrade(game, 0);
  // checkHeroPowerUpgrade(game, 1);

  return { success: true };
}

/** Activate a location card */
export function activateLocation(
  game: GameState,
  playerId: string,
  locationInstanceId: string,
  targetId?: string | null
): { success: boolean; error?: string; needsTarget?: boolean; validTargets?: string[] } {
  if (game.phase !== 'PLAYING') return { success: false, error: 'Game not in playing phase' };
  if (game.winner) return { success: false, error: 'Game is over' };

  const pIdx = game.players.findIndex(p => p.playerId === playerId);
  if (pIdx === -1) return { success: false, error: 'Player not in game' };
  if (pIdx !== game.currentPlayerIndex) return { success: false, error: 'Not your turn' };

  const player = game.players[pIdx] as PlayerState;
  const location = player.locations.find(l => l.instanceId === locationInstanceId);
  if (!location) return { success: false, error: 'Location not found' };
  if (location.cooldownRemaining > 0) return { success: false, error: 'Location is on cooldown' };
  if (location.activatedThisTurn) return { success: false, error: 'Location already activated this turn' };

  const def = getCardDef(location.cardCode);
  const locEffects = def.locationEffects ?? (def.locationEffect ? [def.locationEffect] : []);
  if (locEffects.length === 0) return { success: false, error: 'Location has no effect' };

  // Check if effects need a target
  if (effectsNeedTarget(locEffects)) {
    const targetType = getEffectsTargetType(locEffects);
    const targets = getValidTargets(game, pIdx as 0 | 1, targetType);
    if (targets.length > 0 && !targetId) {
      return { success: false, needsTarget: true, validTargets: targets };
    }
    if (targets.length === 0) {
      return { success: false, error: 'No valid targets for this location' };
    }
  }

  // Execute effects
  addLog(game, pIdx as 0 | 1, `${player.playerName} activates ${def.name}`, 'PLAY');
  executeEffects(game, pIdx as 0 | 1, locEffects, targetId);

  // Consume durability
  location.durability--;
  location.activatedThisTurn = true;

  // Destroy if durability depleted
  if (location.durability <= 0) {
    player.locations = player.locations.filter(l => l.instanceId !== locationInstanceId);
    player.graveyard.push({ instanceId: location.instanceId, cardCode: location.cardCode });
    addLog(game, pIdx as 0 | 1, `${def.name} is destroyed`, 'EFFECT');
  }

  game.lastAction = `${player.playerName} activates ${def.name}.`;
  checkDeaths(game);
  checkHeroDeath(game);

  return { success: true };
}

// checkHeroPowerUpgrade is imported from ./upgrade.ts to avoid circular dependencies
