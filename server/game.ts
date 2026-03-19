import type { GameState, PlayerZone, TurnPhase } from '../shared/types.js';
import { createDeck, shuffle, resetInstanceCounter } from './deck.js';
import { resetStackCounter } from './actions.js';

/** Create a new game for two players */
export function createGame(
  playerEntries: { id: string; name: string }[]
): GameState {
  if (playerEntries.length !== 2) throw new Error('Exactly 2 players required');

  resetInstanceCounter();
  resetStackCounter();

  const deck = shuffle(createDeck());

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

  // Deal 7 cards each
  for (let i = 0; i < 7; i++) {
    for (const p of players) {
      p.hand.push(deck.pop()!);
    }
  }

  const game: GameState = {
    players,
    deck,
    currentPlayerIndex: 0,
    turnPhase: 'BUILD', // First player skips UNTAP and DRAW, goes straight to BUILD
    buildsRemaining: 2,
    actedStacks: new Set(),
    apScores: [0, 0],
    winner: null,
    turnNumber: 1,
    isFirstTurn: true, // First player's first turn: no draw, no actions
    combatState: null,
    pendingInteraction: null,
    lastAction: `Game started! ${players[0].playerName} goes first.`,
  };

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

    case 'BUILD':
      game.buildsRemaining = 2;
      // Wait for player input
      break;

    case 'ACTION':
      if (game.isFirstTurn) {
        // First player's first turn: skip actions
        game.lastAction = `${currentPlayerName(game)}'s first turn — no actions allowed.`;
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
    stack.tapped = false;
  }
  game.actedStacks = new Set();
}

/** DRAW: draw 1 card */
function doDraw(game: GameState): void {
  if (game.isFirstTurn) {
    // First player's first turn: skip draw
    game.lastAction = `${currentPlayerName(game)} skips draw on first turn.`;
    return;
  }

  const player = game.players[game.currentPlayerIndex];

  if (game.deck.length === 0) {
    // Deck-out = lose
    game.winner = game.players[game.currentPlayerIndex === 0 ? 1 : 0].playerId;
    game.lastAction = `${player.playerName} cannot draw — deck out! ${game.players[game.currentPlayerIndex === 0 ? 1 : 0].playerName} wins!`;
    return;
  }

  player.hand.push(game.deck.pop()!);
  game.lastAction = `${player.playerName} draws a card.`;
}

/** END: check win, switch to next player */
function doEnd(game: GameState): void {
  // Check 15 AP win
  for (let i = 0; i < 2; i++) {
    if (game.apScores[i as 0 | 1] >= 15) {
      game.winner = game.players[i].playerId;
      game.lastAction = `${game.players[i].playerName} wins with ${game.apScores[i as 0 | 1]} AP!`;
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
