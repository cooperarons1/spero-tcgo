import type { GameState, PendingInteraction, PlayerZone, Stack } from '../shared/types.js';
import { getCardDef } from './cards.js';
import { addLog } from './log.js';

export interface TargetChoice {
  interactionId: string;
  effectSource: string;
  prompt: string;
  targetType: 'card-in-stack' | 'stack' | 'card-in-discard' | 'card-in-deck' | 'sideplay';
  validTargets: TargetOption[];
  allowSkip: boolean;
  context: 'combat-trick' | 'on-play' | 'action' | 'sideplay-trigger';
}

export interface TargetOption {
  id: string;
  label: string;
  sublabel?: string;
  stackId?: string;
  ownerPlayerId?: string;
}

export interface PendingEffect {
  effectType: string;
  params: Record<string, any>;
  sourcePlayerId: string;
}

let nextInteractionId = 1;

export function resetInteractionCounter(): void {
  nextInteractionId = 1;
}

/**
 * Request a target choice from a player.
 * Sets pendingInteraction to CHOOSE_TARGET and stores targetChoice.
 */
export function requestTargetChoice(
  game: GameState,
  playerId: string,
  choice: Omit<TargetChoice, 'interactionId'>,
  pendingEffect: PendingEffect
): void {
  const interactionId = `ti-${nextInteractionId++}`;
  const targetChoice: TargetChoice = { ...choice, interactionId };

  game.pendingInteraction = {
    type: 'CHOOSE_TARGET',
    waitingForPlayerId: playerId,
    timeoutAt: Date.now() + 30000,
    targetChoice,
  };

  // Store the pending effect on the game state for resuming
  (game as any)._pendingEffect = pendingEffect;
}

/**
 * Resolve a target choice made by a player.
 * Validates the chosen target and clears the interaction.
 * Returns the selected target ID or null if invalid.
 */
export function resolveTargetChoice(
  game: GameState,
  playerId: string,
  selectedId: string | null
): { valid: boolean; selectedId: string | null; pendingEffect: PendingEffect | null } {
  const interaction = game.pendingInteraction;
  if (!interaction || interaction.type !== 'CHOOSE_TARGET') {
    return { valid: false, selectedId: null, pendingEffect: null };
  }
  if (interaction.waitingForPlayerId !== playerId) {
    return { valid: false, selectedId: null, pendingEffect: null };
  }

  const choice = interaction.targetChoice!;
  const pendingEffect: PendingEffect | null = (game as any)._pendingEffect ?? null;

  // Skip allowed
  if (selectedId === null && choice.allowSkip) {
    game.pendingInteraction = null;
    delete (game as any)._pendingEffect;
    return { valid: true, selectedId: null, pendingEffect };
  }

  // Validate the selected ID is in valid targets
  if (selectedId && choice.validTargets.some(t => t.id === selectedId)) {
    game.pendingInteraction = null;
    delete (game as any)._pendingEffect;
    return { valid: true, selectedId, pendingEffect };
  }

  return { valid: false, selectedId: null, pendingEffect: null };
}

/** Apply a resolved pending effect based on the selected target */
export function applyPendingEffect(
  game: GameState,
  pendingEffect: PendingEffect,
  selectedId: string | null
): void {
  if (!selectedId) return; // Skipped

  const sourcePlayer = game.players.find(p => p.playerId === pendingEffect.sourcePlayerId)!;
  const opponent = game.players.find(p => p.playerId !== pendingEffect.sourcePlayerId)!;
  const pIdx = game.players.indexOf(sourcePlayer) as 0 | 1;

  switch (pendingEffect.effectType) {
    case 'tap-opponent-stack': {
      const stack = opponent.stacks.find(s => s.stackId === selectedId);
      if (stack) {
        stack.tapped = true;
        addLog(game, pIdx, `Taps opponent's stack`, 'BUILD');
      }
      break;
    }
    case 'destroy-equipment': {
      for (const s of opponent.stacks) {
        const idx = s.cards.findIndex(c => c.instanceId === selectedId);
        if (idx >= 0) {
          const removed = s.cards.splice(idx, 1)[0];
          opponent.discardPile.push(removed);
          const def = getCardDef(removed.cardCode);
          addLog(game, pIdx, `Destroys ${def.name}`, 'BUILD');
          break;
        }
      }
      break;
    }
    case 'deal-damage-to-stack': {
      const stack = opponent.stacks.find(s => s.stackId === selectedId);
      if (stack) {
        const amount = pendingEffect.params.amount ?? 2;
        // Apply damage
        for (let i = 0; i < amount && stack.cards.length > 0; i++) {
          const faceDownIdx = stack.cards.findIndex(c => !c.faceUp);
          if (faceDownIdx >= 0) {
            const removed = stack.cards.splice(faceDownIdx, 1)[0];
            opponent.discardPile.push(removed);
          } else {
            const topIdx = stack.cards.length - 1;
            if (topIdx >= 0) stack.cards[topIdx].faceUp = false;
          }
        }
        addLog(game, pIdx, `Deals ${amount} damage to opponent's stack`, 'COMBAT');
        opponent.stacks = opponent.stacks.filter(s => s.cards.length > 0);
      }
      break;
    }
  }
}
