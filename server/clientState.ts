import type {
  GameState,
  ClientGameState,
  ClientCardInstance,
  ClientPlayerInfo,
  PendingInteraction,
} from '../shared/types.js';
import { TURN_TIMEOUT_MS } from '../shared/types.js';

/** Sanitize game state for a specific player */
export function getClientState(game: GameState, playerId: string): ClientGameState {
  const myIdx = game.players.findIndex((p) => p.playerId === playerId);
  const oppIdx = myIdx === 0 ? 1 : 0;
  const me = game.players[myIdx];
  const opp = game.players[oppIdx];

  // My hand: full visibility
  const myHand: ClientCardInstance[] = me.hand.map((c) => ({
    instanceId: c.instanceId,
    cardCode: c.cardCode,
  }));

  const opponent: ClientPlayerInfo = {
    playerId: opp.playerId,
    playerName: opp.playerName,
    heroClass: opp.heroClass,
    health: opp.health,
    maxHealth: opp.maxHealth,
    armor: opp.armor,
    mana: opp.mana,
    maxMana: opp.maxMana,
    handCount: opp.hand.length,
    board: opp.board,
    weapon: opp.weapon,
    heroPowerUsed: opp.heroPowerUsed,
    fatigueDamage: opp.fatigueDamage,
    graveyardCount: opp.graveyard.length,
  };

  const turnDeadline = game.turnStartedAt && !game.winner
    ? game.turnStartedAt + TURN_TIMEOUT_MS
    : null;

  return {
    myPlayerId: playerId,
    myPlayerIndex: myIdx as 0 | 1,
    myPlayerName: me.playerName,
    myHeroClass: me.heroClass,
    myHealth: me.health,
    myMaxHealth: me.maxHealth,
    myArmor: me.armor,
    myMana: me.mana,
    myMaxMana: me.maxMana,
    myHand,
    myBoard: me.board,
    myWeapon: me.weapon,
    myHeroPowerUsed: me.heroPowerUsed,
    myFatigueDamage: me.fatigueDamage,
    myGraveyardCount: me.graveyard.length,
    opponent,
    deckCount: game.decks[myIdx].length,
    opponentDeckCount: game.decks[oppIdx].length,
    currentPlayerIndex: game.currentPlayerIndex,
    turnNumber: game.turnNumber,
    phase: game.phase,
    mulliganConfirmed: game.mulliganConfirmed,
    winner: game.winner,
    winReason: game.winReason,
    lastAction: game.lastAction,
    log: game.log,
    pendingInteraction: game.pendingInteraction ?? null,
    turnDeadline,
    playerStats: game.playerStats,
  };
}
