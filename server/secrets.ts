import type { GameState, SecretTrigger, ActiveSecret } from '../shared/types.js';
import { MAX_BOARD_SIZE } from '../shared/types.js';
import { getCardDef } from './cards.js';
import { addLog } from './log.js';
import { executeEffects } from './effects.js';
import { createBoardMinion, checkDeaths } from './combat.js';

/**
 * Check and resolve secrets in response to a game event.
 *
 * Only one secret fires per event (oldest first).
 * Secrets never fire on their owner's own actions,
 * except WHEN_FRIENDLY_MINION_DIES which fires for the dead minion's owner.
 */
export function checkSecrets(
  game: GameState,
  trigger: SecretTrigger,
  context: {
    actingPlayerIndex: 0 | 1;
    attackerInstanceId?: string;
    targetId?: string;
    minionInstanceId?: string;
    spellCardCode?: string;
    deadMinionCardCode?: string;
    deadMinionOwnerIndex?: 0 | 1;
  }
): { triggered: boolean; countered?: boolean } {
  // Prevent re-entrancy — secrets should not trigger other secrets
  if ((game as any)._secretResolving) {
    return { triggered: false };
  }

  // Determine whose secrets to check
  let secretOwnerIndex: 0 | 1;

  if (trigger === 'WHEN_FRIENDLY_MINION_DIES') {
    // Check secrets owned by the dead minion's owner
    if (context.deadMinionOwnerIndex == null) {
      return { triggered: false };
    }
    secretOwnerIndex = context.deadMinionOwnerIndex;
  } else {
    // Check secrets owned by the OPPONENT of the acting player
    secretOwnerIndex = (context.actingPlayerIndex === 0 ? 1 : 0) as 0 | 1;
  }

  const owner = game.players[secretOwnerIndex];
  if (!owner.secrets || owner.secrets.length === 0) {
    return { triggered: false };
  }

  // Find the first (oldest) secret that matches this trigger
  const secretIndex = owner.secrets.findIndex((s) => {
    const def = getCardDef(s.cardCode);
    return def.secretTrigger === trigger;
  });

  if (secretIndex === -1) {
    return { triggered: false };
  }

  const secret = owner.secrets[secretIndex];
  const def = getCardDef(secret.cardCode);

  // Remove the secret before resolving (oldest-first, one per event)
  owner.secrets.splice(secretIndex, 1);

  // Set re-entrancy guard
  (game as any)._secretResolving = true;

  // Log the reveal
  addLog(
    game,
    secretOwnerIndex,
    `Secret revealed: ${def.name}`,
    'PLAY'
  );

  // Gather the secret's effects
  const effects = def.secretEffects ?? (def.secretEffect ? [def.secretEffect] : []);

  let countered = false;

  // Check for COUNTER_SPELL effect
  if (effects.some((e) => e.type === 'COUNTER_SPELL')) {
    countered = true;
    // Still execute any remaining non-counter effects
    const nonCounterEffects = effects.filter((e) => e.type !== 'COUNTER_SPELL');
    if (nonCounterEffects.length > 0) {
      executeEffects(game, secretOwnerIndex, nonCounterEffects);
    }
    (game as any)._secretResolving = false;
    return { triggered: true, countered: true };
  }

  // Check for COPY_MINION effect
  const copyEffect = effects.find((e) => e.type === 'COPY_MINION');
  if (copyEffect && context.minionInstanceId) {
    // Find the minion that triggered the secret (on opponent's board)
    const oppIdx = (secretOwnerIndex === 0 ? 1 : 0) as 0 | 1;
    const sourceBoardMinion = game.players[oppIdx].board.find(
      (m) => m.instanceId === context.minionInstanceId
    );

    if (sourceBoardMinion && owner.board.length < MAX_BOARD_SIZE) {
      const copy = createBoardMinion(sourceBoardMinion.cardCode);
      owner.board.push(copy);
      addLog(
        game,
        secretOwnerIndex,
        `Secret copies ${def.name}: summoned a copy of ${getCardDef(sourceBoardMinion.cardCode).name}`,
        'PLAY'
      );
    }

    // Execute remaining non-copy effects
    const otherEffects = effects.filter((e) => e.type !== 'COPY_MINION');
    if (otherEffects.length > 0) {
      const targetId = resolveTargetForTrigger(trigger, context);
      executeEffects(game, secretOwnerIndex, otherEffects, targetId);
    }

    checkDeaths(game);
    (game as any)._secretResolving = false;
    return { triggered: true };
  }

  // Standard effect resolution — determine target based on trigger type
  const targetId = resolveTargetForTrigger(trigger, context);
  executeEffects(game, secretOwnerIndex, effects, targetId);
  checkDeaths(game);

  (game as any)._secretResolving = false;
  return { triggered: true, countered };
}

/**
 * Determine the correct targetId for effects based on the trigger type.
 */
function resolveTargetForTrigger(
  trigger: SecretTrigger,
  context: {
    attackerInstanceId?: string;
    minionInstanceId?: string;
  }
): string | undefined {
  switch (trigger) {
    case 'WHEN_ATTACKED':
    case 'WHEN_HERO_ATTACKED':
      // Effects target the attacker
      return context.attackerInstanceId;

    case 'WHEN_MINION_PLAYED':
      // Effects target the played minion
      return context.minionInstanceId;

    case 'WHEN_FRIENDLY_MINION_DIES':
      // Self-targeted — no specific target
      return undefined;

    case 'WHEN_SPELL_CAST':
      // No specific minion target for spell triggers
      return undefined;

    default:
      return undefined;
  }
}
