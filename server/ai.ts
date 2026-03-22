import type { GameState, CardDef, Stack, PlayerZone, CardInstance } from '../shared/types.js';
import { getCardDef } from './cards.js';
import { buildCard } from './actions.js';
import { endBuildPhase, endActionPhase } from './game.js';
import {
  startPowerMission,
  startSmartsMission,
  handleBlockDecision,
  handleCombatTrick,
  playActionCard,
} from './combat.js';
import {
  canBuildOnStack,
  canBlock,
  canPlayAction,
  stackPower,
  stackSmarts,
  stackSize,
  stackColor,
  defOf,
  topCharacter,
} from './rules.js';
import { getSideplayStatBonuses, getSideplayKeywordBonuses, parseCombatTrickEffect } from './abilities.js';
import { getStackKeywords, parseKeywords } from './rules.js';
import { resolveTargetChoice } from './targeting.js';
import { AP_TO_WIN } from '../shared/types.js';

// ── Constants ──

export const AI_PLAYER_ID_PREFIX = 'ai-bot-';

const AI_NAMES = [
  'SperoBot', 'CardMaster AI', 'Robo Duelist', 'Circuit Sage',
  'Byte Battler', 'Neon Rival', 'Pixel Prowler', 'Data Deck',
];

const DELAYS = {
  build: 1200,
  endBuild: 800,
  mission: 1500,
  endAction: 800,
  block: 1500,
  trick: 1000,
  target: 600,
  dismissCombat: 1200,
};

// ── Exports ──

export function isAIPlayer(playerId: string): boolean {
  return playerId.startsWith(AI_PLAYER_ID_PREFIX);
}

export function generateAIPlayerId(): string {
  return `${AI_PLAYER_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function randomAIName(): string {
  return AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];
}

// Track pending timeouts to avoid duplicate scheduling
const pendingAITimeouts = new Set<string>();

/**
 * Called after every broadcastGameState. Checks if the AI needs to act
 * and schedules the appropriate action with a delay.
 */
export function scheduleAITurn(
  game: GameState,
  aiPlayerId: string,
  broadcastFn: () => void
): void {
  if (game.winner) return;

  const aiIdx = game.players.findIndex(p => p.playerId === aiPlayerId);
  if (aiIdx === -1) return;

  const gameKey = `${aiPlayerId}-${game.turnNumber}-${game.turnPhase}-${game.pendingInteraction?.type ?? 'none'}-${game.combatResult ? 'cr' : ''}`;

  // Prevent duplicate scheduling
  if (pendingAITimeouts.has(gameKey)) return;
  pendingAITimeouts.add(gameKey);

  const cleanup = () => pendingAITimeouts.delete(gameKey);

  // 1. Dismiss combat result if present
  if (game.combatResult) {
    setTimeout(() => {
      cleanup();
      if (game.combatResult) {
        game.combatResult = null;
        broadcastFn();
      }
    }, DELAYS.dismissCombat);
    return;
  }

  // 2. Pending interaction waiting for AI
  if (game.pendingInteraction && game.pendingInteraction.waitingForPlayerId === aiPlayerId) {
    const interaction = game.pendingInteraction;

    if (interaction.type === 'BLOCK_DECISION') {
      setTimeout(() => {
        cleanup();
        handleAIBlock(game, aiPlayerId);
        broadcastFn();
      }, DELAYS.block);
      return;
    }

    if (interaction.type === 'COMBAT_TRICK') {
      setTimeout(() => {
        cleanup();
        handleAICombatTrick(game, aiPlayerId);
        broadcastFn();
      }, DELAYS.trick);
      return;
    }

    if (interaction.type === 'CHOOSE_TARGET') {
      setTimeout(() => {
        cleanup();
        handleAITargetChoice(game, aiPlayerId);
        broadcastFn();
      }, DELAYS.target);
      return;
    }
  }

  // 3. AI's active turn — BUILD phase
  const isMyTurn = game.players[game.currentPlayerIndex].playerId === aiPlayerId;
  if (!isMyTurn) {
    cleanup();
    return;
  }

  if (game.turnPhase === 'BUILD') {
    setTimeout(() => {
      cleanup();
      doAIBuild(game, aiPlayerId);
      broadcastFn();
    }, DELAYS.build);
    return;
  }

  // 4. AI's active turn — ACTION phase
  if (game.turnPhase === 'ACTION') {
    setTimeout(() => {
      cleanup();
      doAIAction(game, aiPlayerId);
      broadcastFn();
    }, DELAYS.mission);
    return;
  }

  // UNTAP/DRAW/END are automatic
  cleanup();
}

// ── BUILD Phase AI ──

export function doAIBuild(game: GameState, aiPlayerId: string): void {
  if (game.turnPhase !== 'BUILD' || game.buildsRemaining <= 0) {
    endBuildPhase(game, aiPlayerId);
    return;
  }

  const player = getAIPlayer(game, aiPlayerId);
  const hand = player.hand;

  if (hand.length === 0) {
    endBuildPhase(game, aiPlayerId);
    return;
  }

  type BuildOption = {
    score: number;
    cardInstanceId: string;
    targetStackId: string | null;
    faceDown: boolean;
  };

  const options: BuildOption[] = [];

  for (const card of hand) {
    const def = getCardDef(card.cardCode);

    // Option: start a new stack with 0-cost CHARACTER
    if (def.typeA === 'CHARACTER' && def.cost === 0) {
      const check = canBuildOnStack(def, null, player);
      if (check.ok) {
        // Diminishing returns for many stacks — soft penalty
        const stackPenalty = player.stacks.length * 3;
        options.push({
          score: 20 + def.power + def.smarts - stackPenalty,
          cardInstanceId: card.instanceId,
          targetStackId: null,
          faceDown: false,
        });
      }
    }

    // Option: play on existing stacks
    for (const stack of player.stacks) {
      // Face-up character
      if (def.typeA === 'CHARACTER') {
        const check = canBuildOnStack(def, stack, player);
        if (check.ok) {
          options.push({
            score: 15 + def.power + def.smarts + Math.random() * 2,
            cardInstanceId: card.instanceId,
            targetStackId: stack.stackId,
            faceDown: false,
          });
        }
      }

      // Face-up equipment
      if (def.typeA === 'EQUIPMENT') {
        const check = canBuildOnStack(def, stack, player);
        if (check.ok) {
          options.push({
            score: 12 + def.power + def.smarts + Math.random() * 2,
            cardInstanceId: card.instanceId,
            targetStackId: stack.stackId,
            faceDown: false,
          });
        }
      }
    }

    // Option: play ACTION with SIDEPLAY as face-up build (evaluate the sideplay effect)
    if (def.typeA === 'ACTION' && def.typeB === 'SIDEPLAY') {
      const rt = def.rulesText.toLowerCase();
      let sideplayScore = 14;
      if (rt.includes('mission point') || rt.includes('ap')) sideplayScore = 22;
      else if (/\+\d+ power|\+\d+ smarts/i.test(rt)) sideplayScore = 16;
      else if (rt.includes('vicious') || rt.includes('strategy')) sideplayScore = 14;
      // Sideplays can't be built face-up during build phase normally — they are actions
      // Skip here; they'll be handled in action phase
    }

    // Option: face-down on largest stack for padding
    if (player.stacks.length > 0) {
      const largest = player.stacks.reduce((a, b) =>
        b.cards.length > a.cards.length ? b : a
      );
      // Only play non-combat-trick, non-action cards face-down typically
      if (def.typeA !== 'COMBAT TRICK') {
        options.push({
          score: 5 + Math.random() * 2,
          cardInstanceId: card.instanceId,
          targetStackId: largest.stackId,
          faceDown: true,
        });
      }
    }
  }

  if (options.length === 0) {
    endBuildPhase(game, aiPlayerId);
    return;
  }

  // Pick best option (with jitter already applied)
  options.sort((a, b) => b.score - a.score);
  const best = options[0];

  // Don't build face-down if we have better things to do
  if (best.faceDown && best.score <= 5 && game.buildsRemaining <= 1) {
    endBuildPhase(game, aiPlayerId);
    return;
  }

  buildCard(game, aiPlayerId, best.cardInstanceId, best.targetStackId, best.faceDown);
}

// ── ACTION Phase AI ──

export function doAIAction(game: GameState, aiPlayerId: string): void {
  if (game.turnPhase !== 'ACTION' || game.combatState) return;

  const player = getAIPlayer(game, aiPlayerId);
  const aiIdx = game.players.indexOf(player) as 0 | 1;
  const opponent = game.players[aiIdx === 0 ? 1 : 0];

  type ActionOption = {
    score: number;
    execute: () => void;
  };

  const options: ActionOption[] = [];

  // Missions
  for (const stack of player.stacks) {
    if (stack.tapped) continue;
    if (game.actedStacks.has(stack.stackId)) continue;
    if (stack.createdOnTurn === game.turnNumber) continue;
    if (!topCharacter(stack)) continue;

    const spBonuses = getSideplayStatBonuses(game, stack, aiPlayerId);
    const power = stackPower(stack, spBonuses.power);
    const smarts = stackSmarts(stack, spBonuses.smarts);

    // Check if unblockable for each stat
    const canAnyBlockPower = power > 0 && opponent.stacks.some(s => {
      if (s.tapped) return false;
      const defSp = getSideplayStatBonuses(game, s, s.ownerId);
      return stackPower(s, defSp.power) >= Math.ceil(power / 2);
    });

    const canAnyBlockSmarts = smarts > 0 && opponent.stacks.some(s => {
      if (s.tapped) return false;
      const defSp = getSideplayStatBonuses(game, s, s.ownerId);
      return stackSmarts(s, defSp.smarts) >= Math.ceil(smarts / 2);
    });

    if (power > 0) {
      let score = power * 2;
      if (!canAnyBlockPower) score += 10;
      options.push({
        score,
        execute: () => { startPowerMission(game, aiPlayerId, stack.stackId); },
      });
    }

    if (smarts > 0) {
      let score = smarts * 2;
      if (!canAnyBlockSmarts) score += 10;
      options.push({
        score,
        execute: () => { startSmartsMission(game, aiPlayerId, stack.stackId); },
      });
    }
  }

  // Action cards
  for (const card of player.hand) {
    const def = getCardDef(card.cardCode);
    if (def.typeA !== 'ACTION') continue;

    for (const stack of player.stacks) {
      const check = canPlayAction(def, stack);
      if (!check.ok) continue;
      if (game.actedStacks.has(stack.stackId)) continue;

      let score = 5 + Math.random() * 2;
      const rulesLower = def.rulesText.toLowerCase();

      if (rulesLower.includes('draw')) {
        // Scale with hand emptiness
        score = Math.max(5, 20 - player.hand.length * 2);
      } else if (def.typeB === 'SIDEPLAY') {
        // Evaluate sideplay effect
        if (rulesLower.includes('mission point') || rulesLower.includes('ap')) score = 22;
        else if (/\+\d+ power|\+\d+ smarts/i.test(rulesLower)) score = 16;
        else if (rulesLower.includes('vicious') || rulesLower.includes('strategy')) score = 14;
        else score = 14;
      } else if (rulesLower.includes('damage') || rulesLower.includes('destroy')) {
        // Score higher when opponent stacks are small (near destruction)
        const minOppSize = opponent.stacks.length > 0
          ? Math.min(...opponent.stacks.map(s => s.cards.length))
          : 999;
        score = minOppSize <= 2 ? 18 : 12;
      } else if (rulesLower.includes('stun')) {
        score = 10;
      } else if (rulesLower.includes('untap')) {
        score = 8;
      } else if (rulesLower.includes('build')) {
        score = 7;
      }

      options.push({
        score,
        execute: () => { playActionCard(game, aiPlayerId, card.instanceId, stack.stackId); },
      });
    }
  }

  if (options.length === 0) {
    endActionPhase(game, aiPlayerId);
    return;
  }

  options.sort((a, b) => b.score - a.score);
  options[0].execute();
}

// ── Combat AI ──

export function handleAIBlock(game: GameState, aiPlayerId: string): void {
  const combat = game.combatState;
  if (!combat || combat.phase !== 'AWAITING_BLOCK') return;

  const defender = getAIPlayer(game, aiPlayerId);
  const aiIdx = game.players.indexOf(defender) as 0 | 1;
  const oppIdx = aiIdx === 0 ? 1 : 0;
  const opponentAP = game.apScores[oppIdx];
  const myAP = game.apScores[aiIdx];

  // Find eligible blockers
  type BlockerOption = {
    stackId: string;
    stat: number;
    stackSize: number;
  };

  const blockers: BlockerOption[] = [];
  for (const stack of defender.stacks) {
    if (stack.tapped) continue;
    const spBonuses = getSideplayStatBonuses(game, stack, aiPlayerId);
    const stat = combat.missionType === 'POWER'
      ? stackPower(stack, spBonuses.power)
      : stackSmarts(stack, spBonuses.smarts);

    if (stat >= Math.ceil(combat.attackerStat / 2)) {
      blockers.push({ stackId: stack.stackId, stat, stackSize: stack.cards.length });
    }
  }

  if (blockers.length === 0) {
    handleBlockDecision(game, aiPlayerId, null);
    return;
  }

  // Sort by best stat, then by stack size (larger stacks absorb damage better)
  blockers.sort((a, b) => {
    if (b.stat !== a.stat) return b.stat - a.stat;
    return b.stackSize - a.stackSize;
  });
  const best = blockers[0];

  // Desperate block if opponent is about to win
  if (opponentAP + 1 >= AP_TO_WIN) {
    handleBlockDecision(game, aiPlayerId, best.stackId);
    return;
  }

  // Block if we can win the combat
  if (best.stat > combat.attackerStat) {
    handleBlockDecision(game, aiPlayerId, best.stackId);
    return;
  }

  // Block if close and we have a combat trick
  const hasTrick = defender.hand.some(c => getCardDef(c.cardCode).typeA === 'COMBAT TRICK');
  if (best.stat >= combat.attackerStat - 2 && hasTrick) {
    handleBlockDecision(game, aiPlayerId, best.stackId);
    return;
  }

  // Block more aggressively when we have fewer stacks (protect board presence)
  if (defender.stacks.length <= 2 && best.stat >= combat.attackerStat - 3) {
    handleBlockDecision(game, aiPlayerId, best.stackId);
    return;
  }

  // Block to protect AP lead
  if (myAP > opponentAP && myAP >= AP_TO_WIN - 3) {
    handleBlockDecision(game, aiPlayerId, best.stackId);
    return;
  }

  // Block if the blocking stack is large enough to absorb damage safely
  if (best.stackSize >= 4 && best.stat >= combat.attackerStat - 1) {
    handleBlockDecision(game, aiPlayerId, best.stackId);
    return;
  }

  // Otherwise decline
  handleBlockDecision(game, aiPlayerId, null);
}

export function handleAICombatTrick(game: GameState, aiPlayerId: string): void {
  const combat = game.combatState;
  if (!combat) return;

  const player = getAIPlayer(game, aiPlayerId);
  const tricks = player.hand.filter(c => getCardDef(c.cardCode).typeA === 'COMBAT TRICK');

  if (tricks.length === 0) {
    handleCombatTrick(game, aiPlayerId, null);
    return;
  }

  // Score each trick
  type TrickOption = {
    score: number;
    instanceId: string;
  };

  const options: TrickOption[] = [];

  for (const trick of tricks) {
    const def = getCardDef(trick.cardCode);
    let score = 0;

    // Raw stat bonus
    const statBonus = combat.missionType === 'POWER' ? def.power : def.smarts;
    score += statBonus * 2;

    // Parse rules text for effects
    const rules = def.rulesText.toLowerCase();
    if (rules.includes('draw')) {
      const drawMatch = rules.match(/draw\s+(\d+)/);
      if (drawMatch) score += parseInt(drawMatch[1]) * 3;
      else score += 3;
    }
    if (rules.includes('damage') && rules.includes('opposing')) score += 4;
    if (rules.includes('block') && rules.includes('trick')) score += 5;
    if (rules.includes('no damage')) score += 6;
    if (rules.includes('stun')) score += 4;

    options.push({ score: score + Math.random() * 2, instanceId: trick.instanceId });
  }

  options.sort((a, b) => b.score - a.score);
  const best = options[0];

  if (best.score > 3) {
    handleCombatTrick(game, aiPlayerId, best.instanceId);
  } else {
    handleCombatTrick(game, aiPlayerId, null);
  }
}

export function handleAITargetChoice(game: GameState, aiPlayerId: string): void {
  const interaction = game.pendingInteraction;
  if (!interaction || interaction.type !== 'CHOOSE_TARGET') return;

  const choice = interaction.targetChoice;
  if (!choice) {
    resolveTargetChoice(game, aiPlayerId, null);
    return;
  }

  if (choice.validTargets.length === 0) {
    resolveTargetChoice(game, aiPlayerId, choice.allowSkip ? null : null);
    return;
  }

  // Context-aware target selection
  let bestTarget = choice.validTargets[0];

  const prompt = choice.prompt.toLowerCase();
  const context = choice.context;

  if (prompt.includes('stun') || prompt.includes('tap')) {
    // Target the highest-stat card/stack
    let bestScore = -1;
    for (const t of choice.validTargets) {
      // Prefer opponent-owned targets
      const isOpponent = t.ownerPlayerId && t.ownerPlayerId !== aiPlayerId;
      let score = isOpponent ? 10 : 0;
      // Try to parse stats from label
      const statMatch = t.label.match(/Power:?\s*(\d+)/i) || t.label.match(/Smarts:?\s*(\d+)/i);
      if (statMatch) score += parseInt(statMatch[1]);
      if (score > bestScore) { bestScore = score; bestTarget = t; }
    }
  } else if (prompt.includes('destroy') && prompt.includes('equipment')) {
    // Target the highest-bonus equipment
    let bestScore = -1;
    for (const t of choice.validTargets) {
      const isOpponent = t.ownerPlayerId && t.ownerPlayerId !== aiPlayerId;
      let score = isOpponent ? 10 : 0;
      const bonusMatch = t.label.match(/\+(\d+)/);
      if (bonusMatch) score += parseInt(bonusMatch[1]);
      if (score > bestScore) { bestScore = score; bestTarget = t; }
    }
  } else if (prompt.includes('restore')) {
    // Target the highest-cost face-down card (most valuable to restore)
    let bestScore = -1;
    for (const t of choice.validTargets) {
      const isOwn = t.ownerPlayerId === aiPlayerId || !t.ownerPlayerId;
      let score = isOwn ? 10 : 0;
      const costMatch = t.sublabel?.match(/Cost:?\s*(\d+)/i);
      if (costMatch) score += parseInt(costMatch[1]);
      if (score > bestScore) { bestScore = score; bestTarget = t; }
    }
  } else if (prompt.includes('damage')) {
    // Target opponent's smallest stack (most likely to be destroyed)
    let bestScore = -1;
    for (const t of choice.validTargets) {
      const isOpponent = t.ownerPlayerId && t.ownerPlayerId !== aiPlayerId;
      let score = isOpponent ? 20 : 0;
      // Smaller stacks are better targets for damage
      const sizeMatch = t.sublabel?.match(/(\d+) cards?/i);
      if (sizeMatch) score += 10 - parseInt(sizeMatch[1]);
      if (score > bestScore) { bestScore = score; bestTarget = t; }
    }
  }

  resolveTargetChoice(game, aiPlayerId, bestTarget.id);
}

// ── Helpers ──

function getAIPlayer(game: GameState, aiPlayerId: string): PlayerZone {
  return game.players.find(p => p.playerId === aiPlayerId)!;
}
