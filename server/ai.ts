import type { GameState, BoardMinion, PlayerState, CardDef, HeroClass } from '../shared/types.js';
import { getCardDef } from './cards.js';
import { playCard, useHeroPower } from './actions.js';
import { attack } from './combat.js';
import { endTurn } from './game.js';
import { minionHasKeyword, hasActiveTaunt, getTauntMinions } from './keywords.js';

// ── Constants ──

export const AI_PLAYER_ID_PREFIX = 'ai-bot-';

const AI_NAMES = [
  'MiroBot', 'CardMaster AI', 'Robo Duelist', 'Circuit Sage',
  'Byte Battler', 'Neon Rival', 'Pixel Prowler', 'Data Deck',
];

const DELAYS = {
  action: 1800,
  endTurn: 1200,
};

// ── Exports ──

export function generateAIPlayerId(): string {
  return `${AI_PLAYER_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function randomAIName(): string {
  return AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];
}

export function isAIPlayer(playerId: string): boolean {
  return playerId.startsWith(AI_PLAYER_ID_PREFIX);
}

/**
 * Schedule an AI turn. The AI plays cards on curve, makes trades, then goes face.
 */
export function scheduleAITurn(
  game: GameState,
  aiPlayerId: string,
  broadcast: () => void
): void {
  if (game.winner) return;
  if (game.phase !== 'PLAYING') return;
  if (game.players[game.currentPlayerIndex].playerId !== aiPlayerId) return;

  // Prevent duplicate scheduling
  if ((game as any)._aiScheduled) return;
  (game as any)._aiScheduled = true;

  setTimeout(() => {
    delete (game as any)._aiScheduled;
    executeAITurn(game, aiPlayerId, broadcast);
  }, DELAYS.action);
}

function executeAITurn(
  game: GameState,
  aiPlayerId: string,
  broadcast: () => void
): void {
  if (game.winner) return;
  if (game.players[game.currentPlayerIndex].playerId !== aiPlayerId) return;

  const myIdx = game.players.findIndex(p => p.playerId === aiPlayerId) as 0 | 1;
  const me = game.players[myIdx];
  const oppIdx = (myIdx === 0 ? 1 : 0) as 0 | 1;
  const opp = game.players[oppIdx];

  // 1. Play cards on curve (spend mana efficiently)
  let played = true;
  while (played && !game.winner) {
    played = false;

    // Check if playing Coin would enable a card that doesn't currently fit
    const coinCard = me.hand.find(c => c.cardCode === 'COIN');
    if (coinCard) {
      const bestUnplayable = me.hand
        .filter(c => c.cardCode !== 'COIN')
        .filter(c => {
          const d = getCardDef(c.cardCode);
          return d.manaCost > me.mana && d.manaCost <= me.mana + 1;
        })
        .sort((a, b) => getCardDef(b.cardCode).manaCost - getCardDef(a.cardCode).manaCost)[0];
      if (bestUnplayable) {
        const coinResult = playCard(game, aiPlayerId, coinCard.instanceId);
        if (coinResult.success) {
          played = true;
          broadcast();
          continue;
        }
      }
    }

    // Sort hand by mana cost descending (play expensive cards first)
    const playableCards = me.hand
      .filter(c => {
        const def = getCardDef(c.cardCode);
        return def.manaCost <= me.mana && c.cardCode !== 'COIN';
      })
      .sort((a, b) => getCardDef(b.cardCode).manaCost - getCardDef(a.cardCode).manaCost);

    for (const card of playableCards) {
      if (game.winner) break;
      const def = getCardDef(card.cardCode);

      // Skip if board is full and it's a minion
      if (def.type === 'MINION' && me.board.length >= 7) continue;

      // Play secrets immediately if affordable and not duplicate
      if (def.secretTrigger) {
        if (me.secrets.some(s => s.cardCode === card.cardCode)) continue;
        if (me.secrets.length >= 5) continue;
        const result = playCard(game, aiPlayerId, card.instanceId);
        if (result.success) { played = true; broadcast(); break; }
        continue;
      }

      // For targeted effects, pick a smart target
      let targetId: string | null = null;

      if (def.type === 'MINION' && def.keywords.includes('BATTLECRY') && def.battlecryEffect) {
        targetId = pickAITarget(game, myIdx, def);
      } else if (def.type === 'SPELL' && def.spellEffect) {
        targetId = pickAITarget(game, myIdx, def);
      }

      const result = playCard(game, aiPlayerId, card.instanceId, undefined, targetId);
      if (result.success) {
        played = true;
        broadcast();
        break; // Re-evaluate after each play
      } else if (result.needsTarget && result.validTargets && result.validTargets.length > 0) {
        // Try with first valid target
        const retryTarget = pickTargetFromList(game, myIdx, def, result.validTargets);
        const retry = playCard(game, aiPlayerId, card.instanceId, undefined, retryTarget);
        if (retry.success) {
          played = true;
          broadcast();
          break;
        }
      }
    }
  }

  if (game.winner) return;

  // 2. Make attacks
  executeAIAttacks(game, aiPlayerId, myIdx, oppIdx, broadcast);

  if (game.winner) return;

  // 3. Use hero power if mana leftover
  if (!me.heroPowerUsed && me.mana >= 2) {
    let hpTarget: string | null = null;

    switch (me.heroClass) {
      case 'JIMMY':
        // Deal 2 damage — prefer enemy minions, then face
        hpTarget = opp.board.length > 0
          ? pickWeakestMinion(opp.board)
          : `hero-${oppIdx}`;
        break;
      case 'TALA':
        // Heal — prefer damaged friendly minions, then self
        const damaged = me.board.filter(m => m.currentHealth < m.maxHealth);
        if (damaged.length > 0) {
          hpTarget = damaged.sort((a, b) => (a.maxHealth - a.currentHealth) - (b.maxHealth - b.currentHealth))[damaged.length - 1].instanceId;
        } else if (me.health < me.maxHealth) {
          hpTarget = `hero-${myIdx}`;
        } else {
          hpTarget = `hero-${myIdx}`;
        }
        break;
      case 'DEREK':
        // Draw a card — no target needed
        hpTarget = null;
        break;
      case 'ANDERS':
        // Freeze + 1 damage to enemy minion
        if (opp.board.length > 0) {
          hpTarget = pickBiggestMinion(opp.board);
        }
        break;
      case 'DES':
        // Dark Command: random 2 damage (no target needed)
        hpTarget = null;
        break;
      case 'ASTRID':
        // Mighty Guard: give Divine Shield to biggest friendly minion without it
        {
          const candidates = me.board.filter(m => !m.hasDivineShield);
          if (candidates.length > 0) {
            hpTarget = pickBiggestMinion(candidates);
          }
        }
        break;
      case 'AVA':
        // Deploy Drone: summon 1/1 (no target needed, only if board not full)
        if (me.board.length < 7) {
          hpTarget = null;
        } else {
          hpTarget = undefined as any; // skip
        }
        break;
      case 'LUCAS':
        // Coyote Trick: random bounce (no target, only use if enemy has minions)
        if (opp.board.length > 0) {
          hpTarget = null;
        }
        break;
      case 'IZZY':
        // Chart Course: gain 2 armor (no target needed)
        hpTarget = null;
        break;
    }

    // Use hero power if we have a target or class doesn't need one
    const noTargetNeeded = ['DEREK', 'DES', 'IZZY'].includes(me.heroClass) ||
      (me.heroClass === 'AVA' && me.board.length < 7) ||
      (me.heroClass === 'LUCAS' && opp.board.length > 0);
    if (hpTarget || noTargetNeeded) {
      useHeroPower(game, aiPlayerId, hpTarget);
    }
    broadcast();
  }

  if (game.winner) return;

  // 4. End turn
  setTimeout(() => {
    if (game.winner) return;
    if (game.players[game.currentPlayerIndex].playerId !== aiPlayerId) return;
    endTurn(game, aiPlayerId);
    broadcast();
  }, DELAYS.endTurn);
}

function executeAIAttacks(
  game: GameState,
  aiPlayerId: string,
  myIdx: 0 | 1,
  oppIdx: 0 | 1,
  broadcast: () => void
): void {
  const me = game.players[myIdx];
  const opp = game.players[oppIdx];

  // Attack with each available minion
  for (const minion of [...me.board]) {
    if (game.winner) break;
    if (!minion.canAttack || minion.attacksRemaining <= 0 || minion.isFrozen || minion.currentAttack <= 0) continue;

    const targetId = pickAttackTarget(minion, opp, oppIdx);
    if (!targetId) continue;

    const result = attack(game, aiPlayerId, minion.instanceId, targetId);
    if (result.success) broadcast();

    // If Windfury, attack again
    if (minion.attacksRemaining > 0 && !game.winner) {
      const target2 = pickAttackTarget(minion, opp, oppIdx);
      if (target2) {
        const result2 = attack(game, aiPlayerId, minion.instanceId, target2);
        if (result2.success) broadcast();
      }
    }
  }

  // Attack with weapon if equipped
  if (me.weapon && me.weapon.currentAttack > 0) {
    const heroTarget = pickAttackTargetForHero(me, opp, oppIdx);
    if (heroTarget) {
      const result = attack(game, aiPlayerId, `hero-${myIdx}`, heroTarget);
      if (result.success) broadcast();
    }
  }
}

function pickAttackTarget(
  attacker: BoardMinion,
  opp: PlayerState,
  oppIdx: 0 | 1
): string | null {
  // Must attack taunt first
  const taunts = getTauntMinions(opp.board);
  if (taunts.length > 0) {
    // Find taunt we can kill (account for divine shield)
    const killable = taunts.filter(t => !t.hasDivineShield && t.currentHealth <= attacker.currentAttack);
    if (killable.length > 0) {
      return killable.sort((a, b) => b.currentAttack - a.currentAttack)[0].instanceId;
    }
    // Pop divine shield on low-attack taunt minions
    const shielded = taunts.filter(t => t.hasDivineShield);
    if (shielded.length > 0) {
      return shielded.sort((a, b) => a.currentAttack - b.currentAttack)[0].instanceId;
    }
    return taunts[0].instanceId;
  }

  // Look for favorable trades (skip divine shield minions — not killable in one hit)
  const trades = opp.board
    .filter(m => !m.hasStealthUntilAttack && !m.hasDivineShield)
    .filter(m => m.currentHealth <= attacker.currentAttack && m.currentAttack < attacker.currentHealth);

  if (trades.length > 0) {
    // Kill the strongest enemy we can
    return trades.sort((a, b) => b.currentAttack - a.currentAttack)[0].instanceId;
  }

  // Go face
  return `hero-${oppIdx}`;
}

function pickAttackTargetForHero(
  me: PlayerState,
  opp: PlayerState,
  oppIdx: 0 | 1
): string | null {
  if (!me.weapon) return null;
  const weaponAtk = me.weapon.currentAttack;

  const taunts = getTauntMinions(opp.board);
  if (taunts.length > 0) {
    const killable = taunts.filter(t => !t.hasDivineShield && t.currentHealth <= weaponAtk);
    if (killable.length > 0) return killable[0].instanceId;
    return taunts[0].instanceId;
  }

  // Value trades: attack frozen minions or low-health/high-attack minions
  const valueTrades = opp.board
    .filter(m => !m.hasStealthUntilAttack && !m.hasDivineShield)
    .filter(m => m.currentHealth <= weaponAtk && (m.isFrozen || (m.currentHealth <= 2 && m.currentAttack >= 3)));

  if (valueTrades.length > 0) {
    return valueTrades.sort((a, b) => b.currentAttack - a.currentAttack)[0].instanceId;
  }

  // Otherwise go face
  return `hero-${oppIdx}`;
}

function pickAITarget(
  game: GameState,
  myIdx: 0 | 1,
  def: CardDef
): string | null {
  const oppIdx = (myIdx === 0 ? 1 : 0) as 0 | 1;
  const opp = game.players[oppIdx];
  const me = game.players[myIdx];

  // Pick the first targeting effect from plural or singular
  const effects = def.type === 'SPELL'
    ? (def.spellEffects ?? (def.spellEffect ? [def.spellEffect] : []))
    : (def.battlecryEffects ?? (def.battlecryEffect ? [def.battlecryEffect] : []));
  const effect = effects[0];
  if (!effect) return null;

  switch (effect.type) {
    case 'DEAL_DAMAGE':
      // Prefer killing an enemy minion (skip divine shield), else hit face
      if (opp.board.length > 0) {
        const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);
        const killable = targetable.filter(m => !m.hasDivineShield && m.currentHealth <= (effect.value ?? 0));
        if (killable.length > 0) return killable.sort((a, b) => b.currentAttack - a.currentAttack)[0].instanceId;
        return pickWeakestMinion(targetable) ?? `hero-${oppIdx}`;
      }
      return `hero-${oppIdx}`;

    case 'RESTORE_HEALTH':
      // Heal most damaged friendly
      const damaged = me.board.filter(m => m.currentHealth < m.maxHealth);
      if (damaged.length > 0) return damaged.sort((a, b) => (b.maxHealth - b.currentHealth) - (a.maxHealth - a.currentHealth))[0].instanceId;
      return me.health < me.maxHealth ? `hero-${myIdx}` : null;

    case 'BUFF_MINION':
      // Buff strongest friendly minion
      if (me.board.length > 0) return pickBiggestMinion(me.board);
      return null;

    case 'DESTROY_MINION':
      // Destroy strongest enemy
      if (opp.board.length > 0) return pickBiggestMinion(opp.board.filter(m => !m.hasStealthUntilAttack));
      return null;

    case 'FREEZE_TARGET':
      if (opp.board.length > 0) return pickBiggestMinion(opp.board.filter(m => !m.hasStealthUntilAttack));
      return null;

    case 'RETURN_TO_HAND':
      // Bounce strongest enemy minion
      if (opp.board.length > 0) return pickBiggestMinion(opp.board.filter(m => !m.hasStealthUntilAttack));
      return null;

    case 'GRANT_KEYWORD':
      // Grant keyword to biggest friendly minion
      if (me.board.length > 0) return pickBiggestMinion(me.board);
      return null;

    default:
      return null;
  }
}

function pickTargetFromList(
  game: GameState,
  myIdx: 0 | 1,
  def: CardDef,
  validTargets: string[]
): string {
  const oppIdx = (myIdx === 0 ? 1 : 0) as 0 | 1;

  // For damage, prefer enemy targets
  const effects = def.type === 'SPELL'
    ? (def.spellEffects ?? (def.spellEffect ? [def.spellEffect] : []))
    : (def.battlecryEffects ?? (def.battlecryEffect ? [def.battlecryEffect] : []));
  const effect = effects[0];
  if (effect?.type === 'DEAL_DAMAGE' || effect?.type === 'DESTROY_MINION' || effect?.type === 'FREEZE_TARGET') {
    // Prefer enemy targets
    const enemyTargets = validTargets.filter(id => {
      if (id === `hero-${oppIdx}`) return true;
      return game.players[oppIdx].board.some(m => m.instanceId === id);
    });
    if (enemyTargets.length > 0) return enemyTargets[0];
  }

  if (effect?.type === 'RESTORE_HEALTH' || effect?.type === 'BUFF_MINION') {
    // Prefer friendly targets
    const friendlyTargets = validTargets.filter(id => {
      if (id === `hero-${myIdx}`) return true;
      return game.players[myIdx].board.some(m => m.instanceId === id);
    });
    if (friendlyTargets.length > 0) return friendlyTargets[0];
  }

  return validTargets[0];
}

function pickWeakestMinion(board: BoardMinion[]): string | null {
  if (board.length === 0) return null;
  return board.sort((a, b) => a.currentHealth - b.currentHealth)[0].instanceId;
}

function pickBiggestMinion(board: BoardMinion[]): string | null {
  if (board.length === 0) return null;
  return board.sort((a, b) => (b.currentAttack + b.currentHealth) - (a.currentAttack + a.currentHealth))[0].instanceId;
}
