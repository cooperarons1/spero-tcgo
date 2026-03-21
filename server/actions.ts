import type { GameState, CardInstance, Stack, PlayerZone } from '../shared/types.js';
import { getCardDef } from './cards.js';
import { canBuildOnStack, defOf } from './rules.js';
import { advancePhase, trackCardPlayed } from './game.js';
import { addLog } from './log.js';
import { handleOnPlay } from './abilities.js';

let nextStackId = 1;

export function resetStackCounter(): void {
  nextStackId = 1;
}

function findPlayer(game: GameState, playerId: string): PlayerZone {
  const p = game.players.find((z) => z.playerId === playerId);
  if (!p) throw new Error(`Player ${playerId} not found`);
  return p;
}

function removeFromHand(player: PlayerZone, instanceId: string): CardInstance {
  const idx = player.hand.findIndex((c) => c.instanceId === instanceId);
  if (idx === -1) throw new Error(`Card ${instanceId} not in hand`);
  return player.hand.splice(idx, 1)[0];
}

/** Play a card from hand to a stack (or create new stack). Uses 1 build. */
export function buildCard(
  game: GameState,
  playerId: string,
  cardInstanceId: string,
  targetStackId: string | null,
  faceDown: boolean
): { success: boolean; error?: string } {
  if (game.turnPhase !== 'BUILD') return { success: false, error: 'Not in build phase' };
  if (game.buildsRemaining <= 0) return { success: false, error: 'No builds remaining' };
  if (game.players[game.currentPlayerIndex].playerId !== playerId) {
    return { success: false, error: 'Not your turn' };
  }

  const player = findPlayer(game, playerId);
  const card = player.hand.find((c) => c.instanceId === cardInstanceId);
  if (!card) return { success: false, error: 'Card not in hand' };

  const cardDef = getCardDef(card.cardCode);

  if (faceDown) {
    // Playing face-down: any card can go face-down on any stack or start a new one
    const removed = removeFromHand(player, cardInstanceId);
    removed.faceUp = false;

    if (targetStackId) {
      const stack = player.stacks.find((s) => s.stackId === targetStackId);
      if (!stack) return { success: false, error: 'Stack not found' };
      stack.cards.push(removed);
    } else {
      player.stacks.push({
        stackId: `stack-${nextStackId++}`,
        cards: [removed],
        tapped: false,
        ownerId: playerId,
        createdOnTurn: game.turnNumber,
      });
    }

    game.buildsRemaining--;
    game.lastAction = `${player.playerName} played a card face-down`;
    const pIdx = game.players.indexOf(player) as 0 | 1;
    addLog(game, pIdx, `${player.playerName} played a card face-down`, 'BUILD');
    game.playerStats[pIdx].cardsPlayed++;
    game.playerStats[pIdx].buildsUsed++;
    game.playerStats[pIdx].buildsFaceDown++;
    trackCardPlayed(game, removed.cardCode);
    if (game.buildsRemaining <= 0) advancePhase(game);
    return { success: true };
  }

  // Face-up play: validate
  let targetStack: Stack | null = null;
  if (targetStackId) {
    targetStack = player.stacks.find((s) => s.stackId === targetStackId) ?? null;
    if (!targetStack) return { success: false, error: 'Stack not found' };
  }

  const check = canBuildOnStack(cardDef, targetStack, player);
  if (!check.ok) return { success: false, error: check.reason };

  const removed = removeFromHand(player, cardInstanceId);
  removed.faceUp = true;

  if (targetStack) {
    targetStack.cards.push(removed);
  } else {
    player.stacks.push({
      stackId: `stack-${nextStackId++}`,
      cards: [removed],
      tapped: false,
      ownerId: playerId,
      createdOnTurn: game.turnNumber,
    });
  }

  game.buildsRemaining--;
  game.lastAction = `${player.playerName} played ${cardDef.name}`;
  const pIdx2 = game.players.indexOf(player) as 0 | 1;
  addLog(game, pIdx2, `${player.playerName} played ${cardDef.name}`, 'BUILD');
  game.playerStats[pIdx2].cardsPlayed++;
  game.playerStats[pIdx2].buildsUsed++;
  trackCardPlayed(game, removed.cardCode);

  // Handle on-play triggers for face-up cards
  if (cardDef.rulesText) {
    const stackId = targetStack ? targetStack.stackId : player.stacks[player.stacks.length - 1].stackId;
    handleOnPlay(game, playerId, cardDef, stackId);
  }

  if (game.buildsRemaining <= 0) advancePhase(game);
  return { success: true };
}

/** Split cards from a stack into a new stack. Costs 1 build. */
export function splitStack(
  game: GameState,
  playerId: string,
  stackId: string,
  cardInstanceIds: string[]
): { success: boolean; error?: string } {
  if (game.turnPhase !== 'BUILD') return { success: false, error: 'Not in build phase' };
  if (game.buildsRemaining <= 0) return { success: false, error: 'No builds remaining' };

  const player = findPlayer(game, playerId);
  const stack = player.stacks.find((s) => s.stackId === stackId);
  if (!stack) return { success: false, error: 'Stack not found' };

  if (cardInstanceIds.length === 0 || cardInstanceIds.length >= stack.cards.length) {
    return { success: false, error: 'Must split into two non-empty stacks' };
  }

  const splitCards: CardInstance[] = [];
  const remainCards: CardInstance[] = [];

  for (const c of stack.cards) {
    if (cardInstanceIds.includes(c.instanceId)) {
      splitCards.push(c);
    } else {
      remainCards.push(c);
    }
  }

  if (splitCards.length !== cardInstanceIds.length) {
    return { success: false, error: 'Some cards not found in stack' };
  }

  stack.cards = remainCards;
  player.stacks.push({
    stackId: `stack-${nextStackId++}`,
    cards: splitCards,
    tapped: stack.tapped, // inherits tapped state
    ownerId: playerId,
    createdOnTurn: game.turnNumber,
  });

  game.buildsRemaining--;
  game.lastAction = `${player.playerName} split a stack`;
  addLog(game, game.players.indexOf(player) as 0 | 1, `${player.playerName} split a stack`, 'BUILD');
  if (game.buildsRemaining <= 0) advancePhase(game);
  return { success: true };
}

/** Combine two stacks. Costs 1 build. */
export function combineStacks(
  game: GameState,
  playerId: string,
  stackId1: string,
  stackId2: string
): { success: boolean; error?: string } {
  if (game.turnPhase !== 'BUILD') return { success: false, error: 'Not in build phase' };
  if (game.buildsRemaining <= 0) return { success: false, error: 'No builds remaining' };

  const player = findPlayer(game, playerId);
  const s1 = player.stacks.find((s) => s.stackId === stackId1);
  const s2 = player.stacks.find((s) => s.stackId === stackId2);
  if (!s1 || !s2) return { success: false, error: 'Stack not found' };
  if (s1 === s2) return { success: false, error: 'Cannot combine a stack with itself' };

  // Check no duplicate names
  const names1 = s1.cards.filter((c) => c.faceUp).map((c) => defOf(c).name);
  const names2 = s2.cards.filter((c) => c.faceUp).map((c) => defOf(c).name);
  for (const n of names2) {
    if (names1.includes(n)) {
      return { success: false, error: `Duplicate card name: ${n}` };
    }
  }

  // Merge s2 into s1
  s1.cards.push(...s2.cards);
  if (s1.tapped || s2.tapped) s1.tapped = true;
  player.stacks = player.stacks.filter((s) => s.stackId !== stackId2);

  game.buildsRemaining--;
  game.lastAction = `${player.playerName} combined stacks`;
  addLog(game, game.players.indexOf(player) as 0 | 1, `${player.playerName} combined stacks`, 'BUILD');
  if (game.buildsRemaining <= 0) advancePhase(game);
  return { success: true };
}

/** Restore: flip a face-down card face-up. Costs 1 build. */
export function restoreCard(
  game: GameState,
  playerId: string,
  stackId: string,
  cardInstanceId: string
): { success: boolean; error?: string } {
  if (game.turnPhase !== 'BUILD') return { success: false, error: 'Not in build phase' };
  if (game.buildsRemaining <= 0) return { success: false, error: 'No builds remaining' };

  const player = findPlayer(game, playerId);
  const stack = player.stacks.find((s) => s.stackId === stackId);
  if (!stack) return { success: false, error: 'Stack not found' };

  const card = stack.cards.find((c) => c.instanceId === cardInstanceId);
  if (!card) return { success: false, error: 'Card not found in stack' };
  if (card.faceUp) return { success: false, error: 'Card is already face-up' };

  const cardDef = getCardDef(card.cardCode);

  // Check cost requirement for restore
  const faceUpCount = stack.cards.filter((c) => c.faceUp).length;
  const totalSize = stack.cards.length;
  if (totalSize < cardDef.cost) {
    return { success: false, error: `Stack size ${totalSize} < card cost ${cardDef.cost}` };
  }

  card.faceUp = true;
  game.buildsRemaining--;
  game.lastAction = `${player.playerName} restored ${cardDef.name}`;
  addLog(game, game.players.indexOf(player) as 0 | 1, `${player.playerName} restored ${cardDef.name}`, 'BUILD');
  if (game.buildsRemaining <= 0) advancePhase(game);
  return { success: true };
}
