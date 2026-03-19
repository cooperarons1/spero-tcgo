// Card-specific ability handlers
// For now this is a stub — individual card abilities will be added as needed

import type { GameState } from '../shared/types.js';

type AbilityHandler = (game: GameState, playerId: string, context: Record<string, string>) => void;

const abilityHandlers = new Map<string, AbilityHandler>();

/** Register a card ability handler by cardCode */
export function registerAbility(cardCode: string, handler: AbilityHandler): void {
  abilityHandlers.set(cardCode, handler);
}

/** Execute a card's ability if it has one */
export function executeAbility(
  cardCode: string,
  game: GameState,
  playerId: string,
  context: Record<string, string> = {}
): boolean {
  const handler = abilityHandlers.get(cardCode);
  if (!handler) return false;
  handler(game, playerId, context);
  return true;
}

// Example abilities can be registered here:
// registerAbility('R001', (game, playerId) => { ... });
