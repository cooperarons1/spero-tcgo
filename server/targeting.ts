import type { GameState, PendingInteraction } from '../shared/types.js';

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
