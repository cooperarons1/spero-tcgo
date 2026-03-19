import type {
  GameState,
  ClientGameState,
  ClientCardInstance,
  ClientStack,
  ClientPlayerInfo,
  ClientCombatState,
  Stack,
  CardInstance,
} from '../shared/types.js';

/** Convert a CardInstance to a client-visible version */
function toClientCard(card: CardInstance, isOwner: boolean): ClientCardInstance {
  return {
    instanceId: card.instanceId,
    cardCode: isOwner || card.faceUp ? card.cardCode : null,
    faceUp: card.faceUp,
  };
}

/** Convert a Stack to a client-visible version */
function toClientStack(stack: Stack, isOwner: boolean): ClientStack {
  return {
    stackId: stack.stackId,
    cards: stack.cards.map((c) => toClientCard(c, isOwner)),
    tapped: stack.tapped,
    ownerId: stack.ownerId,
  };
}

/** Sanitize game state for a specific player */
export function getClientState(game: GameState, playerId: string): ClientGameState {
  const myIdx = game.players.findIndex((p) => p.playerId === playerId);
  const oppIdx = myIdx === 0 ? 1 : 0;
  const me = game.players[myIdx];
  const opp = game.players[oppIdx];

  const opponent: ClientPlayerInfo = {
    playerId: opp.playerId,
    playerName: opp.playerName,
    handCount: opp.hand.length,
    stacks: opp.stacks.map((s) => toClientStack(s, false)),
    sideplay: opp.sideplay.map((c) => toClientCard(c, false)),
    discardCount: opp.discardPile.length,
  };

  // Combat state sanitization
  let clientCombat: ClientCombatState | null = null;
  if (game.combatState) {
    const cs = game.combatState;
    const isResolved = cs.phase === 'RESOLVING';
    clientCombat = {
      attackerStackId: cs.attackerStackId,
      attackerPlayerId: cs.attackerPlayerId,
      defenderPlayerId: cs.defenderPlayerId,
      defenderStackId: cs.defenderStackId,
      missionType: cs.missionType,
      attackerStat: cs.attackerStat,
      defenderStat: cs.defenderStat,
      phase: cs.phase,
      isDuel: cs.isDuel,
      // Only reveal tricks after resolution
      attackerTrickCode: isResolved && cs.attackerTrickId ? findTrickCode(game, cs.attackerTrickId) : null,
      defenderTrickCode: isResolved && cs.defenderTrickId ? findTrickCode(game, cs.defenderTrickId) : null,
    };
  }

  return {
    myPlayerId: playerId,
    myHand: me.hand.map((c) => toClientCard(c, true)),
    myStacks: me.stacks.map((s) => toClientStack(s, true)),
    mySideplay: me.sideplay.map((c) => toClientCard(c, true)),
    myDiscardCount: me.discardPile.length,
    opponent,
    deckCount: game.deck.length,
    currentPlayerIndex: game.currentPlayerIndex,
    turnPhase: game.turnPhase,
    buildsRemaining: game.buildsRemaining,
    actedStacks: Array.from(game.actedStacks),
    apScores: game.apScores,
    winner: game.winner,
    turnNumber: game.turnNumber,
    isFirstTurn: game.isFirstTurn,
    combatState: clientCombat,
    pendingInteraction: game.pendingInteraction,
    lastAction: game.lastAction,
  };
}

function findTrickCode(game: GameState, instanceId: string): string | null {
  for (const p of game.players) {
    for (const c of p.discardPile) {
      if (c.instanceId === instanceId) return c.cardCode;
    }
  }
  return null;
}
