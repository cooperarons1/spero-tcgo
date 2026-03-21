import type { GameState, CardStats, PlayerZone, TurnPhase } from '../shared/types.js';
import { createTwoDecks, resetInstanceCounter } from './deck.js';
import { resetStackCounter } from './actions.js';
import { addLog, emptyStats } from './log.js';
import { processSideplayTriggers, getSideplayExtraBuilds } from './abilities.js';

export const TURN_TIMEOUT_MS = 60_000;

export function trackCardPlayed(game: GameState, cardCode: string): void {
  if (!game.cardStats[cardCode]) {
    game.cardStats[cardCode] = { timesPlayed: 0, combatWins: 0, combatLosses: 0, trickUses: 0 };
  }
  game.cardStats[cardCode].timesPlayed++;
}

/** Create a new game for two players */
export function createGame(
  playerEntries: { id: string; name: string }[]
): GameState {
  if (playerEntries.length !== 2) throw new Error('Exactly 2 players required');

  resetInstanceCounter();
  resetStackCounter();

  const decks = createTwoDecks();

  const players: [PlayerZone, PlayerZone] = [
    {
      playerId: playerEntries[0].id,
      playerName: playerEntries[0].name,
      hand: [],
      stacks: [],
      sideplay: [],
      discardPile: [],
    },
    {
      playerId: playerEntries[1].id,
      playerName: playerEntries[1].name,
      hand: [],
      stacks: [],
      sideplay: [],
      discardPile: [],
    },
  ];

  // Deal 7 cards each from their own deck
  for (let i = 0; i < 7; i++) {
    for (let p = 0; p < 2; p++) {
      players[p].hand.push(decks[p].pop()!);
    }
  }

  const firstPlayer = Math.random() < 0.5 ? 0 : 1;

  const game: GameState = {
    players,
    decks,
    currentPlayerIndex: firstPlayer,
    turnPhase: 'BUILD', // First player skips UNTAP and DRAW, goes straight to BUILD
    buildsRemaining: 2,
    actedStacks: new Set(),
    apScores: [0, 0],
    winner: null,
    winReason: null,
    turnNumber: 1,
    isFirstTurn: true, // First player's first turn: no draw, no actions
    combatState: null,
    pendingInteraction: null,
    lastAction: `Game started! ${players[firstPlayer].playerName} goes first.`,
    log: [],
    playerStats: [emptyStats(), emptyStats()],
    combatResult: null,
    turnDurations: [],
    apTimeline: [],
    cardStats: {},
    turnStartedAt: Date.now(),
  };

  addLog(game, null, `Game started! ${players[0].playerName} goes first.`, 'GAME');

  return game;
}

/** Advance to the next phase */
export function advancePhase(game: GameState): void {
  const phases: TurnPhase[] = ['UNTAP', 'DRAW', 'BUILD', 'ACTION', 'END'];
  const currentIdx = phases.indexOf(game.turnPhase);

  if (currentIdx === -1) return;

  // Move to next phase, executing automatic phases
  let nextIdx = currentIdx + 1;
  if (nextIdx >= phases.length) {
    nextIdx = 0; // wrap to UNTAP
  }

  game.turnPhase = phases[nextIdx];
  executePhase(game);
}

/** Execute automatic actions for current phase */
function executePhase(game: GameState): void {
  switch (game.turnPhase) {
    case 'UNTAP':
      doUntap(game);
      // Auto-advance
      advancePhase(game);
      break;

    case 'DRAW':
      doDraw(game);
      // Auto-advance
      advancePhase(game);
      break;

    case 'BUILD': {
      game.buildsRemaining = 2;
      // Add sideplay extra builds
      const extraBuilds = getSideplayExtraBuilds(game, game.currentPlayerIndex);
      game.buildsRemaining += extraBuilds.extra;
      game.turnStartedAt = Date.now();
      // Wait for player input
      break;
    }

    case 'ACTION':
      game.turnStartedAt = Date.now();
      if (game.isFirstTurn) {
        // First player's first turn: skip actions
        game.lastAction = `${currentPlayerName(game)}'s first turn — no actions allowed.`;
        addLog(game, game.currentPlayerIndex, 'First turn — no actions', 'PHASE');
        advancePhase(game);
      }
      // Otherwise wait for player input
      break;

    case 'END':
      doEnd(game);
      break;
  }
}

function currentPlayerName(game: GameState): string {
  return game.players[game.currentPlayerIndex].playerName;
}

/** UNTAP: untap all current player's stacks */
function doUntap(game: GameState): void {
  const player = game.players[game.currentPlayerIndex];
  for (const stack of player.stacks) {
    if (stack.skipNextUntap) {
      stack.skipNextUntap = false;
      // Don't untap this stack
    } else {
      stack.tapped = false;
    }
  }
  game.actedStacks = new Set();

  // Process sideplay turn-start triggers
  processSideplayTriggers(game, game.currentPlayerIndex);
}

/** DRAW: draw 1 card */
function doDraw(game: GameState): void {
  if (game.isFirstTurn) {
    // First player's first turn: skip draw
    game.lastAction = `${currentPlayerName(game)} skips draw on first turn.`;
    return;
  }

  const player = game.players[game.currentPlayerIndex];
  const playerDeck = game.decks[game.currentPlayerIndex];

  if (playerDeck.length === 0) {
    // Deck-out = lose
    const winnerId = game.currentPlayerIndex === 0 ? 1 : 0;
    game.winner = game.players[winnerId].playerId;
    game.winReason = 'deckout';
    game.lastAction = `${player.playerName} cannot draw — deck out! ${game.players[winnerId].playerName} wins!`;
    addLog(game, game.currentPlayerIndex, `${player.playerName} decked out!`, 'GAME');
    return;
  }

  player.hand.push(playerDeck.pop()!);
  game.lastAction = `${player.playerName} draws a card.`;
  addLog(game, game.currentPlayerIndex, `${player.playerName} draws a card`, 'PHASE');
}

/** END: check win, switch to next player */
function doEnd(game: GameState): void {
  // Record turn duration
  if (game.turnStartedAt) {
    game.turnDurations.push(Date.now() - game.turnStartedAt);
  }
  game.turnStartedAt = null;

  // Snapshot AP
  game.apTimeline.push([game.apScores[0], game.apScores[1]]);

  // Increment turnsPlayed for current player
  game.playerStats[game.currentPlayerIndex].turnsPlayed++;

  // Check 15 AP win
  for (let i = 0; i < 2; i++) {
    if (game.apScores[i as 0 | 1] >= 15) {
      game.winner = game.players[i].playerId;
      game.winReason = 'ap';
      game.lastAction = `${game.players[i].playerName} wins with ${game.apScores[i as 0 | 1]} AP!`;
      addLog(game, i as 0 | 1, `${game.players[i].playerName} wins with ${game.apScores[i as 0 | 1]} AP!`, 'GAME');
      return;
    }
  }

  // Switch player
  game.currentPlayerIndex = game.currentPlayerIndex === 0 ? 1 : 0;
  game.turnNumber++;

  if (game.isFirstTurn) {
    game.isFirstTurn = false;
  }

  game.lastAction = `${currentPlayerName(game)}'s turn begins.`;
  addLog(game, game.currentPlayerIndex, `${currentPlayerName(game)}'s turn begins`, 'PHASE');

  // Start next turn from UNTAP
  game.turnPhase = 'UNTAP';
  executePhase(game);
}

/** End the build phase early (player chooses to stop building) */
export function endBuildPhase(game: GameState, playerId: string): { success: boolean; error?: string } {
  if (game.turnPhase !== 'BUILD') return { success: false, error: 'Not in build phase' };
  if (game.players[game.currentPlayerIndex].playerId !== playerId) {
    return { success: false, error: 'Not your turn' };
  }
  advancePhase(game);
  return { success: true };
}

/** End the action phase early */
export function endActionPhase(game: GameState, playerId: string): { success: boolean; error?: string } {
  if (game.turnPhase !== 'ACTION') return { success: false, error: 'Not in action phase' };
  if (game.players[game.currentPlayerIndex].playerId !== playerId) {
    return { success: false, error: 'Not your turn' };
  }
  if (game.combatState) return { success: false, error: 'Combat in progress' };
  advancePhase(game);
  return { success: true };
}
