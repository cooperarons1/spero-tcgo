import type { GameState, PendingInteraction, TargetChoice, TargetOption } from '../shared/types.js';
import { getCardDef } from './cards.js';

let nextInteractionId = 1;

export function resetInteractionCounter(): void {
  nextInteractionId = 1;
}

/** Request a target choice from a player */
export function requestTargetChoice(
  game: GameState,
  playerId: string,
  choice: Omit<TargetChoice, 'interactionId'>
): void {
  const interactionId = `ti-${nextInteractionId++}`;
  const targetChoice: TargetChoice = { ...choice, interactionId };

  game.log; // ensure game reference is valid
  (game as any).pendingInteraction = {
    type: 'CHOOSE_TARGET' as const,
    waitingForPlayerId: playerId,
    timeoutAt: Date.now() + 30000,
    targetChoice,
  };
}

/** Resolve a target choice */
export function resolveTargetChoice(
  game: GameState,
  playerId: string,
  selectedId: string | null
): { valid: boolean; selectedId: string | null } {
  const interaction = (game as any).pendingInteraction as PendingInteraction | null;
  if (!interaction || interaction.type !== 'CHOOSE_TARGET') {
    return { valid: false, selectedId: null };
  }
  if (interaction.waitingForPlayerId !== playerId) {
    return { valid: false, selectedId: null };
  }

  const choice = interaction.targetChoice!;

  // Skip allowed
  if (selectedId === null && choice.allowSkip) {
    (game as any).pendingInteraction = null;
    return { valid: true, selectedId: null };
  }

  // Validate the selected ID is in valid targets
  if (selectedId && choice.validTargets.some(t => t.id === selectedId)) {
    (game as any).pendingInteraction = null;
    return { valid: true, selectedId };
  }

  return { valid: false, selectedId: null };
}
