// Card-specific ability handlers — combat tricks, sideplay passives, on-play triggers, action effects

import type { GameState, CombatTrickEffect, CardDef, Stack, PlayerZone, TargetOption } from '../shared/types.js';
import { AP_TO_WIN } from '../shared/types.js';
import { getCardDef, getAllCardDefs } from './cards.js';
import { defOf } from './rules.js';
import { addLog } from './log.js';
import { requestTargetChoice } from './targeting.js';

const AI_PLAYER_ID_PREFIX = 'ai-bot-';
function isAI(playerId: string): boolean {
  return playerId.startsWith(AI_PLAYER_ID_PREFIX);
}

// ─── Helpers ───

function findPlayer(game: GameState, playerId: string): PlayerZone {
  return game.players.find((z) => z.playerId === playerId)!;
}

function opponentOf(game: GameState, playerId: string): PlayerZone {
  return game.players.find((z) => z.playerId !== playerId)!;
}

function playerIndex(game: GameState, playerId: string): 0 | 1 {
  return game.players.findIndex((z) => z.playerId === playerId) as 0 | 1;
}

function drawCards(game: GameState, playerId: string, count: number): void {
  const player = findPlayer(game, playerId);
  const pIdx = playerIndex(game, playerId);
  const deck = game.decks[pIdx];
  for (let i = 0; i < count && deck.length > 0; i++) {
    player.hand.push(deck.pop()!);
  }
}

function discardRandomCards(game: GameState, playerId: string, count: number): void {
  const player = findPlayer(game, playerId);
  for (let i = 0; i < count && player.hand.length > 0; i++) {
    const idx = Math.floor(Math.random() * player.hand.length);
    const card = player.hand.splice(idx, 1)[0];
    player.discardPile.push(card);
  }
}

/** Check if a stack contains a card with a specific typeB */
function stackHasTypeB(stack: Stack, typeB: string): boolean {
  for (const c of stack.cards) {
    if (!c.faceUp) continue;
    const def = defOf(c);
    if (def.typeB === typeB) return true;
  }
  return false;
}

/** Check if a stack contains a Wild Animal or Alpha Wild Animal */
function stackHasWildAnimal(stack: Stack): boolean {
  for (const c of stack.cards) {
    if (!c.faceUp) continue;
    const def = defOf(c);
    if (def.typeB === 'WILD ANIMAL' || def.typeB === 'ALPHA WILD ANIMAL') return true;
  }
  return false;
}

/** Check if a stack contains any Animal (Animal Companion, Wild Animal, or Alpha Wild Animal) */
function stackHasAnimal(stack: Stack): boolean {
  for (const c of stack.cards) {
    if (!c.faceUp) continue;
    const def = defOf(c);
    if (def.typeB === 'ANIMAL COMPANION' || def.typeB === 'WILD ANIMAL' || def.typeB === 'ALPHA WILD ANIMAL') return true;
  }
  return false;
}

/** Check if a stack has an Animal Companion */
function stackHasAnimalCompanion(stack: Stack): boolean {
  for (const c of stack.cards) {
    if (!c.faceUp) continue;
    const def = defOf(c);
    if (def.typeB === 'ANIMAL COMPANION') return true;
  }
  return false;
}

/** Count stunned (face-down) cards in a stack */
function countStunnedCards(stack: Stack): number {
  return stack.cards.filter((c) => !c.faceUp).length;
}

/** Check if a stack has equipment */
function stackHasEquipment(stack: Stack): boolean {
  for (const c of stack.cards) {
    if (!c.faceUp) continue;
    const def = defOf(c);
    if (def.typeA === 'EQUIPMENT') return true;
  }
  return false;
}

// ─── Combat Trick Effect Lookup Table ───

const combatTrickEffects = new Map<string, CombatTrickEffect>();

// Black tricks
combatTrickEffects.set('Deal 1 Damage to opposing Stack.', {
  damageToOpposingStack: 1,
});
combatTrickEffects.set('Stun any card with "Smarts Strategy." Draw a card.', {
  stunSmartsStrategyCard: true,
  drawCards: 1,
});
combatTrickEffects.set('After Combat, if this Stack took no damage during Combat, draw 2 cards.', {
  drawCardsIfNoDamageTaken: 2,
});
combatTrickEffects.set('Deal 2 Damage to opposing Stack.', {
  damageToOpposingStack: 2,
});

// Blue tricks
combatTrickEffects.set('No Damage is dealt during this Combat. Draw a card.', {
  noDamageThisCombat: true,
  drawCards: 1,
});
combatTrickEffects.set('Reduce the Power of a Character to zero until end of Combat.', {
  reduceOpposingCharacterPower: true,
});
combatTrickEffects.set('Opposing Stack does not Untap at the beginning of the next turn.', {
  opposingNoUntap: true,
});
combatTrickEffects.set('This Stack takes no Damage this Combat. Draw a card.', {
  thisStackNoDamage: true,
  drawCards: 1,
});

// Green tricks
combatTrickEffects.set('Restore a card in this Stack.', {
  restoreCardInThisStack: true,
});
combatTrickEffects.set('Restore a card in any Stack.', {
  restoreCardInAnyStack: true,
});
combatTrickEffects.set('Stun any card with "Vicious." Draw a card.', {
  stunViciousCard: true,
  drawCards: 1,
});
combatTrickEffects.set('For each Stunned card in this Stack, this Stack gets +1 Smarts and +1 Power until end of Combat.', {
  perStunnedCard: { power: 1, smarts: 1 },
});
combatTrickEffects.set('Deal 1 Damage to this Stack. This Stack gets "Smarts Strategy: +1" until end of Combat.', {
  damageToThisStack: 1,
  smartsStrategyBonus: 1,
});

// Colorless tricks
combatTrickEffects.set('If this Stack has a Wild Animal in it, this Stack gets "Vicious: +1" until end of Combat.', {
  conditionalWildAnimal: { viciousBonus: 1 },
});
combatTrickEffects.set('This Stack gets +1 Smarts and +1 Power until end of Combat.', {
  statBonus: { power: 1, smarts: 1 },
});
combatTrickEffects.set('If this Stack has a Wild Animal in it, this Stack gets "Vicious: +2" until end of Combat. Draw a card.', {
  conditionalWildAnimal: { viciousBonus: 2, drawCards: 1 },
  drawCards: 1,
});

// Red tricks
combatTrickEffects.set('Destroy an Equipment in opposing Stack. Draw a card.', {
  destroyEquipmentInOpposingStack: true,
  drawCards: 1,
});
combatTrickEffects.set('This Stack gets +4 Power until end of Combat. Draw a card.', {
  statBonus: { power: 4, smarts: 0 },
  drawCards: 1,
});
combatTrickEffects.set('This Stack gets +2 Power until end of Combat. Opponent cannot play any more Combat Tricks this Combat.', {
  statBonus: { power: 2, smarts: 0 },
  blockOpponentTricks: true,
});
combatTrickEffects.set('For each card in this Stack, this Stack gets +1 Power until end of Combat.', {
  perCardInStack: { power: 1, smarts: 0 },
});
combatTrickEffects.set('Put a Combat Trick that costs 2 or less from your discard pile into your hand. You may play an additional Combat Trick this Combat.', {
  recycleTrickFromDiscard: true,
});
combatTrickEffects.set('This Stack gets "Power Strategy: +1" until end of Combat.', {
  powerStrategyBonus: 1,
});

// Yellow tricks
combatTrickEffects.set('Switch which stat is being used for this Combat.', {
  switchStat: true,
});
combatTrickEffects.set('Stun a card in opposing Stack.', {
  stunCardInOpposingStack: true,
});
combatTrickEffects.set('Stun any card with "Power Strategy." Draw a card.', {
  stunPowerStrategyCard: true,
  drawCards: 1,
});
combatTrickEffects.set('Stun a card in opposing Stack. Draw a card.', {
  stunCardInOpposingStack: true,
  drawCards: 1,
});

/** Look up combat trick effect from rulesText */
export function parseCombatTrickEffect(rulesText: string): CombatTrickEffect | null {
  return combatTrickEffects.get(rulesText) ?? null;
}

// ─── Combat Trick Execution ───

/** Apply immediate combat trick effects (stuns, restores, etc.) at play time */
export function applyImmediateTrickEffects(
  game: GameState,
  effect: CombatTrickEffect,
  playerId: string,
  myStack: Stack,
  opposingStack: Stack | null
): void {
  const pIdx = playerIndex(game, playerId);

  // Stun a card in opposing stack
  if (effect.stunCardInOpposingStack && opposingStack) {
    for (let i = opposingStack.cards.length - 1; i >= 0; i--) {
      if (opposingStack.cards[i].faceUp) {
        opposingStack.cards[i].faceUp = false;
        addLog(game, pIdx, `Combat trick stuns a card in opposing stack`, 'COMBAT');
        break;
      }
    }
  }

  // Stun card with Vicious keyword
  if (effect.stunViciousCard && opposingStack) {
    for (let i = opposingStack.cards.length - 1; i >= 0; i--) {
      const c = opposingStack.cards[i];
      if (c.faceUp) {
        const def = defOf(c);
        if (/Vicious/i.test(def.rulesText)) {
          c.faceUp = false;
          addLog(game, pIdx, `Combat trick stuns ${def.name} (Vicious)`, 'COMBAT');
          break;
        }
      }
    }
  }

  // Stun card with Smarts Strategy keyword
  if (effect.stunSmartsStrategyCard && opposingStack) {
    for (let i = opposingStack.cards.length - 1; i >= 0; i--) {
      const c = opposingStack.cards[i];
      if (c.faceUp) {
        const def = defOf(c);
        if (/Smarts Strategy/i.test(def.rulesText)) {
          c.faceUp = false;
          addLog(game, pIdx, `Combat trick stuns ${def.name} (Smarts Strategy)`, 'COMBAT');
          break;
        }
      }
    }
  }

  // Stun card with Power Strategy keyword
  if (effect.stunPowerStrategyCard && opposingStack) {
    for (let i = opposingStack.cards.length - 1; i >= 0; i--) {
      const c = opposingStack.cards[i];
      if (c.faceUp) {
        const def = defOf(c);
        if (/Power Strategy/i.test(def.rulesText)) {
          c.faceUp = false;
          addLog(game, pIdx, `Combat trick stuns ${def.name} (Power Strategy)`, 'COMBAT');
          break;
        }
      }
    }
  }

  // Restore a card in this stack
  if (effect.restoreCardInThisStack) {
    for (const c of myStack.cards) {
      if (!c.faceUp) {
        c.faceUp = true;
        const cDef = defOf(c);
        addLog(game, pIdx, `Combat trick restores ${cDef.name} in this stack`, 'COMBAT');
        // Re-trigger on-play effect
        if (cDef.rulesText) {
          handleOnPlay(game, playerId, cDef, myStack.stackId);
        }
        break;
      }
    }
  }

  // Restore a card in any stack (pick own first stunned card)
  if (effect.restoreCardInAnyStack) {
    const player = findPlayer(game, playerId);
    let restored = false;
    for (const s of player.stacks) {
      for (const c of s.cards) {
        if (!c.faceUp) {
          c.faceUp = true;
          const cDef = defOf(c);
          addLog(game, pIdx, `Combat trick restores ${cDef.name}`, 'COMBAT');
          // Re-trigger on-play effect
          if (cDef.rulesText) {
            handleOnPlay(game, playerId, cDef, s.stackId);
          }
          restored = true;
          break;
        }
      }
      if (restored) break;
    }
  }

  // Destroy equipment in opposing stack
  if (effect.destroyEquipmentInOpposingStack && opposingStack) {
    const opponent = opponentOf(game, playerId);
    for (let i = opposingStack.cards.length - 1; i >= 0; i--) {
      const c = opposingStack.cards[i];
      if (c.faceUp) {
        const def = defOf(c);
        if (def.typeA === 'EQUIPMENT') {
          opposingStack.cards.splice(i, 1);
          opponent.discardPile.push(c);
          addLog(game, pIdx, `Combat trick destroys ${def.name}`, 'COMBAT');
          break;
        }
      }
    }
  }

  // Recycle trick from discard
  if (effect.recycleTrickFromDiscard) {
    const player = findPlayer(game, playerId);
    for (let i = player.discardPile.length - 1; i >= 0; i--) {
      const c = player.discardPile[i];
      const def = getCardDef(c.cardCode);
      if (def.typeA === 'COMBAT TRICK' && def.cost <= 2) {
        player.discardPile.splice(i, 1);
        player.hand.push(c);
        addLog(game, pIdx, `Combat trick recycles ${def.name} from discard`, 'COMBAT');
        break;
      }
    }
  }

  // Self-damage
  if (effect.damageToThisStack && effect.damageToThisStack > 0) {
    const player = findPlayer(game, playerId);
    applyDamageToStack(myStack, player, effect.damageToThisStack);
    addLog(game, pIdx, `Combat trick deals ${effect.damageToThisStack} damage to own stack`, 'COMBAT');
  }
}

/** Calculate stat bonus from a trick effect for combat resolution */
export function calculateTrickStatBonus(
  effect: CombatTrickEffect,
  missionType: 'POWER' | 'SMARTS',
  myStack: Stack
): number {
  let bonus = 0;

  // Direct stat bonus
  if (effect.statBonus) {
    bonus += missionType === 'POWER' ? effect.statBonus.power : effect.statBonus.smarts;
  }

  // Per card in stack
  if (effect.perCardInStack) {
    const count = myStack.cards.length;
    bonus += count * (missionType === 'POWER' ? effect.perCardInStack.power : effect.perCardInStack.smarts);
  }

  // Per stunned card
  if (effect.perStunnedCard) {
    const stunned = countStunnedCards(myStack);
    bonus += stunned * (missionType === 'POWER' ? effect.perStunnedCard.power : effect.perStunnedCard.smarts);
  }

  // Conditional wild animal bonus (vicious doesn't add to stat, but the conditional may have stat bonuses)
  if (effect.conditionalWildAnimal && stackHasWildAnimal(myStack)) {
    const cond = effect.conditionalWildAnimal;
    if (cond.statBonus) {
      bonus += missionType === 'POWER' ? cond.statBonus.power : cond.statBonus.smarts;
    }
  }

  return bonus;
}

/** Calculate vicious bonus from a trick effect */
export function calculateTrickViciousBonus(effect: CombatTrickEffect, myStack: Stack): number {
  let bonus = 0;
  if (effect.viciousBonus) bonus += effect.viciousBonus;
  if (effect.conditionalWildAnimal && stackHasWildAnimal(myStack)) {
    const cond = effect.conditionalWildAnimal;
    if (cond.viciousBonus) bonus += cond.viciousBonus;
  }
  return bonus;
}

/** Apply post-combat trick effects (draw, damage, untap prevention) */
export function applyPostCombatTrickEffects(
  game: GameState,
  effect: CombatTrickEffect,
  playerId: string,
  myStack: Stack,
  opposingStack: Stack | null,
  myStackTookDamage: boolean
): void {
  const pIdx = playerIndex(game, playerId);

  // Draw cards
  if (effect.drawCards && effect.drawCards > 0) {
    // Don't double-draw for conditional wild animal - that draw is already in the base effect
    drawCards(game, playerId, effect.drawCards);
    addLog(game, pIdx, `Combat trick draws ${effect.drawCards} card(s)`, 'COMBAT');
  }

  // Conditional wild animal draw
  if (effect.conditionalWildAnimal?.drawCards && stackHasWildAnimal(myStack)) {
    // The draw for Rampage is already counted in the base effect.drawCards
    // Don't draw again here
  }

  // Draw cards if no damage taken
  if (effect.drawCardsIfNoDamageTaken && !myStackTookDamage) {
    drawCards(game, playerId, effect.drawCardsIfNoDamageTaken);
    addLog(game, pIdx, `Combat trick draws ${effect.drawCardsIfNoDamageTaken} cards (no damage taken)`, 'COMBAT');
  }

  // Damage to opposing stack
  if (effect.damageToOpposingStack && opposingStack) {
    const opponent = opponentOf(game, playerId);
    applyDamageToStack(opposingStack, opponent, effect.damageToOpposingStack);
    addLog(game, pIdx, `Combat trick deals ${effect.damageToOpposingStack} damage to opposing stack`, 'COMBAT');
  }

  // Opposing no untap
  if (effect.opposingNoUntap && opposingStack) {
    opposingStack.skipNextUntap = true;
    addLog(game, pIdx, `Opposing stack will not untap next turn`, 'COMBAT');
  }
}

/** Damage helper (same logic as combat.ts applyDamage). Respects turnFlags.noDamagePlayerIds. */
function applyDamageToStack(stack: Stack, player: PlayerZone, amount: number, game?: GameState): void {
  // If player has noDamage turnFlag, skip all damage
  if (game && game.turnFlags.noDamagePlayerIds.includes(player.playerId)) return;
  for (let i = 0; i < amount && stack.cards.length > 0; i++) {
    const faceDownIdx = stack.cards.findIndex((c) => !c.faceUp);
    if (faceDownIdx >= 0) {
      const removed = stack.cards.splice(faceDownIdx, 1)[0];
      player.discardPile.push(removed);
    } else {
      const topIdx = stack.cards.length - 1;
      if (topIdx >= 0) {
        stack.cards[topIdx].faceUp = false;
      }
    }
  }
}

// ─── Sideplay Passives (Phase 4) ───

/** Get sideplay stat bonuses for a specific stack */
export function getSideplayStatBonuses(
  game: GameState,
  stack: Stack,
  ownerId: string
): { power: number; smarts: number } {
  const player = findPlayer(game, ownerId);
  let power = 0;
  let smarts = 0;

  for (const sp of player.sideplay) {
    const def = getCardDef(sp.cardCode);
    const rt = def.rulesText;

    if (rt === 'SIDEPLAY: Your Stacks have +1 Power.') {
      power += 1;
    } else if (rt === 'SIDEPLAY: All your Stacks have +2 Smarts.') {
      smarts += 2;
    } else if (rt === 'SIDEPLAY: Your Animals have +1 Power.') {
      if (stackHasAnimal(stack)) power += 1;
    } else if (rt === 'SIDEPLAY: Your Animal Companions have +1 Smarts.') {
      if (stackHasAnimalCompanion(stack)) smarts += 1;
    }
  }

  return { power, smarts };
}

/** Get sideplay keyword bonuses for a stack */
export function getSideplayKeywordBonuses(
  game: GameState,
  ownerId: string
): { vicious: number; powerStrategy: number; smartsStrategy: number } {
  const player = findPlayer(game, ownerId);
  let vicious = 0;
  let powerStrategy = 0;
  let smartsStrategy = 0;

  for (const sp of player.sideplay) {
    const def = getCardDef(sp.cardCode);
    const rt = def.rulesText;

    if (rt === 'SIDEPLAY: All your Stacks have "Vicious: +1."') {
      vicious += 1;
    } else if (rt === 'SIDEPLAY: All your Stacks have "Power Strategy: +1."') {
      powerStrategy += 1;
    } else if (rt === 'SIDEPLAY: All your Stacks have "Smarts Strategy: +1."') {
      smartsStrategy += 1;
    }
  }

  return { vicious, powerStrategy, smartsStrategy };
}

// ─── Sideplay Turn-Start Triggers (Phase 4) ───

/** Process sideplay triggers at the beginning of a player's turn */
export function processSideplayTriggers(game: GameState, playerIdx: 0 | 1): void {
  const player = game.players[playerIdx];
  const opponentIdx = (playerIdx === 0 ? 1 : 0) as 0 | 1;
  const opponent = game.players[opponentIdx];

  for (const sp of player.sideplay) {
    const def = getCardDef(sp.cardCode);
    const rt = def.rulesText;

    // +1 AP at turn start
    if (rt === 'SIDEPLAY: At the beginning of your turn, get 1 Mission Point.') {
      game.apScores[playerIdx] += 1;
      game.playerStats[playerIdx].apEarned += 1;
      addLog(game, playerIdx, `${def.name} gives +1 Mission Point`, 'AP');
      if (game.apScores[playerIdx] >= AP_TO_WIN) {
        game.winner = player.playerId;
        game.winReason = 'ap';
      }
    }

    // Opponent -1 AP
    if (rt === 'SIDEPLAY: At the beginning of your turn, opponent loses 1 Mission Point.') {
      game.apScores[opponentIdx] = Math.max(0, game.apScores[opponentIdx] - 1);
      addLog(game, playerIdx, `${def.name} causes opponent to lose 1 Mission Point`, 'AP');
    }

    // Return Animal from discard
    if (rt === 'SIDEPLAY: At the beginning of your turn, put an Animal from your discard pile into your hand.') {
      for (let i = player.discardPile.length - 1; i >= 0; i--) {
        const c = player.discardPile[i];
        const cDef = getCardDef(c.cardCode);
        if (cDef.typeB === 'ANIMAL COMPANION' || cDef.typeB === 'WILD ANIMAL' || cDef.typeB === 'ALPHA WILD ANIMAL') {
          player.discardPile.splice(i, 1);
          player.hand.push(c);
          addLog(game, playerIdx, `${def.name} returns ${cDef.name} from discard`, 'BUILD');
          break;
        }
      }
    }

    // Search deck for combat trick
    if (rt === 'SIDEPLAY: At the beginning of your turn, you may search your deck for a Combat Trick and reveal it. Put it into your hand. Shuffle your deck.') {
      const deck = game.decks[playerIdx];
      for (let i = deck.length - 1; i >= 0; i--) {
        const cDef = getCardDef(deck[i].cardCode);
        if (cDef.typeA === 'COMBAT TRICK') {
          const card = deck.splice(i, 1)[0];
          player.hand.push(card);
          addLog(game, playerIdx, `${def.name} searches deck for ${cDef.name}`, 'BUILD');
          // Shuffle deck
          for (let j = deck.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [deck[j], deck[k]] = [deck[k], deck[j]];
          }
          break;
        }
      }
    }

    // Deal 2 damage to stack with equipment
    if (rt === 'SIDEPLAY: At the beginning of your turn, choose a Stack with an Equipment. Deal 2 Damage to that Stack.') {
      // Auto-target first opponent stack with equipment
      for (const s of opponent.stacks) {
        if (stackHasEquipment(s)) {
          applyDamageToStack(s, opponent, 2, game);
          addLog(game, playerIdx, `${def.name} deals 2 damage to opponent's stack with equipment`, 'COMBAT');
          break;
        }
      }
      // Clean up empty stacks
      opponent.stacks = opponent.stacks.filter((s) => s.cards.length > 0);
    }
  }
}

/** Check for extra build from sideplay (Cargo Ship) */
export function getSideplayExtraBuilds(game: GameState, playerIdx: 0 | 1): { extra: number; colorlessOnly: boolean } {
  const player = game.players[playerIdx];
  let extra = 0;
  let colorlessOnly = false;

  for (const sp of player.sideplay) {
    const def = getCardDef(sp.cardCode);
    if (def.rulesText === 'SIDEPLAY: You have an additional Build each turn that may only be used on a colorless card.') {
      extra += 1;
      colorlessOnly = true;
    }
  }

  return { extra, colorlessOnly };
}

// ─── On-Play Triggers (Phase 5) ───

/** Handle on-play triggers when a character/equipment is built face-up */
export function handleOnPlay(
  game: GameState,
  playerId: string,
  cardDef: CardDef,
  stackId: string
): void {
  const pIdx = playerIndex(game, playerId);
  const player = findPlayer(game, playerId);
  const opponent = opponentOf(game, playerId);
  const rt = cardDef.rulesText;

  // Parse "discard N random card(s)" prefix
  const discardMatch = rt.match(/When this card is played, discard (\d+) random cards?/i);
  if (discardMatch) {
    const count = parseInt(discardMatch[1]);
    discardRandomCards(game, playerId, count);
    addLog(game, pIdx, `${cardDef.name} on-play: discard ${count} random card(s)`, 'BUILD');
  }

  // "you and opponent each discard a random card"
  if (/When this card is played, you and opponent each discard a random card/i.test(rt)) {
    discardRandomCards(game, playerId, 1);
    discardRandomCards(game, opponent.playerId, 1);
    addLog(game, pIdx, `${cardDef.name} on-play: both players discard a random card`, 'BUILD');
  }

  // "draw 2 cards"
  if (/When this card is played, draw 2 cards/i.test(rt)) {
    drawCards(game, playerId, 2);
    addLog(game, pIdx, `${cardDef.name} on-play: draw 2 cards`, 'BUILD');
  }

  // "you get an additional Build"
  if (/When this card is played, you get an additional Build\./i.test(rt)) {
    game.buildsRemaining += 1;
    addLog(game, pIdx, `${cardDef.name} on-play: +1 build`, 'BUILD');
  }

  // "you get an additional Build that may only be used on Equipment"
  if (/When this card is played, you get an additional Build that may only be used on Equipment/i.test(rt)) {
    game.buildsRemaining += 1;
    addLog(game, pIdx, `${cardDef.name} on-play: +1 build (equipment only)`, 'BUILD');
  }

  // "Tap an opponent's Stack"
  if (/When this card is played, Tap an opponent's Stack/i.test(rt)) {
    const untappedStacks = opponent.stacks.filter(s => !s.tapped);
    if (untappedStacks.length > 0) {
      if (isAI(playerId) || untappedStacks.length === 1) {
        // AI or only one target: auto-pick
        untappedStacks[0].tapped = true;
        addLog(game, pIdx, `${cardDef.name} on-play: taps opponent's stack`, 'BUILD');
      } else {
        // Human player: request target choice
        const validTargets: TargetOption[] = untappedStacks.map(s => {
          const topCard = s.cards.filter(c => c.faceUp).map(c => defOf(c).name).join(', ');
          return { id: s.stackId, label: topCard || 'Stack', ownerPlayerId: opponent.playerId, stackId: s.stackId };
        });
        requestTargetChoice(game, playerId, {
          effectSource: cardDef.cardCode,
          prompt: "Choose an opponent's stack to tap",
          targetType: 'stack',
          validTargets,
          allowSkip: true,
          context: 'on-play',
        }, {
          effectType: 'tap-opponent-stack',
          params: {},
          sourcePlayerId: playerId,
        });
      }
    }
  }

  // "search your deck for an Equipment and reveal it. Put it into your hand."
  if (/When this card is played, search your deck for an Equipment/i.test(rt)) {
    const deck = game.decks[pIdx];
    for (let i = deck.length - 1; i >= 0; i--) {
      const cDef = getCardDef(deck[i].cardCode);
      if (cDef.typeA === 'EQUIPMENT') {
        const card = deck.splice(i, 1)[0];
        player.hand.push(card);
        addLog(game, pIdx, `${cardDef.name} on-play: finds ${cDef.name}`, 'BUILD');
        shuffleDeck(deck);
        break;
      }
    }
  }

  // "search your deck for a Human and reveal it"
  if (/When this card is played, search your deck for a Human/i.test(rt)) {
    const deck = game.decks[pIdx];
    for (let i = deck.length - 1; i >= 0; i--) {
      const cDef = getCardDef(deck[i].cardCode);
      if (cDef.typeB === 'HUMAN') {
        const card = deck.splice(i, 1)[0];
        player.hand.push(card);
        addLog(game, pIdx, `${cardDef.name} on-play: finds ${cDef.name}`, 'BUILD');
        shuffleDeck(deck);
        break;
      }
    }
  }

  // "search your deck for a Character or Equipment and reveal it"
  if (/When this card is played, search your deck for a Character or Equipment/i.test(rt)) {
    const deck = game.decks[pIdx];
    for (let i = deck.length - 1; i >= 0; i--) {
      const cDef = getCardDef(deck[i].cardCode);
      if (cDef.typeA === 'CHARACTER' || cDef.typeA === 'EQUIPMENT') {
        const card = deck.splice(i, 1)[0];
        player.hand.push(card);
        addLog(game, pIdx, `${cardDef.name} on-play: finds ${cDef.name}`, 'BUILD');
        shuffleDeck(deck);
        break;
      }
    }
  }

  // "search your deck for a colorless Combat Trick"
  if (/search your deck for a colorless Combat Trick/i.test(rt)) {
    const deck = game.decks[pIdx];
    for (let i = deck.length - 1; i >= 0; i--) {
      const cDef = getCardDef(deck[i].cardCode);
      if (cDef.typeA === 'COMBAT TRICK' && cDef.color === 'none') {
        const card = deck.splice(i, 1)[0];
        player.hand.push(card);
        addLog(game, pIdx, `${cardDef.name} on-play: finds ${cDef.name}`, 'BUILD');
        shuffleDeck(deck);
        break;
      }
    }
  }

  // "you may put a card from your discard pile on top of your deck"
  if (/you may put a card from your discard pile on top of your deck/i.test(rt)) {
    if (player.discardPile.length > 0) {
      const card = player.discardPile.pop()!;
      game.decks[pIdx].push(card);
      addLog(game, pIdx, `${cardDef.name} on-play: puts card from discard on top of deck`, 'BUILD');
    }
  }

  // "you may put a card from your discard pile, stunned, on this Stack"
  if (/you may put a card from your discard pile, stunned, on this Stack/i.test(rt)) {
    if (player.discardPile.length > 0) {
      const card = player.discardPile.pop()!;
      card.faceUp = false;
      const stack = player.stacks.find((s) => s.stackId === stackId);
      if (stack) {
        stack.cards.push(card);
        addLog(game, pIdx, `${cardDef.name} on-play: adds card from discard (stunned)`, 'BUILD');
      }
    }
  }

  // "you may destroy an Equipment"
  if (/you may destroy an Equipment/i.test(rt)) {
    const equipTargets: TargetOption[] = [];
    for (const s of opponent.stacks) {
      for (const c of s.cards) {
        if (c.faceUp && defOf(c).typeA === 'EQUIPMENT') {
          equipTargets.push({
            id: c.instanceId,
            label: defOf(c).name,
            sublabel: `Power +${defOf(c).power}, Smarts +${defOf(c).smarts}`,
            stackId: s.stackId,
            ownerPlayerId: opponent.playerId,
          });
        }
      }
    }
    if (equipTargets.length > 0) {
      if (isAI(playerId) || equipTargets.length === 1) {
        // Auto-pick first equipment
        const target = equipTargets[0];
        const s = opponent.stacks.find(st => st.stackId === target.stackId);
        if (s) {
          const idx = s.cards.findIndex(c => c.instanceId === target.id);
          if (idx >= 0) {
            const removed = s.cards.splice(idx, 1)[0];
            opponent.discardPile.push(removed);
            addLog(game, pIdx, `${cardDef.name} on-play: destroys ${defOf(removed).name}`, 'BUILD');
          }
        }
      } else {
        requestTargetChoice(game, playerId, {
          effectSource: cardDef.cardCode,
          prompt: 'Choose an equipment to destroy',
          targetType: 'card-in-stack',
          validTargets: equipTargets,
          allowSkip: true,
          context: 'on-play',
        }, {
          effectType: 'destroy-equipment',
          params: {},
          sourcePlayerId: playerId,
        });
      }
    }
  }

  // "you may search opponent's deck for any card and put it into their discard pile"
  if (/search opponent's deck for any card and put it into their discard pile/i.test(rt)) {
    const opIdx = playerIndex(game, opponent.playerId);
    const opDeck = game.decks[opIdx];
    if (opDeck.length > 0) {
      // Remove a random card from opponent's deck
      const idx = Math.floor(Math.random() * opDeck.length);
      const card = opDeck.splice(idx, 1)[0];
      opponent.discardPile.push(card);
      addLog(game, pIdx, `${cardDef.name} on-play: removes a card from opponent's deck`, 'BUILD');
      shuffleDeck(opDeck);
    }
  }

  // Equipment on-play: "all players get 1 Mission Point"
  if (/When this card is played, all players get 1 Mission Point/i.test(rt)) {
    game.apScores[0] += 1;
    game.apScores[1] += 1;
    game.playerStats[0].apEarned += 1;
    game.playerStats[1].apEarned += 1;
    addLog(game, pIdx, `${cardDef.name} on-play: all players get 1 Mission Point`, 'AP');
  }

  // Equipment on-play: "all players lose 1 Mission Point"
  if (/When this card is played, all players lose 1 Mission Point/i.test(rt)) {
    game.apScores[0] = Math.max(0, game.apScores[0] - 1);
    game.apScores[1] = Math.max(0, game.apScores[1] - 1);
    addLog(game, pIdx, `${cardDef.name} on-play: all players lose 1 Mission Point`, 'AP');
  }

  // Equipment on-play: "discard 2 random cards" (Crucible)
  if (cardDef.typeA === 'EQUIPMENT' && /When this card is played, discard 2 random cards/i.test(rt)) {
    // Already handled by the general discard match above for characters
    // But Crucible is equipment - check if not already caught
    if (!discardMatch) {
      discardRandomCards(game, playerId, 2);
      addLog(game, pIdx, `${cardDef.name} on-play: discard 2 random cards`, 'BUILD');
    }
  }
}

function shuffleDeck(deck: { instanceId: string; cardCode: string; faceUp: boolean }[]): void {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

// ─── Action Card Effects (Phase 6) ───

/** Handle action card effects when played */
export function handleActionEffect(
  game: GameState,
  playerId: string,
  cardDef: CardDef,
  stackId: string
): void {
  const pIdx = playerIndex(game, playerId);
  const player = findPlayer(game, playerId);
  const opponent = opponentOf(game, playerId);
  const opIdx = playerIndex(game, opponent.playerId);
  const rt = cardDef.rulesText;

  // "Draw 3 cards"
  if (/Draw 3 cards/i.test(rt)) {
    drawCards(game, playerId, 3);
    addLog(game, pIdx, `${cardDef.name}: draw 3 cards`, 'BUILD');
  }

  // "Draw 2 cards" (not "draw 3")
  if (/Draw 2 cards/i.test(rt) && !/Draw 3/i.test(rt)) {
    drawCards(game, playerId, 2);
    addLog(game, pIdx, `${cardDef.name}: draw 2 cards`, 'BUILD');
  }

  // "Opponent loses 1 Mission Point"
  if (/Opponent loses 1 Mission Point/i.test(rt)) {
    game.apScores[opIdx] = Math.max(0, game.apScores[opIdx] - 1);
    addLog(game, pIdx, `${cardDef.name}: opponent loses 1 Mission Point`, 'AP');
  }

  // "Deal 2 Damage to a Stack" (Oora Drain)
  if (/Deal 2 Damage to a Stack/i.test(rt) && !/each/i.test(rt) && !/two/i.test(rt)) {
    const damageTargets = opponent.stacks.filter(s => s.cards.length > 0);
    if (damageTargets.length > 0) {
      if (isAI(playerId) || damageTargets.length === 1) {
        applyDamageToStack(damageTargets[0], opponent, 2, game);
        addLog(game, pIdx, `${cardDef.name}: deals 2 damage to opponent's stack`, 'COMBAT');
        opponent.stacks = opponent.stacks.filter((s) => s.cards.length > 0);
      } else {
        const validTargets: TargetOption[] = damageTargets.map(s => {
          const topCard = s.cards.filter(c => c.faceUp).map(c => defOf(c).name).join(', ');
          return { id: s.stackId, label: topCard || 'Stack', sublabel: `${s.cards.length} cards`, stackId: s.stackId, ownerPlayerId: opponent.playerId };
        });
        requestTargetChoice(game, playerId, {
          effectSource: cardDef.cardCode,
          prompt: 'Choose a stack to deal 2 damage to',
          targetType: 'stack',
          validTargets,
          allowSkip: false,
          context: 'action',
        }, {
          effectType: 'deal-damage-to-stack',
          params: { amount: 2 },
          sourcePlayerId: playerId,
        });
      }
    }
  }

  // "Deal 1 Damage to each Stack" (Fireball)
  if (/Deal 1 Damage to each Stack/i.test(rt)) {
    for (const s of player.stacks) {
      applyDamageToStack(s, player, 1, game);
    }
    for (const s of opponent.stacks) {
      applyDamageToStack(s, opponent, 1, game);
    }
    player.stacks = player.stacks.filter((s) => s.cards.length > 0);
    opponent.stacks = opponent.stacks.filter((s) => s.cards.length > 0);
    addLog(game, pIdx, `${cardDef.name}: deals 1 damage to each stack`, 'COMBAT');
  }

  // "Deal 1 Damage to two Stacks" (Bing Bang)
  if (/Deal 1 Damage to two Stacks/i.test(rt)) {
    let count = 0;
    for (const s of opponent.stacks) {
      if (s.cards.length > 0 && count < 2) {
        applyDamageToStack(s, opponent, 1, game);
        count++;
      }
    }
    opponent.stacks = opponent.stacks.filter((s) => s.cards.length > 0);
    addLog(game, pIdx, `${cardDef.name}: deals 1 damage to two stacks`, 'COMBAT');
  }

  // "Destroy an Equipment" (Meltdown)
  if (rt === 'Destroy an Equipment.') {
    for (const s of opponent.stacks) {
      for (let i = s.cards.length - 1; i >= 0; i--) {
        const c = s.cards[i];
        if (c.faceUp) {
          const cDef = defOf(c);
          if (cDef.typeA === 'EQUIPMENT') {
            s.cards.splice(i, 1);
            opponent.discardPile.push(c);
            addLog(game, pIdx, `${cardDef.name}: destroys ${cDef.name}`, 'BUILD');
            return;
          }
        }
      }
    }
  }

  // "Destroy up to two Equipments" (Double Elimination)
  if (/Destroy up to two Equipments/i.test(rt)) {
    let destroyed = 0;
    for (const s of [...opponent.stacks, ...player.stacks]) {
      for (let i = s.cards.length - 1; i >= 0 && destroyed < 2; i--) {
        const c = s.cards[i];
        if (c.faceUp) {
          const cDef = defOf(c);
          if (cDef.typeA === 'EQUIPMENT') {
            s.cards.splice(i, 1);
            const owner = game.players.find((p) => p.stacks.some((st) => st === s));
            if (owner) owner.discardPile.push(c);
            else opponent.discardPile.push(c);
            destroyed++;
          }
        }
      }
    }
    addLog(game, pIdx, `${cardDef.name}: destroys ${destroyed} equipment(s)`, 'BUILD');
  }

  // "Build a card" (From the Vault) — grant extra build
  if (rt === 'Build a card.' || rt === 'Build an Animal card.') {
    game.buildsRemaining += 1;
    addLog(game, pIdx, `${cardDef.name}: grants an extra build`, 'BUILD');
  }

  // "Search your deck for a Combat Trick" (Search for Knowledge)
  if (/Search your deck for a Combat Trick and reveal it/i.test(rt) && !/up to 2/i.test(rt)) {
    const deck = game.decks[pIdx];
    for (let i = deck.length - 1; i >= 0; i--) {
      const cDef = getCardDef(deck[i].cardCode);
      if (cDef.typeA === 'COMBAT TRICK') {
        const card = deck.splice(i, 1)[0];
        player.hand.push(card);
        addLog(game, pIdx, `${cardDef.name}: finds ${cDef.name}`, 'BUILD');
        shuffleDeck(deck);
        break;
      }
    }
  }

  // "Search your deck for up to 2 Combat Tricks" (Giving Advice)
  if (/Search your deck for up to 2 Combat Tricks/i.test(rt)) {
    const deck = game.decks[pIdx];
    let found = 0;
    for (let i = deck.length - 1; i >= 0 && found < 2; i--) {
      const cDef = getCardDef(deck[i].cardCode);
      if (cDef.typeA === 'COMBAT TRICK') {
        const card = deck.splice(i, 1)[0];
        player.hand.push(card);
        found++;
      }
    }
    if (found > 0) {
      addLog(game, pIdx, `${cardDef.name}: finds ${found} combat trick(s)`, 'BUILD');
      shuffleDeck(deck);
    }
  }

  // "Destroy a Sideplay. Draw a card." (Blizzard)
  if (/Destroy a Sideplay\. Draw a card\./i.test(rt)) {
    if (opponent.sideplay.length > 0) {
      const sp = opponent.sideplay.shift()!;
      opponent.discardPile.push(sp);
      addLog(game, pIdx, `${cardDef.name}: destroys opponent's sideplay`, 'BUILD');
    }
    drawCards(game, playerId, 1);
  }

  // "Destroy all Sideplays." (Whiteout)
  if (rt === 'Destroy all Sideplays.') {
    for (const p of game.players) {
      while (p.sideplay.length > 0) {
        const sp = p.sideplay.pop()!;
        p.discardPile.push(sp);
      }
    }
    addLog(game, pIdx, `${cardDef.name}: destroys all sideplays`, 'BUILD');
  }

  // "Untap Another Stack" / "Untap a Stack" (Recharge)
  if (/Untap (Another|a) Stack/i.test(rt) && !/control/i.test(rt)) {
    for (const s of player.stacks) {
      if (s.tapped && s.stackId !== stackId) {
        s.tapped = false;
        addLog(game, pIdx, `${cardDef.name}: untaps a stack`, 'BUILD');
        break;
      }
    }
  }

  // "Destroy a card in a Stack" (Night Lightning)
  if (rt === 'Destroy a card in a Stack.') {
    for (const s of opponent.stacks) {
      if (s.cards.length > 0) {
        const top = s.cards.pop()!;
        opponent.discardPile.push(top);
        addLog(game, pIdx, `${cardDef.name}: destroys a card in opponent's stack`, 'BUILD');
        break;
      }
    }
    opponent.stacks = opponent.stacks.filter((s) => s.cards.length > 0);
  }

  // "Destroy all Stunned cards in that Stack" (Demolish)
  if (/Destroy all Stunned cards in that Stack/i.test(rt)) {
    for (const s of opponent.stacks) {
      const stunned = s.cards.filter((c) => !c.faceUp);
      if (stunned.length > 0) {
        s.cards = s.cards.filter((c) => c.faceUp);
        opponent.discardPile.push(...stunned);
        addLog(game, pIdx, `${cardDef.name}: destroys ${stunned.length} stunned card(s)`, 'BUILD');
        break;
      }
    }
    opponent.stacks = opponent.stacks.filter((s) => s.cards.length > 0);
  }

  // "Destroy this Stack and an opponent's Stack" (From the Ashes)
  if (/Destroy this Stack and an opponent's Stack/i.test(rt)) {
    const myStack = player.stacks.find((s) => s.stackId === stackId);
    if (myStack) {
      player.discardPile.push(...myStack.cards);
      player.stacks = player.stacks.filter((s) => s.stackId !== stackId);
    }
    if (opponent.stacks.length > 0) {
      const target = opponent.stacks[0];
      opponent.discardPile.push(...target.cards);
      opponent.stacks = opponent.stacks.filter((s) => s.stackId !== target.stackId);
    }
    addLog(game, pIdx, `${cardDef.name}: destroys both stacks`, 'BUILD');
  }

  // "Tap all Stacks that have an AI" (Denial of Service)
  if (/Tap all Stacks that have an AI/i.test(rt)) {
    for (const p of game.players) {
      for (const s of p.stacks) {
        if (stackHasTypeB(s, 'AI')) {
          s.tapped = true;
        }
      }
    }
    addLog(game, pIdx, `${cardDef.name}: taps all stacks with AI`, 'BUILD');
  }

  // "Your Stacks do not take damage this turn" (Wall of Ice)
  if (/Your Stacks do not take damage this turn/i.test(rt)) {
    game.turnFlags.noDamagePlayerIds.push(playerId);
    addLog(game, pIdx, `${cardDef.name}: your stacks are protected this turn`, 'BUILD');
  }

  // Restore effects
  if (/Restore up to 2 cards in a Stack/i.test(rt)) {
    for (const s of player.stacks) {
      let restored = 0;
      for (const c of s.cards) {
        if (!c.faceUp && restored < 2) {
          c.faceUp = true;
          restored++;
        }
      }
      if (restored > 0) {
        addLog(game, pIdx, `${cardDef.name}: restores ${restored} card(s)`, 'BUILD');
        break;
      }
    }
  }

  // Restore or Stun a card (Tweedle) - auto restore own card
  if (rt === 'Restore or Stun a card.') {
    for (const s of player.stacks) {
      for (const c of s.cards) {
        if (!c.faceUp) {
          c.faceUp = true;
          addLog(game, pIdx, `${cardDef.name}: restores a card`, 'BUILD');
          return;
        }
      }
    }
    // If nothing to restore, stun opponent's card
    for (const s of opponent.stacks) {
      for (let i = s.cards.length - 1; i >= 0; i--) {
        if (s.cards[i].faceUp) {
          s.cards[i].faceUp = false;
          addLog(game, pIdx, `${cardDef.name}: stuns a card`, 'BUILD');
          return;
        }
      }
    }
  }

  // Temporary vicious boost: "All your Stacks get "Vicious: +1" until the end of this turn." (Ruthless)
  if (/All your Stacks get "Vicious: \+1" until the end of this turn/i.test(rt)) {
    game.turnFlags.extraVicious.push({ playerId, amount: 1 });
    addLog(game, pIdx, `${cardDef.name}: all stacks get Vicious: +1 this turn`, 'BUILD');
  }

  // Temporary strategy boosts
  if (/All your Stacks get "Power Strategy: \+1" until the end of this turn/i.test(rt)) {
    game.turnFlags.extraPowerStrategy.push({ playerId, amount: 1 });
    addLog(game, pIdx, `${cardDef.name}: all stacks get Power Strategy: +1 this turn`, 'BUILD');
  }
  if (/All your Stacks get "Smarts Strategy: \+1" until the end of this turn/i.test(rt)) {
    game.turnFlags.extraSmartsStrategy.push({ playerId, amount: 1 });
    addLog(game, pIdx, `${cardDef.name}: all stacks get Smarts Strategy: +1 this turn`, 'BUILD');
  }
}
