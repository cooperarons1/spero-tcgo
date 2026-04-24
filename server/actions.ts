import type { GameState, PlayerState, BoardMinion, BoardLocation, Weapon, EffectDef } from '../shared/types.js';
import { MAX_BOARD_SIZE, MAX_HAND_SIZE, HERO_POWER_COST, MAX_SECRETS } from '../shared/types.js';
import { checkSecrets } from './secrets.js';
import { getCardDef, getAllCardDefs } from './cards.js';
import { makeInstance, nextTransientInstanceId } from './deck.js';
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
  findMinion,
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
): { success: boolean; error?: string; needsTarget?: boolean; validTargets?: string[]; placed?: boolean } {
  if (game.phase !== 'PLAYING') return { success: false, error: 'Game not in playing phase' };
  if (game.winner) return { success: false, error: 'Game is over' };
  if (game.pendingBattlecry) return { success: false, error: 'Resolve pending battlecry first' };

  const pIdx = game.players.findIndex(p => p.playerId === playerId);
  if (pIdx === -1) return { success: false, error: 'Player not in game' };
  if (pIdx !== game.currentPlayerIndex) return { success: false, error: 'Not your turn' };

  const player = game.players[pIdx] as PlayerState;
  const cardIdx = player.hand.findIndex(c => c.instanceId === cardInstanceId);
  if (cardIdx === -1) return { success: false, error: 'Card not in hand' };

  const cardInst = player.hand[cardIdx];
  const def = getCardDef(cardInst.cardCode);

  // Check mana (apply spell discount for spells + per-instance cost
  // reduction from effects like Veil Slip's return-with-discount).
  const spellDiscount = def.type === 'SPELL' ? player.spellDiscount : 0;
  const instanceDiscount = cardInst.costReduction ?? 0;
  const effectiveCost = Math.max(0, def.manaCost - spellDiscount - instanceDiscount);
  if (effectiveCost > player.mana) return { success: false, error: 'Not enough mana' };

  // Type-specific logic
  if (def.type === 'MINION') {
    if (player.board.length >= MAX_BOARD_SIZE) return { success: false, error: 'Board is full (max 7)' };

    // Check if battlecry needs a target (plural effects take priority)
    const bcEffects = def.battlecryEffects ?? (def.battlecryEffect ? [def.battlecryEffect] : []);
    const bcNeedsTarget = def.keywords.includes('BATTLECRY') && bcEffects.length > 0 && effectsNeedTarget(bcEffects);

    // Deduct mana, remove from hand, place minion (shared for all minion paths)
    player.mana -= effectiveCost;
    game.playerStats[pIdx as 0 | 1].manaSpent += effectiveCost;
    player.hand.splice(cardIdx, 1);

    const minion = createBoardMinion(cardInst.cardCode, game.turnNumber, !!cardInst.isGolden);
    // Clamp the requested insert position to [0, board.length]. The
    // earlier `Math.min(pos, board.length)` allowed pos=-1 to slip
    // through — JavaScript Array.splice treats negative indices as
    // counting from the END, so splice(-1, 0, item) inserts BEFORE the
    // last minion instead of at index 0. The validation layer in
    // server/validation.ts also rejects negative positions but
    // belt-and-braces here is cheap and protects the engine from any
    // future caller that bypasses the schema.
    const pos = Math.max(0, Math.min(position ?? player.board.length, player.board.length));
    player.board.splice(pos, 0, minion);

    addLog(game, pIdx as 0 | 1, `${player.playerName} plays ${def.name}`, 'PLAY', def.cardCode);
    game.playerStats[pIdx as 0 | 1].minionsPlayed++;

    // 2-step battlecry: minion is on board, now ask for target
    if (bcNeedsTarget && !targetId) {
      const targetType = getEffectsTargetType(bcEffects);
      const targets = getValidTargets(game, pIdx as 0 | 1, targetType);
      if (targets.length > 0) {
        // Store pending battlecry so it can be resolved or cancelled
        game.pendingBattlecry = {
          playerIndex: pIdx as 0 | 1,
          minionInstanceId: minion.instanceId,
          cardCode: cardInst.cardCode,
          cardInstanceId: cardInst.instanceId ?? cardInstanceId,
          manaCost: def.manaCost,
          position: Math.min(pos, player.board.length - 1),
          validTargets: targets,
        };
        return { success: false, needsTarget: true, validTargets: targets, placed: true };
      }
      // No valid targets — battlecry fizzles, minion stays on board
    }

    // Trigger Battlecry (plural effects take priority)
    if (def.keywords.includes('BATTLECRY') && bcEffects.length > 0 && !bcNeedsTarget) {
      // Non-targeted battlecries (like "deal damage to all enemies")
      addLog(game, pIdx as 0 | 1, `${def.name}'s Battlecry!`, 'EFFECT', def.cardCode);
      executeEffects(game, pIdx as 0 | 1, bcEffects, targetId);
    } else if (def.keywords.includes('BATTLECRY') && bcEffects.length > 0 && targetId) {
      // Targeted battlecry with target provided upfront
      addLog(game, pIdx as 0 | 1, `${def.name}'s Battlecry!`, 'EFFECT', def.cardCode);
      executeEffects(game, pIdx as 0 | 1, bcEffects, targetId);
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
      player.mana -= effectiveCost;
      game.playerStats[pIdx as 0 | 1].manaSpent += effectiveCost;
      if (player.spellDiscount > 0) player.spellDiscount = 0;
      player.hand.splice(cardIdx, 1);
      player.secrets.push({
        instanceId: nextTransientInstanceId('secret'),
        cardCode: cardInst.cardCode,
        ownerPlayerIndex: pIdx as 0 | 1,
      });
      addLog(game, pIdx as 0 | 1, `${player.playerName} plays a secret`, 'PLAY', cardInst.cardCode);
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

    // Deduct mana (with spell discount)
    player.mana -= effectiveCost;
    game.playerStats[pIdx as 0 | 1].manaSpent += effectiveCost;
    if (player.spellDiscount > 0) player.spellDiscount = 0;

    // Remove from hand
    player.hand.splice(cardIdx, 1);

    addLog(game, pIdx as 0 | 1, `${player.playerName} casts ${def.name}`, 'PLAY', def.cardCode);
    game.playerStats[pIdx as 0 | 1].spellsCast++;

    // Check opponent's WHEN_SPELL_CAST secrets (after mana spent, before effects)
    const spellSecretResult = checkSecrets(game, 'WHEN_SPELL_CAST', {
      actingPlayerIndex: pIdx as 0 | 1,
      spellCardCode: cardInst.cardCode,
    });

    // Execute spell effects unless countered
    if (!spellSecretResult.countered && spEffects.length > 0) {
      executeEffects(game, pIdx as 0 | 1, spEffects, targetId, { fromSpell: true });
    }

    // Spell goes to graveyard
    player.graveyard.push(cardInst);

  } else if (def.type === 'WEAPON') {
    // Deduct mana
    player.mana -= effectiveCost;
    game.playerStats[pIdx as 0 | 1].manaSpent += effectiveCost;

    // Remove from hand
    player.hand.splice(cardIdx, 1);

    // Destroy existing weapon
    if (player.weapon) {
      addLog(game, pIdx as 0 | 1, `${player.playerName}'s old weapon is destroyed`, 'PLAY', player.weapon!.cardCode);
    }

    // Equip new weapon
    player.weapon = {
      cardCode: cardInst.cardCode,
      currentAttack: def.attack,
      durability: def.health,
    };

    addLog(game, pIdx as 0 | 1, `${player.playerName} equips ${def.name}`, 'PLAY', def.cardCode);
    game.playerStats[pIdx as 0 | 1].weaponsEquipped++;

  } else if (def.type === 'LOCATION') {
    // Board space check: minions + locations combined
    if (player.board.length + player.locations.length >= MAX_BOARD_SIZE) {
      return { success: false, error: 'Board is full (max 7 minions + locations)' };
    }

    // Deduct mana
    player.mana -= effectiveCost;
    game.playerStats[pIdx as 0 | 1].manaSpent += effectiveCost;

    // Remove from hand
    player.hand.splice(cardIdx, 1);

    // Create BoardLocation
    const location: BoardLocation = {
      instanceId: nextTransientInstanceId('loc'),
      cardCode: cardInst.cardCode,
      durability: def.health,
      maxDurability: def.health,
      cooldownRemaining: 1, // 1-turn cooldown after playing
      activatedThisTurn: false,
    };

    player.locations.push(location);
    addLog(game, pIdx as 0 | 1, `${player.playerName} places ${def.name}`, 'PLAY', def.cardCode);
    game.playerStats[pIdx as 0 | 1].locationsPlayed++;
  }

  game.lastAction = `${player.playerName} plays ${def.name}.`;

  // COMBO mechanic: if player played another card this turn, trigger combo effects
  if (game.cardsPlayedThisTurn > 0 && def.keywords.includes('COMBO')) {
    const comboEffects = def.comboEffects ?? (def.comboEffect ? [def.comboEffect] : []);
    if (comboEffects.length > 0) {
      addLog(game, pIdx as 0 | 1, `Combo! ${def.name}'s bonus effect triggers!`, 'EFFECT', def.cardCode);
      executeEffects(game, pIdx as 0 | 1, comboEffects, targetId, { fromSpell: def.type === 'SPELL' });
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

  // Mapping — HS classic hero powers, reassigned per user:
  //   JIMMY  = Hunter   : Steady Shot    (2 dmg enemy hero)
  //   IZZY   = Mage     : Fireblast       (1 dmg any target)
  //   ASTRID = Rogue    : Dagger Mastery  (equip 1/2 weapon)
  //   TALA   = Priest   : Lesser Heal     (restore 2 to any character)
  //   ANDERS = Warrior  : Armor Up!       (+2 armor)
  //   AVA    = Paladin  : Reinforce       (summon 1/1 Recruit)
  //   LUCAS  = Shaman   : Totemic Call    (random orb, no dupes)
  //   DES    = Warlock  : Life Tap        (draw 1, take 2)
  //   DEREK  = Druid    : Shapeshift      (+1 atk this turn, +1 armor)

  const ORB_CODES = ['LUC_ORB_FIRE', 'LUC_ORB_WATER', 'LUC_ORB_AIR', 'LUC_ORB_HEALING'];
  const spendMana = () => {
    player.mana -= HERO_POWER_COST;
    player.heroPowerUsed = true;
    game.playerStats[pIdx as 0 | 1].manaSpent += HERO_POWER_COST;
    game.playerStats[pIdx as 0 | 1].heroPowerUses++;
  };

  switch (player.heroClass) {
    case 'JIMMY': {
      // Hunter — Steady Shot: 2 dmg to enemy hero (auto, no picker).
      spendMana();
      applyDamageToHero(game.players[oppIdx], 2);
      game.playerStats[pIdx as 0 | 1].damageDealtToHeroes += 2;
      checkHeroDeath(game);
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses Precision Shot`, 'PLAY');
      break;
    }
    case 'IZZY': {
      // Mage — Fireblast: 1 dmg to any target.
      if (!targetId) {
        const targets = [
          ...game.players[0].board.filter(m => !m.hasStealthUntilAttack).map(m => m.instanceId),
          ...game.players[1].board.filter(m => !m.hasStealthUntilAttack).map(m => m.instanceId),
          `hero-${pIdx}`, `hero-${oppIdx}`,
        ];
        return { success: false, needsTarget: true, validTargets: targets };
      }
      spendMana();
      executeEffect(game, pIdx as 0 | 1, { type: 'DEAL_DAMAGE', target: 'TARGET_ANY', value: 1 }, targetId);
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses Catalyze`, 'PLAY');
      break;
    }
    case 'ASTRID': {
      // Rogue — Dagger Mastery: equip a 1/2 Wicked Knife (replaces existing weapon).
      spendMana();
      if (player.weapon) {
        addLog(game, pIdx as 0 | 1, `${player.playerName}'s old weapon is destroyed`, 'PLAY', player.weapon.cardCode);
      }
      const daggerDef = getCardDef('AST_TOKEN_DAGGER');
      player.weapon = {
        cardCode: 'AST_TOKEN_DAGGER',
        currentAttack: daggerDef.attack,
        durability: daggerDef.health,
      };
      game.playerStats[pIdx as 0 | 1].weaponsEquipped++;
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses Concealed Blade`, 'PLAY');
      break;
    }
    case 'TALA': {
      // Priest — Lesser Heal: restore 2 to any character.
      if (!targetId) {
        const targets = [
          ...game.players[0].board.filter(m => !m.hasStealthUntilAttack).map(m => m.instanceId),
          ...game.players[1].board.filter(m => !m.hasStealthUntilAttack).map(m => m.instanceId),
          `hero-${pIdx}`, `hero-${oppIdx}`,
        ];
        return { success: false, needsTarget: true, validTargets: targets };
      }
      spendMana();
      if (targetId.startsWith('hero-')) {
        const heroIdx = parseInt(targetId.split('-')[1]) as 0 | 1;
        const hero = game.players[heroIdx];
        const healed = Math.min(2, hero.maxHealth - hero.health);
        hero.health = Math.min(hero.health + 2, hero.maxHealth);
        game.playerStats[pIdx as 0 | 1].healingDone += healed;
      } else {
        const minion = findMinion(game, targetId);
        if (minion) {
          const healed = Math.min(2, minion.maxHealth - minion.currentHealth);
          minion.currentHealth = Math.min(minion.currentHealth + 2, minion.maxHealth);
          game.playerStats[pIdx as 0 | 1].healingDone += healed;
        }
      }
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses Safeguard`, 'PLAY');
      break;
    }
    case 'ANDERS': {
      // Warrior — Armor Up!: gain 2 armor.
      spendMana();
      executeEffect(game, pIdx as 0 | 1, { type: 'GAIN_ARMOR', target: 'NONE', value: 2 });
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses Brace`, 'PLAY');
      break;
    }
    case 'AVA': {
      // Paladin — Reinforce: summon a 1/1 Silver Hand Recruit.
      if (player.board.length >= MAX_BOARD_SIZE) return { success: false, error: 'Board is full' };
      spendMana();
      executeEffect(game, pIdx as 0 | 1, { type: 'SUMMON_MINION', target: 'NONE', summonCardCode: 'NEU_TOKEN_RECRUIT' });
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses Deploy Sentinel`, 'PLAY');
      break;
    }
    case 'LUCAS': {
      // Shaman — Totemic Call: random orb, cannot summon a duplicate.
      const existing = new Set(player.board.map(m => m.cardCode));
      const available = ORB_CODES.filter(c => !existing.has(c));
      if (available.length === 0) return { success: false, error: 'All totems are already summoned' };
      if (player.board.length >= MAX_BOARD_SIZE) return { success: false, error: 'Board is full' };
      spendMana();
      const pick = available[Math.floor(Math.random() * available.length)];
      executeEffect(game, pIdx as 0 | 1, { type: 'SUMMON_MINION', target: 'NONE', summonCardCode: pick });
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses Invoke Echo`, 'PLAY');
      break;
    }
    case 'DES': {
      // Warlock — Life Tap: draw 1, take 2 damage.
      spendMana();
      drawCard(game, pIdx as 0 | 1, true);
      applyDamageToHero(player, 2);
      checkHeroDeath(game);
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses Blood Pact`, 'PLAY');
      break;
    }
    case 'DEREK': {
      // Druid — Shapeshift: +1 Attack this turn, gain 1 armor.
      spendMana();
      player.heroAttackThisTurn = (player.heroAttackThisTurn ?? 0) + 1;
      player.armor += 1;
      addLog(game, pIdx as 0 | 1, `${player.playerName} uses Reforge`, 'PLAY');
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
  addLog(game, pIdx as 0 | 1, `${player.playerName} activates ${def.name}`, 'PLAY', def.cardCode);
  executeEffects(game, pIdx as 0 | 1, locEffects, targetId);

  // Consume durability
  location.durability--;
  location.activatedThisTurn = true;

  // Destroy if durability depleted
  if (location.durability <= 0) {
    player.locations = player.locations.filter(l => l.instanceId !== locationInstanceId);
    player.graveyard.push({ instanceId: location.instanceId, cardCode: location.cardCode });
    addLog(game, pIdx as 0 | 1, `${def.name} is destroyed`, 'EFFECT', def.cardCode);
  }

  game.lastAction = `${player.playerName} activates ${def.name}.`;
  checkDeaths(game);
  checkHeroDeath(game);

  return { success: true };
}

/** Resolve a pending battlecry with a chosen target */
export function resolveBattlecry(
  game: GameState,
  playerId: string,
  targetId: string
): { success: boolean; error?: string } {
  if (!game.pendingBattlecry) return { success: false, error: 'No pending battlecry' };

  const pb = game.pendingBattlecry;
  const pIdx = game.players.findIndex(p => p.playerId === playerId);
  if (pIdx !== pb.playerIndex) return { success: false, error: 'Not your battlecry' };

  if (!pb.validTargets.includes(targetId)) {
    return { success: false, error: 'Invalid target for battlecry' };
  }

  const def = getCardDef(pb.cardCode);
  const bcEffects = def.battlecryEffects ?? (def.battlecryEffect ? [def.battlecryEffect] : []);

  // Clear pending before executing (effects might trigger deaths etc.)
  game.pendingBattlecry = null;

  const player = game.players[pIdx] as PlayerState;

  // Execute battlecry effects
  addLog(game, pIdx as 0 | 1, `${def.name}'s Battlecry!`, 'EFFECT', def.cardCode);
  executeEffects(game, pIdx as 0 | 1, bcEffects, targetId);

  // Check opponent's WHEN_MINION_PLAYED secrets
  checkSecrets(game, 'WHEN_MINION_PLAYED', {
    actingPlayerIndex: pIdx as 0 | 1,
    minionInstanceId: pb.minionInstanceId,
  });

  // COMBO
  if (game.cardsPlayedThisTurn > 0 && def.keywords.includes('COMBO')) {
    const comboEffects = def.comboEffects ?? (def.comboEffect ? [def.comboEffect] : []);
    if (comboEffects.length > 0) {
      addLog(game, pIdx as 0 | 1, `Combo! ${def.name}'s bonus effect triggers!`, 'EFFECT', def.cardCode);
      executeEffects(game, pIdx as 0 | 1, comboEffects, targetId, { fromSpell: def.type === 'SPELL' });
    }
  }
  game.cardsPlayedThisTurn++;

  game.lastAction = `${player.playerName} plays ${def.name}.`;
  checkDeaths(game);
  checkHeroDeath(game);

  return { success: true };
}

/** Cancel a pending battlecry — return minion to hand, refund mana */
export function cancelBattlecry(
  game: GameState,
  playerId: string
): { success: boolean; error?: string } {
  if (!game.pendingBattlecry) return { success: false, error: 'No pending battlecry' };

  const pb = game.pendingBattlecry;
  const pIdx = game.players.findIndex(p => p.playerId === playerId);
  if (pIdx !== pb.playerIndex) return { success: false, error: 'Not your battlecry' };

  const player = game.players[pIdx] as PlayerState;

  // Remove minion from board
  player.board = player.board.filter(m => m.instanceId !== pb.minionInstanceId);

  // Refund mana
  player.mana = Math.min(player.mana + pb.manaCost, player.maxMana);
  game.playerStats[pIdx as 0 | 1].manaSpent -= pb.manaCost;
  game.playerStats[pIdx as 0 | 1].minionsPlayed--;

  // Return card to hand
  player.hand.push(makeInstance(pb.cardCode));

  // Remove the play log entry
  const lastPlayLog = game.log.findIndex(l => l.category === 'PLAY' && l.cardCode === pb.cardCode);
  if (lastPlayLog >= 0) game.log.splice(lastPlayLog, 1);

  game.pendingBattlecry = null;

  return { success: true };
}

// checkHeroPowerUpgrade is imported from ./upgrade.ts to avoid circular dependencies
