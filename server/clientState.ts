import type {
  GameState,
  ClientGameState,
  ClientCardInstance,
  ClientPlayerInfo,
  PendingInteraction,
  HeroClass,
  PlayerStats,
  PlayerState,
} from '../shared/types.js';
import { TURN_TIMEOUT_MS } from '../shared/types.js';

/**
 * Compute effective upgrade progress from playerStats + upgradeProgress.
 * Heroes that track via playerStats need their stat mapped here so the client
 * can display accurate progress bars.
 */
function getEffectiveUpgradeProgress(player: PlayerState, stats: PlayerStats): number {
  switch (player.heroClass) {
    case 'JIMMY': return stats.minionsKilled;
    case 'DES': return stats.minionsKilled;
    case 'TALA': return stats.healingDone;
    case 'DEREK': return stats.cardsDrawnFromEffects;
    case 'AVA': return stats.minionsPlayed + stats.heroPowerUses;
    case 'ASTRID': return player.board.filter(m => m.hasDivineShield).length;
    // Anders, Lucas, Izzy use upgradeProgress directly
    default: return player.upgradeProgress;
  }
}

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
    locations: opp.locations,
    weapon: opp.weapon,
    heroPowerUsed: opp.heroPowerUsed,
    heroAttackThisTurn: opp.heroAttackThisTurn,
    fatigueDamage: opp.fatigueDamage,
    graveyardCount: opp.graveyard.length,
    secretCount: opp.secrets.length,
    heroPowerUpgraded: opp.heroPowerUpgraded,
    upgradeProgress: getEffectiveUpgradeProgress(opp, game.playerStats[oppIdx]),
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
    myLocations: me.locations,
    myWeapon: me.weapon,
    myHeroPowerUsed: me.heroPowerUsed,
    myHeroAttackThisTurn: me.heroAttackThisTurn,
    myHeroAttacksRemaining: me.heroAttacksRemaining ?? 1,
    myFatigueDamage: me.fatigueDamage,
    myGraveyardCount: me.graveyard.length,
    mySecrets: me.secrets,
    myHeroPowerUpgraded: me.heroPowerUpgraded,
    myUpgradeProgress: getEffectiveUpgradeProgress(me, game.playerStats[myIdx]),
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
    spectatorCount: game.spectators?.length ?? 0,
  };
}

/** Sanitize game state for a spectator (sees player 0 perspective, no hand info) */
export function getSpectatorState(game: GameState): ClientGameState {
  const p0 = game.players[0];
  const p1 = game.players[1];

  const opponent: ClientPlayerInfo = {
    playerId: p1.playerId,
    playerName: p1.playerName,
    heroClass: p1.heroClass,
    health: p1.health,
    maxHealth: p1.maxHealth,
    armor: p1.armor,
    mana: p1.mana,
    maxMana: p1.maxMana,
    handCount: p1.hand.length,
    board: p1.board,
    locations: p1.locations,
    weapon: p1.weapon,
    heroPowerUsed: p1.heroPowerUsed,
    heroAttackThisTurn: p1.heroAttackThisTurn,
    fatigueDamage: p1.fatigueDamage,
    graveyardCount: p1.graveyard.length,
    secretCount: p1.secrets.length,
    heroPowerUpgraded: p1.heroPowerUpgraded,
    upgradeProgress: getEffectiveUpgradeProgress(p1, game.playerStats[1]),
  };

  const turnDeadline = game.turnStartedAt && !game.winner
    ? game.turnStartedAt + TURN_TIMEOUT_MS
    : null;

  return {
    myPlayerId: '__spectator__',
    myPlayerIndex: 0,
    myPlayerName: p0.playerName,
    myHeroClass: p0.heroClass,
    myHealth: p0.health,
    myMaxHealth: p0.maxHealth,
    myArmor: p0.armor,
    myMana: p0.mana,
    myMaxMana: p0.maxMana,
    myHand: p0.hand.map(c => ({ instanceId: c.instanceId, cardCode: null })), // hide hand from spectators
    myBoard: p0.board,
    myLocations: p0.locations,
    myWeapon: p0.weapon,
    myHeroPowerUsed: p0.heroPowerUsed,
    myHeroAttackThisTurn: p0.heroAttackThisTurn,
    myFatigueDamage: p0.fatigueDamage,
    myGraveyardCount: p0.graveyard.length,
    mySecrets: [],
    myHeroPowerUpgraded: p0.heroPowerUpgraded,
    myUpgradeProgress: getEffectiveUpgradeProgress(p0, game.playerStats[0]),
    opponent,
    deckCount: game.decks[0].length,
    opponentDeckCount: game.decks[1].length,
    currentPlayerIndex: game.currentPlayerIndex,
    turnNumber: game.turnNumber,
    phase: game.phase,
    mulliganConfirmed: game.mulliganConfirmed,
    winner: game.winner,
    winReason: game.winReason,
    lastAction: game.lastAction,
    log: game.log,
    pendingInteraction: null,
    turnDeadline,
    playerStats: game.playerStats,
    spectatorCount: game.spectators?.length ?? 0,
    isSpectator: true,
  };
}
