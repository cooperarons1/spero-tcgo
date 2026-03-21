import type { GameState, CombatState, CombatResult, CombatTrickEffect, Stack, PlayerZone } from '../shared/types.js';
import { AP_TO_WIN } from '../shared/types.js';
import { getCardDef } from './cards.js';
import {
  stackPower,
  stackSmarts,
  canBlock,
  canPlayCombatTrick,
  defOf,
  getStackKeywords,
  parseKeywords,
} from './rules.js';
import { addLog } from './log.js';
import { trackCardPlayed } from './game.js';
import {
  parseCombatTrickEffect,
  applyImmediateTrickEffects,
  calculateTrickStatBonus,
  calculateTrickViciousBonus,
  applyPostCombatTrickEffects,
  handleActionEffect,
  getSideplayStatBonuses,
  getSideplayKeywordBonuses,
} from './abilities.js';

function findPlayer(game: GameState, playerId: string): PlayerZone {
  return game.players.find((z) => z.playerId === playerId)!;
}

function opponentOf(game: GameState, playerId: string): PlayerZone {
  return game.players.find((z) => z.playerId !== playerId)!;
}

function findStack(player: PlayerZone, stackId: string): Stack | null {
  return player.stacks.find((s) => s.stackId === stackId) ?? null;
}

/** Start a Power mission */
export function startPowerMission(
  game: GameState,
  playerId: string,
  stackId: string
): { success: boolean; error?: string } {
  return startMission(game, playerId, stackId, 'POWER');
}

/** Start a Smarts mission */
export function startSmartsMission(
  game: GameState,
  playerId: string,
  stackId: string
): { success: boolean; error?: string } {
  return startMission(game, playerId, stackId, 'SMARTS');
}

function startMission(
  game: GameState,
  playerId: string,
  stackId: string,
  missionType: 'POWER' | 'SMARTS'
): { success: boolean; error?: string } {
  if (game.turnPhase !== 'ACTION') return { success: false, error: 'Not in action phase' };
  if (game.combatState) return { success: false, error: 'Combat already in progress' };
  if (game.actedStacks.has(stackId)) return { success: false, error: 'Stack already acted' };

  const player = findPlayer(game, playerId);
  const stack = findStack(player, stackId);
  if (!stack) return { success: false, error: 'Stack not found' };
  if (stack.tapped) return { success: false, error: 'Stack is tapped' };
  if (stack.createdOnTurn === game.turnNumber) return { success: false, error: 'Stack was just built this turn' };

  const spBonuses = getSideplayStatBonuses(game, stack, playerId);
  const stat = missionType === 'POWER'
    ? stackPower(stack, spBonuses.power)
    : stackSmarts(stack, spBonuses.smarts);
  if (stat <= 0) return { success: false, error: `Stack has 0 ${missionType.toLowerCase()}` };

  const opponent = opponentOf(game, playerId);

  // Check if opponent has any stacks that can block
  const canAnyBlock = opponent.stacks.some((s) => {
    const defSpBonuses = getSideplayStatBonuses(game, s, s.ownerId);
    const defStat = missionType === 'POWER'
      ? stackPower(s, defSpBonuses.power)
      : stackSmarts(s, defSpBonuses.smarts);
    return !s.tapped && s.cards.some((c) => c.faceUp) && defStat >= Math.ceil(stat / 2);
  });

  // Tap the stack
  stack.tapped = true;
  game.actedStacks.add(stackId);

  const playerIdx = game.players.indexOf(player) as 0 | 1;
  game.playerStats[playerIdx].missionsLaunched++;

  if (!canAnyBlock) {
    // Unblocked - score AP immediately, but attacker can still play a trick
    const spKeywords = getSideplayKeywordBonuses(game, playerId);
    const keywords = getStackKeywords(stack, spKeywords);
    const bonusAP = missionType === 'POWER' ? keywords.powerStrategy : keywords.smartsStrategy;
    const totalAP = 1 + bonusAP;

    game.apScores[playerIdx] += totalAP;
    game.playerStats[playerIdx].apEarned += totalAP;
    game.playerStats[playerIdx].missionsUnblocked++;

    game.lastAction = `${player.playerName}'s ${missionType} mission is unblocked! +${totalAP} AP`;
    addLog(game, playerIdx, `${player.playerName} launches ${missionType} mission — unblocked! +${totalAP} AP`, 'MISSION');

    // Check win
    if (game.apScores[playerIdx] >= AP_TO_WIN) {
      game.winner = playerId;
      game.winReason = 'ap';
      game.lastAction = `${player.playerName} wins with ${game.apScores[playerIdx]} AP!`;
    }

    return { success: true };
  }

  // Clear any previous combat result
  game.combatResult = null;

  // Opponent must decide to block
  game.combatState = {
    attackerStackId: stackId,
    attackerPlayerId: playerId,
    defenderPlayerId: opponent.playerId,
    defenderStackId: null,
    missionType,
    attackerStat: stat,
    defenderStat: 0,
    attackerTrickId: null,
    defenderTrickId: null,
    phase: 'AWAITING_BLOCK',
    isDuel: false,
    atkTrickEffect: null,
    defTrickEffect: null,
  };

  game.pendingInteraction = {
    type: 'BLOCK_DECISION',
    waitingForPlayerId: opponent.playerId,
    timeoutAt: Date.now() + 30000,
  };

  game.lastAction = `${player.playerName} launches a ${missionType} mission!`;
  addLog(game, playerIdx, `${player.playerName} launches a ${missionType} mission`, 'MISSION');
  return { success: true };
}

/** Handle block decision from defender */
export function handleBlockDecision(
  game: GameState,
  playerId: string,
  blockingStackId: string | null
): { success: boolean; error?: string } {
  const combat = game.combatState;
  if (!combat) return { success: false, error: 'No combat in progress' };
  if (combat.phase !== 'AWAITING_BLOCK') return { success: false, error: 'Not awaiting block' };
  if (combat.defenderPlayerId !== playerId) return { success: false, error: 'Not the defender' };

  const defender = findPlayer(game, playerId);
  const attacker = findPlayer(game, combat.attackerPlayerId);

  if (!blockingStackId) {
    // Declined to block - attacker scores
    const attackerStack = findStack(attacker, combat.attackerStackId)!;
    const spKeywords = getSideplayKeywordBonuses(game, combat.attackerPlayerId);
    const keywords = getStackKeywords(attackerStack, spKeywords);
    const bonusAP = combat.missionType === 'POWER' ? keywords.powerStrategy : keywords.smartsStrategy;
    const totalAP = 1 + bonusAP;

    const atkIdx = game.players.indexOf(attacker) as 0 | 1;
    game.apScores[atkIdx] += totalAP;
    game.playerStats[atkIdx].apEarned += totalAP;
    game.playerStats[atkIdx].missionsUnblocked++;

    const defIdx = game.players.indexOf(defender) as 0 | 1;
    addLog(game, defIdx, `${defender.playerName} declined to block`, 'COMBAT');
    addLog(game, atkIdx, `${attacker.playerName} scores ${totalAP} AP`, 'AP');

    game.lastAction = `${defender.playerName} declined to block. ${attacker.playerName} scores ${totalAP} AP!`;
    game.combatState = null;
    game.pendingInteraction = null;

    if (game.apScores[atkIdx] >= AP_TO_WIN) {
      game.winner = combat.attackerPlayerId;
      game.winReason = 'ap';
      game.lastAction = `${attacker.playerName} wins with ${game.apScores[atkIdx]} AP!`;
    }

    return { success: true };
  }

  // Blocking
  const blockStack = findStack(defender, blockingStackId);
  if (!blockStack) return { success: false, error: 'Blocking stack not found' };

  // Check block eligibility with sideplay bonuses
  const blockSpBonuses = getSideplayStatBonuses(game, blockStack, playerId);
  const blockDefStat = combat.missionType === 'POWER'
    ? stackPower(blockStack, blockSpBonuses.power)
    : stackSmarts(blockStack, blockSpBonuses.smarts);
  if (blockStack.tapped || !blockStack.cards.some((c) => c.faceUp) || blockDefStat < Math.ceil(combat.attackerStat / 2)) {
    return { success: false, error: 'Stack cannot block this mission' };
  }

  const defIdx2 = game.players.indexOf(defender) as 0 | 1;
  const atkIdx2 = game.players.indexOf(attacker) as 0 | 1;
  game.playerStats[defIdx2].blocksAttempted++;
  game.playerStats[atkIdx2].missionsBlocked++;

  const defSpBonuses = getSideplayStatBonuses(game, blockStack, playerId);
  const defStat = combat.missionType === 'POWER'
    ? stackPower(blockStack, defSpBonuses.power)
    : stackSmarts(blockStack, defSpBonuses.smarts);
  combat.defenderStackId = blockingStackId;
  combat.defenderStat = defStat;
  blockStack.tapped = true;

  // Defender plays combat trick first
  combat.phase = 'AWAITING_DEFENDER_TRICK';
  game.pendingInteraction = {
    type: 'COMBAT_TRICK',
    waitingForPlayerId: playerId,
    timeoutAt: Date.now() + 30000,
  };

  game.lastAction = `${defender.playerName} blocks with a stack!`;
  addLog(game, game.players.indexOf(defender) as 0 | 1, `${defender.playerName} blocks`, 'COMBAT');
  return { success: true };
}

/** Handle combat trick play */
export function handleCombatTrick(
  game: GameState,
  playerId: string,
  cardInstanceId: string | null
): { success: boolean; error?: string } {
  const combat = game.combatState;
  if (!combat) return { success: false, error: 'No combat in progress' };

  if (combat.phase === 'AWAITING_DEFENDER_TRICK') {
    if (combat.defenderPlayerId !== playerId) return { success: false, error: 'Not the defender' };

    if (cardInstanceId) {
      const defender = findPlayer(game, playerId);
      const card = defender.hand.find((c) => c.instanceId === cardInstanceId);
      if (!card) return { success: false, error: 'Card not in hand' };
      const cardDef = getCardDef(card.cardCode);
      if (!canPlayCombatTrick(cardDef, findStack(defender, combat.defenderStackId!)!)) {
        return { success: false, error: 'Cannot play this as a combat trick' };
      }
      combat.defenderTrickId = cardInstanceId;
      // Parse and store trick effect
      combat.defTrickEffect = parseCombatTrickEffect(cardDef.rulesText);
      // Remove from hand and add to discard
      defender.hand = defender.hand.filter((c) => c.instanceId !== cardInstanceId);
      defender.discardPile.push(card);

      // Apply immediate effects (stuns, restores)
      if (combat.defTrickEffect) {
        const attacker = findPlayer(game, combat.attackerPlayerId);
        const atkStack = findStack(attacker, combat.attackerStackId);
        const defStack = findStack(defender, combat.defenderStackId!);
        if (defStack) {
          applyImmediateTrickEffects(game, combat.defTrickEffect, playerId, defStack, atkStack);
        }
      }
    }

    // Check if defender's trick blocks opponent tricks
    if (combat.defTrickEffect?.blockOpponentTricks) {
      // Skip attacker's trick phase, auto-pass
      const defIdx = game.players.indexOf(findPlayer(game, combat.defenderPlayerId)) as 0 | 1;
      game.playerStats[defIdx].combatTricksUsed++;
      addLog(game, defIdx, `Defender plays a combat trick — blocks opponent's tricks!`, 'COMBAT');
      game.lastAction = `Defender plays a combat trick — blocks opponent's tricks!`;
      return resolveCombat(game);
    }

    // Now attacker plays trick
    combat.phase = 'AWAITING_ATTACKER_TRICK';
    game.pendingInteraction = {
      type: 'COMBAT_TRICK',
      waitingForPlayerId: combat.attackerPlayerId,
      timeoutAt: Date.now() + 30000,
    };

    const defIdx = game.players.indexOf(findPlayer(game, combat.defenderPlayerId)) as 0 | 1;
    if (cardInstanceId) {
      game.playerStats[defIdx].combatTricksUsed++;
      addLog(game, defIdx, `Defender plays a combat trick`, 'COMBAT');
    } else {
      addLog(game, defIdx, `Defender passes on combat trick`, 'COMBAT');
    }
    game.lastAction = cardInstanceId
      ? `Defender plays a combat trick!`
      : `Defender passes on combat trick.`;
    return { success: true };
  }

  if (combat.phase === 'AWAITING_ATTACKER_TRICK') {
    if (combat.attackerPlayerId !== playerId) return { success: false, error: 'Not the attacker' };

    if (cardInstanceId) {
      const attacker = findPlayer(game, playerId);
      const card = attacker.hand.find((c) => c.instanceId === cardInstanceId);
      if (!card) return { success: false, error: 'Card not in hand' };
      const cardDef = getCardDef(card.cardCode);
      if (!canPlayCombatTrick(cardDef, findStack(attacker, combat.attackerStackId)!)) {
        return { success: false, error: 'Cannot play this as a combat trick' };
      }
      combat.attackerTrickId = cardInstanceId;
      // Parse and store trick effect
      combat.atkTrickEffect = parseCombatTrickEffect(cardDef.rulesText);
      attacker.hand = attacker.hand.filter((c) => c.instanceId !== cardInstanceId);
      attacker.discardPile.push(card);

      // Apply immediate effects (stuns, restores)
      if (combat.atkTrickEffect) {
        const defender = findPlayer(game, combat.defenderPlayerId);
        const defStack = combat.defenderStackId ? findStack(defender, combat.defenderStackId) : null;
        const atkStack = findStack(attacker, combat.attackerStackId);
        if (atkStack) {
          applyImmediateTrickEffects(game, combat.atkTrickEffect, playerId, atkStack, defStack);
        }
      }

      // Check if attacker's trick blocks opponent tricks (shouldn't happen since defender already played, but for completeness)
    }

    const atkIdx2 = game.players.indexOf(findPlayer(game, combat.attackerPlayerId)) as 0 | 1;
    if (cardInstanceId) {
      game.playerStats[atkIdx2].combatTricksUsed++;
      addLog(game, atkIdx2, `Attacker plays a combat trick`, 'COMBAT');
    } else {
      addLog(game, atkIdx2, `Attacker passes on combat trick`, 'COMBAT');
    }
    game.lastAction = cardInstanceId
      ? `Attacker plays a combat trick!`
      : `Attacker passes on combat trick.`;

    // Resolve combat
    return resolveCombat(game);
  }

  return { success: false, error: 'Not awaiting a combat trick' };
}

function ensureCardStats(game: GameState, cardCode: string): void {
  if (!game.cardStats[cardCode]) {
    game.cardStats[cardCode] = { timesPlayed: 0, combatWins: 0, combatLosses: 0, trickUses: 0 };
  }
}

function getTopCharacterCode(stack: Stack): string | null {
  for (let i = stack.cards.length - 1; i >= 0; i--) {
    if (stack.cards[i].faceUp) {
      const d = getCardDef(stack.cards[i].cardCode);
      if (d.typeA === 'CHARACTER') return stack.cards[i].cardCode;
    }
  }
  return null;
}

/** Get top character name from a stack */
function getStackTopName(stack: Stack): string {
  for (let i = stack.cards.length - 1; i >= 0; i--) {
    if (stack.cards[i].faceUp) {
      const d = getCardDef(stack.cards[i].cardCode);
      if (d.typeA === 'CHARACTER') return d.name;
    }
  }
  return 'Stack';
}

/** Resolve combat after both tricks are played/passed */
function resolveCombat(game: GameState): { success: boolean; error?: string } {
  const combat = game.combatState!;
  combat.phase = 'RESOLVING';

  const attacker = findPlayer(game, combat.attackerPlayerId);
  const defender = findPlayer(game, combat.defenderPlayerId);
  const atkStack = findStack(attacker, combat.attackerStackId)!;
  const defStack = findStack(defender, combat.defenderStackId!)!;

  // Handle stat switch trick effect
  let missionType = combat.missionType;
  if (combat.atkTrickEffect?.switchStat || combat.defTrickEffect?.switchStat) {
    missionType = missionType === 'POWER' ? 'SMARTS' : 'POWER';
  }

  // Recalculate base stats after immediate effects (stuns may have changed them)
  const atkSpBonuses2 = getSideplayStatBonuses(game, atkStack, combat.attackerPlayerId);
  const defSpBonuses2 = getSideplayStatBonuses(game, defStack, combat.defenderPlayerId);
  let atkBase = missionType === 'POWER'
    ? stackPower(atkStack, atkSpBonuses2.power)
    : stackSmarts(atkStack, atkSpBonuses2.smarts);
  let defBase = missionType === 'POWER'
    ? stackPower(defStack, defSpBonuses2.power)
    : stackSmarts(defStack, defSpBonuses2.smarts);

  // Handle reduce opposing character power
  if (combat.defTrickEffect?.reduceOpposingCharacterPower && missionType === 'POWER') {
    // Reduce attacker's top character power to 0 — recalculate without it
    let reducedPower = 0;
    for (const c of atkStack.cards) {
      if (!c.faceUp) continue;
      const d = defOf(c);
      if (d.typeA === 'EQUIPMENT') reducedPower += d.power;
      // Skip CHARACTER power contribution (set to 0)
    }
    atkBase = reducedPower;
  }
  if (combat.atkTrickEffect?.reduceOpposingCharacterPower && missionType === 'POWER') {
    let reducedPower = 0;
    for (const c of defStack.cards) {
      if (!c.faceUp) continue;
      const d = defOf(c);
      if (d.typeA === 'EQUIPMENT') reducedPower += d.power;
    }
    defBase = reducedPower;
  }

  // Calculate trick stat bonuses
  let atkTrickName: string | null = null;
  let atkTrickBonus = 0;
  let defTrickName: string | null = null;
  let defTrickBonus = 0;

  if (combat.attackerTrickId) {
    const trickCard = [...attacker.discardPile].find((c) => c.instanceId === combat.attackerTrickId);
    if (trickCard) {
      const td = getCardDef(trickCard.cardCode);
      atkTrickName = td.name;
      // Use card's raw stat + effect-based bonus
      atkTrickBonus = (missionType === 'POWER' ? td.power : td.smarts);
      if (combat.atkTrickEffect) {
        atkTrickBonus += calculateTrickStatBonus(combat.atkTrickEffect, missionType, atkStack);
      }
    }
  }

  if (combat.defenderTrickId) {
    const trickCard = [...defender.discardPile].find((c) => c.instanceId === combat.defenderTrickId);
    if (trickCard) {
      const td = getCardDef(trickCard.cardCode);
      defTrickName = td.name;
      defTrickBonus = (missionType === 'POWER' ? td.power : td.smarts);
      if (combat.defTrickEffect) {
        defTrickBonus += calculateTrickStatBonus(combat.defTrickEffect, missionType, defStack);
      }
    }
  }

  let atkTotal = atkBase + atkTrickBonus;
  let defTotal = defBase + defTrickBonus;

  // Get keywords with sideplay bonuses
  const atkSpKeywords = getSideplayKeywordBonuses(game, combat.attackerPlayerId);
  const defSpKeywords = getSideplayKeywordBonuses(game, combat.defenderPlayerId);
  const atkKeywords = getStackKeywords(atkStack, atkSpKeywords);
  const defKeywords = getStackKeywords(defStack, defSpKeywords);

  // Add trick-based keyword bonuses
  let atkVicious = atkKeywords.vicious;
  let defVicious = defKeywords.vicious;
  if (combat.atkTrickEffect) atkVicious += calculateTrickViciousBonus(combat.atkTrickEffect, atkStack);
  if (combat.defTrickEffect) defVicious += calculateTrickViciousBonus(combat.defTrickEffect, defStack);

  // Strategy bonuses from tricks
  if (combat.atkTrickEffect?.powerStrategyBonus && missionType === 'POWER') {
    // Power Strategy from trick doesn't add stat, it adds bonus AP — but only on unblocked
    // Since we're in blocked combat, this doesn't do anything extra for AP
  }
  if (combat.atkTrickEffect?.smartsStrategyBonus && missionType === 'SMARTS') {
    // Same
  }

  // Check no-damage flags
  const noDamage = !!(combat.atkTrickEffect?.noDamageThisCombat || combat.defTrickEffect?.noDamageThisCombat);
  const atkNoDamage = !!(combat.atkTrickEffect?.thisStackNoDamage);
  const defNoDamage = !!(combat.defTrickEffect?.thisStackNoDamage);

  // Determine loser(s)
  const atkLoses = defTotal >= atkTotal; // tie = both lose
  const defLoses = atkTotal >= defTotal;

  const results: string[] = [];
  let attackerDamage = 0;
  let defenderDamage = 0;

  const atkPlayerIdx = game.players.indexOf(attacker) as 0 | 1;
  const defPlayerIdx = game.players.indexOf(defender) as 0 | 1;

  if (defLoses && !noDamage && !defNoDamage) {
    const dmg = 1 + atkVicious;
    defenderDamage = dmg;
    applyDamage(defStack, defender, dmg);
    results.push(`Defender takes ${dmg} damage`);
    game.playerStats[atkPlayerIdx].damageDealt += dmg;
  } else if (defLoses && (noDamage || defNoDamage)) {
    results.push(`Defender would take damage but is protected`);
  }

  if (atkLoses && !noDamage && !atkNoDamage) {
    const dmg = 1 + defVicious;
    attackerDamage = dmg;
    applyDamage(atkStack, attacker, dmg);
    results.push(`Attacker takes ${dmg} damage`);
    game.playerStats[defPlayerIdx].damageDealt += dmg;
  } else if (atkLoses && (noDamage || atkNoDamage)) {
    results.push(`Attacker would take damage but is protected`);
  }

  // Determine outcome
  let outcome: 'ATK_WIN' | 'DEF_WIN' | 'TIE';
  if (atkTotal > defTotal) outcome = 'ATK_WIN';
  else if (defTotal > atkTotal) outcome = 'DEF_WIN';
  else outcome = 'TIE';

  // Award AP for winning a blocked combat (non-duel)
  let apAwarded = 0;
  if (outcome === 'ATK_WIN' && !combat.isDuel) {
    apAwarded = 1;
    game.apScores[atkPlayerIdx] += apAwarded;
    game.playerStats[atkPlayerIdx].apEarned += apAwarded;
    addLog(game, atkPlayerIdx, `Attacker wins combat — +${apAwarded} AP`, 'AP');
    if (game.apScores[atkPlayerIdx] >= AP_TO_WIN) {
      game.winner = combat.attackerPlayerId;
      game.winReason = 'ap';
    }
  }

  // Build CombatResult
  const combatResult: CombatResult = {
    missionType,
    isDuel: combat.isDuel,
    attackerName: attacker.playerName,
    defenderName: defender.playerName,
    attackerStackName: getStackTopName(atkStack),
    defenderStackName: getStackTopName(defStack),
    attackerBase: atkBase,
    defenderBase: defBase,
    attackerTrickName: atkTrickName,
    attackerTrickBonus: atkTrickBonus,
    defenderTrickName: defTrickName,
    defenderTrickBonus: defTrickBonus,
    attackerTotal: atkTotal,
    defenderTotal: defTotal,
    outcome,
    attackerDamage,
    defenderDamage,
    apAwarded,
  };
  game.combatResult = combatResult;

  // Apply post-combat trick effects (draw, damage to opposing stack, untap prevention)
  if (combat.atkTrickEffect) {
    applyPostCombatTrickEffects(
      game, combat.atkTrickEffect, combat.attackerPlayerId,
      atkStack, defStack, attackerDamage > 0
    );
  }
  if (combat.defTrickEffect) {
    applyPostCombatTrickEffects(
      game, combat.defTrickEffect, combat.defenderPlayerId,
      defStack, atkStack, defenderDamage > 0
    );
  }

  // Track blocksSucceeded
  if (outcome === 'DEF_WIN') {
    game.playerStats[defPlayerIdx].blocksSucceeded++;
  }

  // Per-card combat wins/losses (top character of each stack)
  const atkTopCard = getTopCharacterCode(atkStack);
  const defTopCard = getTopCharacterCode(defStack);
  if (atkTopCard) {
    ensureCardStats(game, atkTopCard);
    if (outcome === 'ATK_WIN') game.cardStats[atkTopCard].combatWins++;
    else game.cardStats[atkTopCard].combatLosses++;
  }
  if (defTopCard) {
    ensureCardStats(game, defTopCard);
    if (outcome === 'DEF_WIN') game.cardStats[defTopCard].combatWins++;
    else game.cardStats[defTopCard].combatLosses++;
  }

  // Track trick uses on card stats
  if (combat.attackerTrickId) {
    const trickCard = attacker.discardPile.find((c) => c.instanceId === combat.attackerTrickId);
    if (trickCard) {
      ensureCardStats(game, trickCard.cardCode);
      game.cardStats[trickCard.cardCode].trickUses++;
    }
  }
  if (combat.defenderTrickId) {
    const trickCard = defender.discardPile.find((c) => c.instanceId === combat.defenderTrickId);
    if (trickCard) {
      ensureCardStats(game, trickCard.cardCode);
      game.cardStats[trickCard.cardCode].trickUses++;
    }
  }

  game.lastAction = `Combat resolved (ATK ${atkTotal} vs DEF ${defTotal}): ${results.join(', ')}`;
  addLog(game, null, `Combat resolved (ATK ${atkTotal} vs DEF ${defTotal}): ${results.join(', ')}`, 'COMBAT');

  // Track stacksLost before cleanup
  const atkStackLost = atkStack.cards.length === 0;
  const defStackLost = defStack.cards.length === 0;
  if (atkStackLost) game.playerStats[atkPlayerIdx].stacksLost++;
  if (defStackLost) game.playerStats[defPlayerIdx].stacksLost++;

  // Clean up empty stacks
  attacker.stacks = attacker.stacks.filter((s) => s.cards.length > 0);
  defender.stacks = defender.stacks.filter((s) => s.cards.length > 0);

  game.combatState = null;
  game.pendingInteraction = null;
  return { success: true };
}

/** Apply damage to a stack: flip face-down, or discard if already face-down */
function applyDamage(stack: Stack, player: PlayerZone, amount: number): void {
  for (let i = 0; i < amount && stack.cards.length > 0; i++) {
    // Find the first face-down card to discard, or flip a face-up card
    const faceDownIdx = stack.cards.findIndex((c) => !c.faceUp);
    if (faceDownIdx >= 0) {
      // Discard face-down card
      const removed = stack.cards.splice(faceDownIdx, 1)[0];
      player.discardPile.push(removed);
    } else {
      // Flip a face-up card face-down (top card)
      const topIdx = stack.cards.length - 1;
      if (topIdx >= 0) {
        stack.cards[topIdx].faceUp = false;
      }
    }
  }
}

/** Start a duel (forced combat, no AP) */
export function startDuel(
  game: GameState,
  playerId: string,
  attackerStackId: string,
  targetStackId: string
): { success: boolean; error?: string } {
  if (game.turnPhase !== 'ACTION') return { success: false, error: 'Not in action phase' };
  if (game.combatState) return { success: false, error: 'Combat already in progress' };
  if (game.actedStacks.has(attackerStackId)) return { success: false, error: 'Stack already acted' };

  const player = findPlayer(game, playerId);
  const opponent = opponentOf(game, playerId);
  const atkStack = findStack(player, attackerStackId);
  const defStack = findStack(opponent, targetStackId);

  if (!atkStack) return { success: false, error: 'Attacker stack not found' };
  if (!defStack) return { success: false, error: 'Target stack not found' };
  if (atkStack.tapped) return { success: false, error: 'Attacker stack is tapped' };
  if (atkStack.createdOnTurn === game.turnNumber) return { success: false, error: 'Stack was just built this turn' };

  // Duel uses Power by default
  const atkSpBonuses = getSideplayStatBonuses(game, atkStack, playerId);
  const defSpBonuses2 = getSideplayStatBonuses(game, defStack, opponent.playerId);
  const atkStat = stackPower(atkStack, atkSpBonuses.power);
  const defStat = stackPower(defStack, defSpBonuses2.power);

  atkStack.tapped = true;
  game.actedStacks.add(attackerStackId);
  // Defender doesn't need to be untapped for duel

  const duelPlayerIdx = game.players.indexOf(player) as 0 | 1;
  game.playerStats[duelPlayerIdx].duelsInitiated++;
  game.combatResult = null;

  game.combatState = {
    attackerStackId,
    attackerPlayerId: playerId,
    defenderPlayerId: opponent.playerId,
    defenderStackId: targetStackId,
    missionType: 'POWER',
    attackerStat: atkStat,
    defenderStat: defStat,
    attackerTrickId: null,
    defenderTrickId: null,
    phase: 'AWAITING_DEFENDER_TRICK',
    isDuel: true,
    atkTrickEffect: null,
    defTrickEffect: null,
  };

  game.pendingInteraction = {
    type: 'COMBAT_TRICK',
    waitingForPlayerId: opponent.playerId,
    timeoutAt: Date.now() + 30000,
  };

  game.lastAction = `${player.playerName} initiates a duel!`;
  addLog(game, duelPlayerIdx, `${player.playerName} initiates a duel`, 'COMBAT');
  return { success: true };
}

/** Play an Action card from hand using a stack */
export function playActionCard(
  game: GameState,
  playerId: string,
  cardInstanceId: string,
  stackId: string
): { success: boolean; error?: string } {
  if (game.turnPhase !== 'ACTION') return { success: false, error: 'Not in action phase' };
  if (game.actedStacks.has(stackId)) return { success: false, error: 'Stack already acted' };

  const player = findPlayer(game, playerId);
  const stack = findStack(player, stackId);
  if (!stack) return { success: false, error: 'Stack not found' };
  if (stack.tapped) return { success: false, error: 'Stack is tapped' };

  const card = player.hand.find((c) => c.instanceId === cardInstanceId);
  if (!card) return { success: false, error: 'Card not in hand' };

  const cardDef = getCardDef(card.cardCode);
  if (cardDef.typeA !== 'ACTION') return { success: false, error: 'Not an action card' };

  // Check cost and color
  if (stack.cards.length < cardDef.cost) {
    return { success: false, error: `Stack size ${stack.cards.length} < action cost ${cardDef.cost}` };
  }
  if (cardDef.color !== 'none') {
    const sColor = stack.cards.find((c) => {
      const d = getCardDef(c.cardCode);
      return d.typeA === 'CHARACTER';
    });
    if (sColor) {
      const baseColor = getCardDef(sColor.cardCode).color;
      if (baseColor !== 'none' && baseColor !== cardDef.color) {
        return { success: false, error: 'Action color doesn\'t match stack' };
      }
    }
  }

  // Tap the stack and mark as acted
  stack.tapped = true;
  game.actedStacks.add(stackId);

  // Remove from hand
  player.hand = player.hand.filter((c) => c.instanceId !== cardInstanceId);

  const actionPlayerIdx = game.players.indexOf(player) as 0 | 1;
  game.playerStats[actionPlayerIdx].cardsPlayed++;
  game.playerStats[actionPlayerIdx].actionsPlayed++;
  trackCardPlayed(game, card.cardCode);

  // Check if it's a Sideplay card
  if (cardDef.typeB === 'SIDEPLAY') {
    player.sideplay.push(card);
    game.lastAction = `${player.playerName} played ${cardDef.name} to sideplay`;
    addLog(game, actionPlayerIdx, `${player.playerName} played ${cardDef.name} to sideplay`, 'BUILD');
  } else {
    player.discardPile.push(card);
    game.lastAction = `${player.playerName} played action: ${cardDef.name}`;
    addLog(game, actionPlayerIdx, `${player.playerName} played action: ${cardDef.name}`, 'BUILD');

    // Execute action card effects
    handleActionEffect(game, playerId, cardDef, stackId);
  }

  return { success: true };
}
