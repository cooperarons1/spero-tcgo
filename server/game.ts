import type { GameState, PlayerState, HeroClass, CardInstance } from '../shared/types.js';
import { STARTING_HEALTH, MAX_MANA, TURN_TIMEOUT_MS } from '../shared/types.js';
import { createDeckFromList, createTwoDecks, resetInstanceCounter, resetTransientCounters, makeInstance, shuffle } from './deck.js';
import { addLog, emptyStats } from './log.js';
import { drawCard, checkHeroDeath, executeEffect, applyDamageToHero } from './effects.js';
import { minionHasKeyword } from './keywords.js';
import { getCardDef } from './cards.js';
import { checkDeaths } from './combat.js';

export { TURN_TIMEOUT_MS };

function makePlayerState(id: string, name: string, heroClass: HeroClass): PlayerState {
  // All heroes start with 0 armor. An earlier tuning gave DEREK 10
  // starting armor to close an aggro gap in 80k-game sims; it moved the
  // needle +3pp but played poorly at human pace (effectively 40hp
  // before the opponent even had a turn). Reverted — DEREK keeps armor
  // gain through Tinker hero power and DRK cards instead.
  const startingArmor = 0;
  return {
    playerId: id,
    playerName: name,
    heroClass,
    health: STARTING_HEALTH,
    maxHealth: STARTING_HEALTH,
    armor: startingArmor,
    mana: 0,
    maxMana: 0,
    hand: [],
    board: [],
    weapon: null,
    locations: [],
    heroPowerUsed: false,
    heroAttackThisTurn: 0,
    heroAttacksRemaining: 1,
    fatigueDamage: 0,
    graveyard: [],
    secrets: [],
    heroPowerUpgraded: false,
    upgradeProgress: 0,
    spellDiscount: 0,
  };
}

/** Create a new game for two players */
export function createGame(
  playerEntries: { id: string; name: string; heroClass: HeroClass }[],
  options?: {
    deckLists?: [string[] | null, string[] | null];
    firstPlayerIndex?: 0 | 1;
  }
): GameState {
  if (playerEntries.length !== 2) throw new Error('Exactly 2 players required');

  resetInstanceCounter();
  resetTransientCounters();

  let decks: [CardInstance[], CardInstance[]];
  if (options?.deckLists?.[0] && options?.deckLists?.[1]) {
    decks = [createDeckFromList(options.deckLists[0]), createDeckFromList(options.deckLists[1])];
  } else {
    decks = createTwoDecks();
  }

  const players: [PlayerState, PlayerState] = [
    makePlayerState(playerEntries[0].id, playerEntries[0].name, playerEntries[0].heroClass),
    makePlayerState(playerEntries[1].id, playerEntries[1].name, playerEntries[1].heroClass),
  ];

  const firstPlayer = options?.firstPlayerIndex ?? (Math.random() < 0.5 ? 0 : 1);
  const secondPlayer = firstPlayer === 0 ? 1 : 0;

  // Deal starting hands: 3 cards for first player, 4 cards for second player
  for (let i = 0; i < 3; i++) {
    players[firstPlayer].hand.push(decks[firstPlayer].pop()!);
  }
  for (let i = 0; i < 4; i++) {
    players[secondPlayer].hand.push(decks[secondPlayer].pop()!);
  }

  // Coin is given to second player after mulligan (in startPlaying)

  const game: GameState = {
    players,
    decks,
    currentPlayerIndex: firstPlayer,
    turnNumber: 1,
    phase: 'MULLIGAN',
    mulliganChoices: [null, null],
    mulliganConfirmed: [false, false],
    winner: null,
    winReason: null,
    lastAction: `Mulligan phase — choose cards to replace.`,
    log: [],
    turnStartedAt: Date.now(),
    playerStats: [emptyStats(), emptyStats()],
    pendingInteraction: null,
    cardsPlayedThisTurn: 0,
  };

  addLog(game, null, `Game started! ${players[firstPlayer].playerName} goes first.`, 'GAME');
  addLog(game, null, `Mulligan phase — choose cards to replace.`, 'GAME');

  return game;
}

/** Handle a player's mulligan choice */
export function confirmMulligan(
  game: GameState,
  playerId: string,
  replacements: boolean[]
): { success: boolean; error?: string } {
  if (game.phase !== 'MULLIGAN') return { success: false, error: 'Not in mulligan phase' };

  const pIdx = game.players.findIndex(p => p.playerId === playerId);
  if (pIdx === -1) return { success: false, error: 'Player not in game' };
  if (game.mulliganConfirmed[pIdx as 0 | 1]) return { success: false, error: 'Already confirmed mulligan' };

  const player = game.players[pIdx];
  if (replacements.length !== player.hand.length) {
    return { success: false, error: `Expected ${player.hand.length} replacement flags` };
  }

  game.mulliganChoices[pIdx as 0 | 1] = replacements;
  game.mulliganConfirmed[pIdx as 0 | 1] = true;

  // Perform the replacement
  const deck = game.decks[pIdx as 0 | 1];
  const toReplace: number[] = [];

  for (let i = 0; i < replacements.length; i++) {
    if (replacements[i]) {
      toReplace.push(i);
    }
  }

  // Shuffle replaced cards back into deck, then draw new ones
  const replaced: CardInstance[] = [];
  for (const idx of toReplace) {
    replaced.push(player.hand[idx]);
  }

  // Draw new cards first
  const newCards: CardInstance[] = [];
  for (let i = 0; i < toReplace.length; i++) {
    if (deck.length > 0) {
      newCards.push(deck.pop()!);
    }
  }

  // Replace the cards in hand
  let newIdx = 0;
  for (const idx of toReplace) {
    if (newIdx < newCards.length) {
      player.hand[idx] = newCards[newIdx++];
    }
  }

  // Shuffle replaced cards back into deck
  for (const card of replaced) {
    deck.push(card);
  }
  // Re-shuffle the deck
  const shuffled = shuffle(deck);
  deck.length = 0;
  deck.push(...shuffled);

  const replacedCount = toReplace.length;
  addLog(game, pIdx as 0 | 1, `${player.playerName} replaces ${replacedCount} card${replacedCount !== 1 ? 's' : ''}`, 'GAME');

  // Check if both confirmed
  if (game.mulliganConfirmed[0] && game.mulliganConfirmed[1]) {
    startPlaying(game);
  }

  return { success: true };
}

/** Transition from MULLIGAN to PLAYING and start the first turn */
function startPlaying(game: GameState): void {
  game.phase = 'PLAYING';

  // Give The Coin to the second player (the one who doesn't go first)
  const secondIdx = (game.currentPlayerIndex === 0 ? 1 : 0) as 0 | 1;
  game.players[secondIdx].hand.push(makeInstance('COIN'));

  addLog(game, null, `Mulligan complete! Game begins.`, 'GAME');
  startTurn(game);
}

/** Start a new turn for the current player */
export function startTurn(game: GameState): void {
  const pIdx = game.currentPlayerIndex;
  const player = game.players[pIdx];

  // Increment maxMana (cap at 10)
  if (player.maxMana < MAX_MANA) {
    player.maxMana++;
  }
  // Refill mana
  player.mana = player.maxMana;

  // Draw 1 card (fatigue if empty)
  drawCard(game, pIdx);

  // Reset hero power
  player.heroPowerUsed = false;

  // Reset temporary hero attack (guard against skipped endTurn cleanup)
  player.heroAttackThisTurn = 0;

  // Reset hero attacks remaining (1 per turn)
  player.heroAttacksRemaining = 1;

  // Reset locations: decrement cooldown, allow activation
  for (const loc of player.locations) {
    loc.activatedThisTurn = false;
    if (loc.cooldownRemaining > 0) loc.cooldownRemaining--;
  }

  // Orra Charge: increment charge on all minions with the keyword
  for (const minion of [...player.board]) {
    if (game.winner) break;
    if (minion.isSilenced) continue;
    const mDef = getCardDef(minion.cardCode);
    if (mDef.keywords.includes('ORRA_CHARGE') && mDef.orraChargeMax && mDef.orraChargeEffect) {
      minion.currentOrraCharge = (minion.currentOrraCharge ?? 0) + 1;
      if (minion.currentOrraCharge >= mDef.orraChargeMax) {
        addLog(game, pIdx, `${mDef.name}'s Orra Charge fires!`, 'EFFECT');
        executeEffect(game, pIdx, mDef.orraChargeEffect);
        minion.currentOrraCharge = 0;
        checkDeaths(game);
        // C6: Orra Charge can damage either hero. checkDeaths only handles
        // minions; without checkHeroDeath the game can keep ticking with a
        // dead hero for one extra turn, mislabeling the active player on
        // any snapshots taken in that window.
        checkHeroDeath(game);
      }
    }
  }

  // Unfreeze minions that were frozen last turn, enable attacks.
  // Iterate a SNAPSHOT of player.board so side-effects from Orra Charge
  // earlier in startTurn don't skip minions. Gate sickness on summonedTurn
  // as the authoritative source — canAttack is refreshed each turn,
  // summonedTurn doesn't change after creation.
  const boardSnapshot = [...player.board];
  for (const minion of boardSnapshot) {
    // If the minion has been removed mid-loop, skip.
    if (!player.board.includes(minion)) continue;

    // Sick only if summoned (or transferred) on the CURRENT turn.
    const sickFromSummon = minion.summonedTurn !== undefined
      && minion.summonedTurn >= game.turnNumber
      && !(minion.transferredTurn !== undefined && minion.transferredTurn < game.turnNumber);

    if (minion.isFrozen) {
      minion.canAttack = false;
      minion.isFrozen = false; // thaw for next turn
    } else if (!sickFromSummon) {
      minion.canAttack = true;
    }
    // Reset attacks remaining
    minion.attacksRemaining = minionHasKeyword(minion, 'WINDFURY') ? 2 : 1;
  }

  game.turnStartedAt = Date.now();
  game.lastAction = `${player.playerName}'s turn (Turn ${game.turnNumber}).`;
  addLog(game, pIdx, `${player.playerName}'s turn begins (${player.maxMana} mana)`, 'TURN');
}

/** End the current turn */
export function endTurn(
  game: GameState,
  playerId: string
): { success: boolean; error?: string } {
  if (game.phase !== 'PLAYING') return { success: false, error: 'Game not in playing phase' };
  if (game.winner) return { success: false, error: 'Game is over' };

  const pIdx = game.players.findIndex(p => p.playerId === playerId);
  if (pIdx !== game.currentPlayerIndex) return { success: false, error: 'Not your turn' };

  const player = game.players[pIdx];
  game.playerStats[pIdx as 0 | 1].turnsPlayed++;

  // End-of-turn triggers for the current player's minions
  resolveEndOfTurnEffects(game, pIdx as 0 | 1);

  addLog(game, pIdx as 0 | 1, `${player.playerName} ends their turn`, 'TURN');

  // Clear temporary hero attack (Lucas Coyote's Veil)
  player.heroAttackThisTurn = 0;

  // Reset combo counter
  game.cardsPlayedThisTurn = 0;

  // Cancel any pending battlecry (shouldn't happen, but defensive)
  game.pendingBattlecry = null;

  // Switch to other player
  game.currentPlayerIndex = game.currentPlayerIndex === 0 ? 1 : 0;
  game.turnNumber++;

  // Start the next turn
  startTurn(game);

  return { success: true };
}

/** Resolve end-of-turn effects for all minions owned by the given player */
function resolveEndOfTurnEffects(game: GameState, playerIndex: 0 | 1): void {
  if (game.winner) return;
  const player = game.players[playerIndex];
  const oppIdx = (playerIndex === 0 ? 1 : 0) as 0 | 1;

  // Collar: transfer collared minions to the collar owner at end of their owner's turn
  const collaredMinions = player.board.filter(m => m.isCollared && m.collarOwnerIndex !== undefined && m.collarOwnerIndex !== playerIndex);
  for (const minion of collaredMinions) {
    const newOwner = game.players[minion.collarOwnerIndex!];
    if (newOwner.board.length >= 7) continue; // board full, can't transfer
    const idx = player.board.indexOf(minion);
    if (idx < 0) continue;
    player.board.splice(idx, 1);
    minion.isCollared = false;
    minion.collarOwnerIndex = undefined;
    minion.canAttack = false; // summoning sickness on new side
    minion.transferredTurn = game.turnNumber;
    newOwner.board.push(minion);
    const mDef = getCardDef(minion.cardCode);
    addLog(game, minion.collarOwnerIndex ?? oppIdx, `${mDef.name} switches sides (Collar)!`, 'EFFECT');
  }

  for (const minion of [...player.board]) {
    if (game.winner) break;
    if (minion.isSilenced) continue;

    const def = getCardDef(minion.cardCode);
    if (!def.endOfTurnEffect) continue;

    const effect = def.endOfTurnEffect;
    addLog(game, playerIndex, `${def.name}'s end-of-turn effect triggers`, 'EFFECT');

    // Resolve targeting for end-of-turn effects
    if (effect.type === 'DEAL_DAMAGE' && effect.target === 'NONE') {
      // Deal damage to enemy hero (e.g. Shadow Leech)
      applyDamageToHero(game.players[oppIdx], effect.value ?? 0);
      game.playerStats[playerIndex].damageDealtToHeroes += effect.value ?? 0;
      addLog(game, playerIndex, `Deals ${effect.value} damage to ${game.players[oppIdx].playerName}`, 'EFFECT');
      checkHeroDeath(game);
    } else if (effect.type === 'RESTORE_HEALTH' && (effect.target === 'TARGET_HERO' || effect.target === 'SELF')) {
      // Heal own hero
      executeEffect(game, playerIndex, { ...effect, target: 'SELF' });
    } else {
      executeEffect(game, playerIndex, effect);
    }

    checkDeaths(game);
  }
}
