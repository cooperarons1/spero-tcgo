import type { GameState, CombatState, CombatResult, Stack, PlayerZone } from '../shared/types.js';
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

  const stat = missionType === 'POWER' ? stackPower(stack) : stackSmarts(stack);
  if (stat <= 0) return { success: false, error: `Stack has 0 ${missionType.toLowerCase()}` };

  const opponent = opponentOf(game, playerId);

  // Check if opponent has any stacks that can block
  const canAnyBlock = opponent.stacks.some((s) => canBlock(s, missionType, stat));

  // Tap the stack
  stack.tapped = true;
  game.actedStacks.add(stackId);

  const playerIdx = game.players.indexOf(player) as 0 | 1;
  game.playerStats[playerIdx].missionsLaunched++;

  if (!canAnyBlock) {
    // Unblocked - score AP immediately, but attacker can still play a trick
    const keywords = getStackKeywords(stack);
    const bonusAP = missionType === 'POWER' ? keywords.powerStrategy : keywords.smartsStrategy;
    const totalAP = 1 + bonusAP;

    game.apScores[playerIdx] += totalAP;
    game.playerStats[playerIdx].apEarned += totalAP;
    game.playerStats[playerIdx].missionsUnblocked++;

    game.lastAction = `${player.playerName}'s ${missionType} mission is unblocked! +${totalAP} AP`;
    addLog(game, playerIdx, `${player.playerName} launches ${missionType} mission — unblocked! +${totalAP} AP`, 'MISSION');

    // Check win
    if (game.apScores[playerIdx] >= 15) {
      game.winner = playerId;
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
    const keywords = getStackKeywords(attackerStack);
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

    if (game.apScores[atkIdx] >= 15) {
      game.winner = combat.attackerPlayerId;
      game.lastAction = `${attacker.playerName} wins with ${game.apScores[atkIdx]} AP!`;
    }

    return { success: true };
  }

  // Blocking
  const blockStack = findStack(defender, blockingStackId);
  if (!blockStack) return { success: false, error: 'Blocking stack not found' };

  if (!canBlock(blockStack, combat.missionType, combat.attackerStat)) {
    return { success: false, error: 'Stack cannot block this mission' };
  }

  const defStat = combat.missionType === 'POWER' ? stackPower(blockStack) : stackSmarts(blockStack);
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
      // Remove from hand and add to discard
      defender.hand = defender.hand.filter((c) => c.instanceId !== cardInstanceId);
      defender.discardPile.push(card);
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
      attacker.hand = attacker.hand.filter((c) => c.instanceId !== cardInstanceId);
      attacker.discardPile.push(card);
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

  // Calculate final stats including tricks
  let atkTotal = combat.attackerStat;
  let defTotal = combat.defenderStat;

  let atkTrickName: string | null = null;
  let atkTrickBonus = 0;
  let defTrickName: string | null = null;
  let defTrickBonus = 0;

  if (combat.attackerTrickId) {
    const trickCard = [...attacker.discardPile].find((c) => c.instanceId === combat.attackerTrickId);
    if (trickCard) {
      const td = getCardDef(trickCard.cardCode);
      atkTrickBonus = combat.missionType === 'POWER' ? td.power : td.smarts;
      atkTrickName = td.name;
      atkTotal += atkTrickBonus;
    }
  }

  if (combat.defenderTrickId) {
    const trickCard = [...defender.discardPile].find((c) => c.instanceId === combat.defenderTrickId);
    if (trickCard) {
      const td = getCardDef(trickCard.cardCode);
      defTrickBonus = combat.missionType === 'POWER' ? td.power : td.smarts;
      defTrickName = td.name;
      defTotal += defTrickBonus;
    }
  }

  // Get keywords
  const atkKeywords = getStackKeywords(atkStack);
  const defKeywords = getStackKeywords(defStack);

  // Determine loser(s)
  const atkLoses = defTotal >= atkTotal; // tie = both lose
  const defLoses = atkTotal >= defTotal;

  const results: string[] = [];
  let attackerDamage = 0;
  let defenderDamage = 0;

  const atkPlayerIdx = game.players.indexOf(attacker) as 0 | 1;
  const defPlayerIdx = game.players.indexOf(defender) as 0 | 1;

  if (defLoses) {
    const dmg = 1 + atkKeywords.vicious;
    defenderDamage = dmg;
    applyDamage(defStack, defender, dmg);
    results.push(`Defender takes ${dmg} damage`);
    game.playerStats[atkPlayerIdx].damageDealt += dmg;
  }

  if (atkLoses) {
    const dmg = 1 + defKeywords.vicious;
    attackerDamage = dmg;
    applyDamage(atkStack, attacker, dmg);
    results.push(`Attacker takes ${dmg} damage`);
    game.playerStats[defPlayerIdx].damageDealt += dmg;
  }

  // Determine outcome
  let outcome: 'ATK_WIN' | 'DEF_WIN' | 'TIE';
  if (atkTotal > defTotal) outcome = 'ATK_WIN';
  else if (defTotal > atkTotal) outcome = 'DEF_WIN';
  else outcome = 'TIE';

  // Build CombatResult
  const combatResult: CombatResult = {
    missionType: combat.missionType,
    isDuel: combat.isDuel,
    attackerName: attacker.playerName,
    defenderName: defender.playerName,
    attackerStackName: getStackTopName(atkStack),
    defenderStackName: getStackTopName(defStack),
    attackerBase: combat.attackerStat,
    defenderBase: combat.defenderStat,
    attackerTrickName: atkTrickName,
    attackerTrickBonus: atkTrickBonus,
    defenderTrickName: defTrickName,
    defenderTrickBonus: defTrickBonus,
    attackerTotal: atkTotal,
    defenderTotal: defTotal,
    outcome,
    attackerDamage,
    defenderDamage,
    apAwarded: 0,
  };
  game.combatResult = combatResult;

  game.lastAction = `Combat resolved (ATK ${atkTotal} vs DEF ${defTotal}): ${results.join(', ')}`;
  addLog(game, null, `Combat resolved (ATK ${atkTotal} vs DEF ${defTotal}): ${results.join(', ')}`, 'COMBAT');

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

  // Duel uses Power by default
  const atkStat = stackPower(atkStack);
  const defStat = stackPower(defStack);

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

  // Check if it's a Sideplay card
  if (cardDef.typeB === 'SIDEPLAY') {
    player.sideplay.push(card);
    game.lastAction = `${player.playerName} played ${cardDef.name} to sideplay`;
    addLog(game, actionPlayerIdx, `${player.playerName} played ${cardDef.name} to sideplay`, 'BUILD');
  } else {
    player.discardPile.push(card);
    game.lastAction = `${player.playerName} played action: ${cardDef.name}`;
    addLog(game, actionPlayerIdx, `${player.playerName} played action: ${cardDef.name}`, 'BUILD');
  }

  return { success: true };
}
