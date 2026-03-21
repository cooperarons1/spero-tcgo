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
    createdOnTurn: stack.createdOnTurn,
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
    discard: opp.discardPile.map((c) => toClientCard(c, true)),
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

  const TURN_TIMEOUT_MS = 60_000;
  const turnDeadline = game.turnStartedAt && !game.winner
    ? game.turnStartedAt + TURN_TIMEOUT_MS
    : null;

  const isGameOver = !!game.winner;

  return {
    myPlayerId: playerId,
    myPlayerIndex: myIdx as 0 | 1,
    myPlayerName: me.playerName,
    myHand: me.hand.map((c) => toClientCard(c, true)),
    myStacks: me.stacks.map((s) => toClientStack(s, true)),
    mySideplay: me.sideplay.map((c) => toClientCard(c, true)),
    myDiscardCount: me.discardPile.length,
    myDiscard: me.discardPile.map((c) => toClientCard(c, true)),
    opponent,
    deckCount: game.decks[myIdx].length,
    opponentDeckCount: game.decks[oppIdx].length,
    currentPlayerIndex: game.currentPlayerIndex,
    turnPhase: game.turnPhase,
    buildsRemaining: game.buildsRemaining,
    actedStacks: Array.from(game.actedStacks),
    apScores: game.apScores,
    winner: game.winner,
    winReason: game.winReason,
    turnNumber: game.turnNumber,
    isFirstTurn: game.isFirstTurn,
    combatState: clientCombat,
    pendingInteraction: game.pendingInteraction,
    lastAction: game.lastAction,
    log: game.log,
    playerStats: game.playerStats,
    combatResult: game.combatResult ?? null,
    turnDeadline,
    cardStats: isGameOver ? game.cardStats : null,
    apTimeline: isGameOver ? game.apTimeline : null,
    turnDurations: isGameOver ? game.turnDurations : null,
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
