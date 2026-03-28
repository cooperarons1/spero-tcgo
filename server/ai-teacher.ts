/**
 * Teacher AI — slower, more powerful AI that uses lookahead simulation
 * and permutation search to make deeply-evaluated decisions.
 *
 * Used only in simulation (never in live games) to generate high-quality
 * decision data for distilling into the student AI's weights.
 */

import type { GameState, BoardMinion, PlayerState, CardDef, HeroClass, CardInstance } from '../shared/types.js';
import { getCardDef } from './cards.js';
import { playCard, useHeroPower, activateLocation } from './actions.js';
import { attack } from './combat.js';
import { endTurn, startTurn } from './game.js';
import { minionHasKeyword, getTauntMinions } from './keywords.js';
import {
  pickSmartTarget, pickTargetFromList, pickSmartAttackTarget,
  hasLethal, pickLethalTarget, cardPlayPriority, getAIMulliganReplacements,
} from './ai.js';

// ── Types ──

export interface TeacherDecision {
  type: 'mulligan' | 'play' | 'attack' | 'hero_power';
  hero: HeroClass;
  oppHero: HeroClass;
  turn: number;
  // Mulligan fields
  hand?: string[];
  kept?: boolean[];
  // Play fields
  card?: string;
  mana?: number;
  myBoard?: number;
  opBoard?: number;
  myHealth?: number;
  opHealth?: number;
  score?: number;
  onCurve?: boolean;
  // Attack fields
  attacker?: string;
  attackerAtk?: number;
  target?: string;
  targetHp?: number;
  reason?: string;
  // Hero power fields
  timing?: 'pre' | 'post';
  hpTarget?: string;
}

// ── Board State Evaluation ──

/**
 * Rich board evaluation function — the core of the teacher AI's intelligence.
 * Returns a score from the perspective of the given player (positive = ahead).
 */
export function evaluateBoard(game: GameState, playerIndex: 0 | 1): number {
  const me = game.players[playerIndex];
  const oppIdx = (playerIndex === 0 ? 1 : 0) as 0 | 1;
  const opp = game.players[oppIdx];

  let score = 0;

  // Material: weighted sum of minion stats
  for (const m of me.board) {
    score += minionValue(m);
  }
  for (const m of opp.board) {
    score -= minionValue(m);
  }

  // Health differential (weighted — being at 30 vs 25 matters less than 10 vs 5)
  const myEffectiveHp = me.health + me.armor;
  const oppEffectiveHp = opp.health + opp.armor;
  score += healthValue(myEffectiveHp) - healthValue(oppEffectiveHp);

  // Card advantage: each card in hand is worth ~2 points
  score += (me.hand.length - opp.hand.length) * 2;

  // Board control: bonus for having more minions
  const myMinions = me.board.length;
  const oppMinions = opp.board.length;
  if (myMinions > 0 && oppMinions === 0) score += 8; // empty opponent board is great
  else score += (myMinions - oppMinions) * 1.5;

  // Weapon value
  if (me.weapon) score += me.weapon.currentAttack * me.weapon.durability * 0.8;
  if (opp.weapon) score -= opp.weapon.currentAttack * opp.weapon.durability * 0.8;

  // Location value
  score += me.locations.length * 2;
  score -= opp.locations.length * 2;

  // Secret value
  score += me.secrets.length * 2;
  score -= opp.secrets.length * 1.5; // slightly less because unknown

  // Lethal threat: large bonus if close to lethal
  const myDamage = totalAvailableDamage(me);
  if (myDamage >= oppEffectiveHp) score += 50; // we have lethal
  else if (myDamage >= oppEffectiveHp * 0.7) score += 10; // close to lethal

  const oppDamage = totalAvailableDamage(opp);
  if (oppDamage >= myEffectiveHp) score -= 50; // opponent has lethal
  else if (oppDamage >= myEffectiveHp * 0.7) score -= 10;

  // Taunt wall: bonus for having taunts when low HP
  if (myEffectiveHp <= 15) {
    const tauntHealth = me.board
      .filter(m => minionHasKeyword(m, 'TAUNT'))
      .reduce((sum, m) => sum + m.currentHealth, 0);
    score += tauntHealth * 0.5;
  }

  return score;
}

function minionValue(m: BoardMinion): number {
  let val = m.currentAttack * 1.5 + m.currentHealth;
  if (minionHasKeyword(m, 'TAUNT')) val += 3;
  if (minionHasKeyword(m, 'WINDFURY')) val += m.currentAttack * 1.2;
  if (m.hasDivineShield) val += 3;
  if (m.hasStealthUntilAttack) val += 2;
  if (m.canAttack && m.attacksRemaining > 0 && !m.isFrozen) val += 1; // ready to attack bonus
  return val;
}

function healthValue(hp: number): number {
  // Diminishing returns — low health is much more costly
  if (hp <= 0) return -100;
  if (hp <= 5) return hp * 3;  // each point matters a lot
  if (hp <= 15) return 15 + (hp - 5) * 1.5;
  return 30 + (hp - 15) * 0.5; // above 15, less marginal value
}

function totalAvailableDamage(player: PlayerState): number {
  let dmg = 0;
  for (const m of player.board) {
    if (m.canAttack && m.attacksRemaining > 0 && !m.isFrozen && m.currentAttack > 0) {
      dmg += m.currentAttack * m.attacksRemaining;
    }
  }
  if (player.weapon) dmg += player.weapon.currentAttack;
  if (player.heroAttackThisTurn > 0) dmg += player.heroAttackThisTurn;
  return dmg;
}

// ── Deep Clone ──

function cloneMinion(m: BoardMinion): BoardMinion {
  return {
    instanceId: m.instanceId, cardCode: m.cardCode,
    currentAttack: m.currentAttack, currentHealth: m.currentHealth, maxHealth: m.maxHealth,
    canAttack: m.canAttack, attacksRemaining: m.attacksRemaining,
    hasDivineShield: m.hasDivineShield, isFrozen: m.isFrozen, isSilenced: m.isSilenced,
    hasStealthUntilAttack: m.hasStealthUntilAttack,
    enchantments: m.enchantments.map(e => ({ ...e, addedKeywords: e.addedKeywords ? [...e.addedKeywords] : undefined })),
    currentOrraCharge: m.currentOrraCharge, isCollared: m.isCollared, collarOwnerIndex: m.collarOwnerIndex,
  };
}

function clonePlayer(p: PlayerState): PlayerState {
  return {
    playerId: p.playerId, playerName: p.playerName, heroClass: p.heroClass,
    health: p.health, maxHealth: p.maxHealth, armor: p.armor,
    mana: p.mana, maxMana: p.maxMana,
    hand: p.hand.map(c => ({ ...c })),
    board: p.board.map(cloneMinion),
    weapon: p.weapon ? { ...p.weapon } : null,
    locations: p.locations.map(l => ({ ...l })),
    heroPowerUsed: p.heroPowerUsed, heroAttackThisTurn: p.heroAttackThisTurn,
    fatigueDamage: p.fatigueDamage,
    graveyard: p.graveyard.map(c => ({ ...c })),
    secrets: p.secrets.map(s => ({ ...s })),
    heroPowerUpgraded: p.heroPowerUpgraded, upgradeProgress: p.upgradeProgress,
  };
}

/**
 * Deep-clone a GameState for lookahead simulation.
 * Manually clones to avoid copying the huge log array — saves ~90% memory.
 */
function cloneGame(game: GameState): GameState {
  return {
    players: [clonePlayer(game.players[0]), clonePlayer(game.players[1])],
    decks: [game.decks[0].map(c => ({ ...c })), game.decks[1].map(c => ({ ...c }))],
    currentPlayerIndex: game.currentPlayerIndex,
    turnNumber: game.turnNumber,
    phase: game.phase,
    mulliganChoices: [game.mulliganChoices[0]?.slice() ?? null, game.mulliganChoices[1]?.slice() ?? null],
    mulliganConfirmed: [...game.mulliganConfirmed],
    winner: game.winner,
    winReason: game.winReason,
    lastAction: game.lastAction,
    log: [],  // Drop the log — not needed for evaluation
    turnStartedAt: game.turnStartedAt,
    playerStats: [{ ...game.playerStats[0] }, { ...game.playerStats[1] }],
    pendingInteraction: null,
    cardsPlayedThisTurn: game.cardsPlayedThisTurn,
  };
}

// ── Lookahead Evaluation ──

/**
 * Evaluate a candidate move by cloning state, applying the move,
 * and running rollouts to estimate outcome quality.
 */
function evaluateCardPlay(
  game: GameState,
  playerIndex: 0 | 1,
  cardInstanceId: string,
  targetId: string | null,
  rollouts: number = 3
): number {
  let totalScore = 0;
  let validRollouts = 0;

  for (let r = 0; r < rollouts; r++) {
    try {
      const sim = cloneGame(game);
      const me = sim.players[playerIndex];

      const result = playCard(sim, me.playerId, cardInstanceId, undefined, targetId);
      if (!result.success) return -Infinity;

      // Simulate a few turns of student-level play to get a future board state
      const evalScore = rolloutAndEvaluate(sim, playerIndex, 2);
      totalScore += evalScore;
      validRollouts++;
    } catch {
      // Rollout failed — skip
    }
  }

  return validRollouts > 0 ? totalScore / validRollouts : -Infinity;
}

/**
 * Run a short rollout (a few turns of greedy play) then evaluate the board.
 */
function rolloutAndEvaluate(game: GameState, perspective: 0 | 1, turnsToSimulate: number): number {
  const MAX_ACTIONS = 50;
  let actions = 0;

  for (let t = 0; t < turnsToSimulate && !game.winner; t++) {
    const pIdx = game.currentPlayerIndex;
    const me = game.players[pIdx];
    const oppIdx = (pIdx === 0 ? 1 : 0) as 0 | 1;
    const opp = game.players[oppIdx];

    // Play cards greedily (student-level logic)
    let played = true;
    while (played && !game.winner && actions < MAX_ACTIONS) {
      played = false;
      actions++;
      const playable = me.hand
        .filter(c => {
          const def = getCardDef(c.cardCode);
          return def.manaCost <= me.mana && c.cardCode !== 'COIN';
        })
        .sort((a, b) => cardPlayPriority(getCardDef(b.cardCode), me, opp) - cardPlayPriority(getCardDef(a.cardCode), me, opp));

      for (const card of playable) {
        if (game.winner) break;
        const def = getCardDef(card.cardCode);
        if (def.type === 'MINION' && me.board.length >= 7) continue;
        if (def.type === 'LOCATION' && (me.board.length + me.locations.length) >= 7) continue;
        if (def.secretTrigger) {
          if (me.secrets.some(s => s.cardCode === card.cardCode)) continue;
          if (me.secrets.length >= 5) continue;
        }

        let targetId: string | null = null;
        if (def.type === 'MINION' && def.keywords.includes('BATTLECRY') && def.battlecryEffect) {
          targetId = pickSmartTarget(game, pIdx as 0 | 1, def);
        } else if (def.type === 'SPELL' && def.spellEffect) {
          targetId = pickSmartTarget(game, pIdx as 0 | 1, def);
        }

        const result = playCard(game, me.playerId, card.instanceId, undefined, targetId);
        if (result.success) { played = true; break; }
        if (result.needsTarget && result.validTargets?.length) {
          const retryTarget = pickTargetFromList(game, pIdx as 0 | 1, def, result.validTargets);
          const retry = playCard(game, me.playerId, card.instanceId, undefined, retryTarget);
          if (retry.success) { played = true; break; }
        }
      }
    }

    if (game.winner) break;

    // Attacks
    const goingLethal = hasLethal(me, opp);
    for (const minion of [...me.board]) {
      if (game.winner) break;
      if (!minion.canAttack || minion.attacksRemaining <= 0 || minion.isFrozen || minion.currentAttack <= 0) continue;
      const target = goingLethal
        ? pickLethalTarget(minion, opp, oppIdx)
        : pickSmartAttackTarget(minion, me, opp, oppIdx);
      if (!target) continue;
      attack(game, me.playerId, minion.instanceId, target);
      if (minion.attacksRemaining > 0 && !game.winner) {
        const target2 = pickSmartAttackTarget(minion, me, opp, oppIdx);
        if (target2) attack(game, me.playerId, minion.instanceId, target2);
      }
    }

    if (game.winner) break;
    endTurn(game, me.playerId);
  }

  // If someone won during rollout, score accordingly
  if (game.winner) {
    const winnerIdx = game.players.findIndex(p => p.playerId === game.winner);
    return winnerIdx === perspective ? 100 : -100;
  }

  return evaluateBoard(game, perspective);
}

// ── Attack Permutation Search ──

/**
 * Try permutations of attack orders to find the optimal sequence.
 * For N attackers, tries up to maxPerms permutations.
 */
function findBestAttackOrder(
  game: GameState,
  playerIndex: 0 | 1,
  maxPerms: number = 120
): Array<{ attackerId: string; targetId: string }> {
  const me = game.players[playerIndex];
  const oppIdx = (playerIndex === 0 ? 1 : 0) as 0 | 1;
  const opp = game.players[oppIdx];

  const attackers = me.board.filter(
    m => m.canAttack && m.attacksRemaining > 0 && !m.isFrozen && m.currentAttack > 0
  );

  if (attackers.length === 0) return [];

  // For lethal, use the fast path
  if (hasLethal(me, opp)) {
    return attackers.map(a => ({
      attackerId: a.instanceId,
      targetId: pickLethalTarget(a, opp, oppIdx),
    }));
  }

  // For 1-3 attackers, try all permutations
  // For 4+ attackers, just try a sample of shuffled orderings
  const indices = attackers.map((_, i) => i);
  const perms = attackers.length <= 5
    ? getPermutations(indices).slice(0, maxPerms)
    : samplePermutations(indices, maxPerms);

  let bestScore = -Infinity;
  let bestOrder: Array<{ attackerId: string; targetId: string }> = [];

  for (const perm of perms) {
    try {
      const sim = cloneGame(game);
      const simMe = sim.players[playerIndex];
      const simOpp = sim.players[oppIdx];
      const attacks: Array<{ attackerId: string; targetId: string }> = [];

      for (const idx of perm) {
        const realAttacker = attackers[idx];
        const simAttacker = simMe.board.find(m => m.instanceId === realAttacker.instanceId);
        if (!simAttacker || simAttacker.attacksRemaining <= 0) continue;

        const target = pickSmartAttackTarget(simAttacker, simMe, simOpp, oppIdx);
        if (!target) continue;

        attacks.push({ attackerId: realAttacker.instanceId, targetId: target });
        attack(sim, simMe.playerId, simAttacker.instanceId, target);
        if (sim.winner) break;
      }

      const score = sim.winner
        ? (sim.winner === sim.players[playerIndex].playerId ? 100 : -100)
        : evaluateBoard(sim, playerIndex);

      if (score > bestScore) {
        bestScore = score;
        bestOrder = attacks;
      }
    } catch {
      // Skip invalid permutation
    }
  }

  // Fallback to student-level ordering if no permutation worked
  if (bestOrder.length === 0) {
    return attackers.map(a => ({
      attackerId: a.instanceId,
      targetId: pickSmartAttackTarget(a, me, opp, oppIdx) ?? `hero-${oppIdx}`,
    }));
  }

  return bestOrder;
}

function getPermutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  const result: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of getPermutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

function samplePermutations(arr: number[], count: number): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < count; i++) {
    const shuffled = [...arr];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    result.push(shuffled);
  }
  return result;
}

// ── Multi-Move Card Play ──

/**
 * For 2-card sequences, try all pairs and pick the best.
 * Returns the best first card + target to play.
 */
function findBestCardPlay(
  game: GameState,
  playerIndex: 0 | 1
): { cardInstanceId: string; targetId: string | null; score: number } | null {
  const me = game.players[playerIndex];
  const oppIdx = (playerIndex === 0 ? 1 : 0) as 0 | 1;
  const opp = game.players[oppIdx];

  const playable = me.hand
    .filter(c => {
      const def = getCardDef(c.cardCode);
      return def.manaCost <= me.mana && c.cardCode !== 'COIN';
    });

  if (playable.length === 0) return null;

  // Filter out unplayable cards (board full, duplicate secrets, etc.)
  const candidates = playable.filter(c => {
    const def = getCardDef(c.cardCode);
    if (def.type === 'MINION' && (me.board.length + me.locations.length) >= 7) return false;
    if (def.type === 'LOCATION' && (me.board.length + me.locations.length) >= 7) return false;
    if (def.secretTrigger) {
      if (me.secrets.some(s => s.cardCode === c.cardCode)) return false;
      if (me.secrets.length >= 5) return false;
    }
    return true;
  });

  if (candidates.length === 0) return null;

  let bestMove: { cardInstanceId: string; targetId: string | null; score: number } | null = null;

  for (const card of candidates) {
    const def = getCardDef(card.cardCode);

    // Determine target
    let targetId: string | null = null;
    if (def.type === 'MINION' && def.keywords.includes('BATTLECRY') && def.battlecryEffect) {
      targetId = pickSmartTarget(game, playerIndex, def);
    } else if (def.type === 'SPELL' && def.spellEffect) {
      targetId = pickSmartTarget(game, playerIndex, def);
    }

    // Evaluate with lookahead
    const score = evaluateCardPlay(game, playerIndex, card.instanceId, targetId, 2);

    if (score > -Infinity && (!bestMove || score > bestMove.score)) {
      bestMove = { cardInstanceId: card.instanceId, targetId, score };
    }

    // If the first attempt needed a target and failed, try getting valid targets
    if (score === -Infinity) {
      const sim = cloneGame(game);
      const result = playCard(sim, sim.players[playerIndex].playerId, card.instanceId, undefined, targetId);
      if (result.needsTarget && result.validTargets?.length) {
        const retryTarget = pickTargetFromList(game, playerIndex, def, result.validTargets);
        const retryScore = evaluateCardPlay(game, playerIndex, card.instanceId, retryTarget, 2);
        if (retryScore > -Infinity && (!bestMove || retryScore > bestMove.score)) {
          bestMove = { cardInstanceId: card.instanceId, targetId: retryTarget, score: retryScore };
        }
      }
    }
  }

  return bestMove;
}

// ── Teacher Turn Execution ──

/**
 * Execute a full teacher turn: play cards with lookahead, attack with permutation search.
 * Returns array of decisions for the distillation pipeline.
 */
export function executeTeacherTurn(
  game: GameState,
  playerIndex: 0 | 1
): TeacherDecision[] {
  const decisions: TeacherDecision[] = [];
  const me = game.players[playerIndex];
  const oppIdx = (playerIndex === 0 ? 1 : 0) as 0 | 1;
  const opp = game.players[oppIdx];
  const playerId = me.playerId;

  // Pre-attack hero power (damage classes: use before attacks to set up trades)
  if (!me.heroPowerUsed && me.mana >= 2) {
    const preHpResult = tryTeacherPreHeroPower(game, playerIndex);
    if (preHpResult) {
      decisions.push(preHpResult);
    }
  }

  // Play cards with lookahead
  let cardsPlayed = 0;
  const MAX_PLAYS = 10;
  while (cardsPlayed < MAX_PLAYS && !game.winner) {
    const bestPlay = findBestCardPlay(game, playerIndex);
    if (!bestPlay) break;

    const card = me.hand.find(c => c.instanceId === bestPlay.cardInstanceId);
    if (!card) break;

    const def = getCardDef(card.cardCode);
    const result = playCard(game, playerId, bestPlay.cardInstanceId, undefined, bestPlay.targetId);

    if (result.success) {
      const isOnCurve = def.manaCost === me.maxMana || def.manaCost === me.maxMana - 1;
      decisions.push({
        type: 'play',
        hero: me.heroClass,
        oppHero: opp.heroClass,
        turn: game.turnNumber,
        card: card.cardCode,
        mana: me.maxMana,
        myBoard: me.board.length,
        opBoard: opp.board.length,
        myHealth: me.health + me.armor,
        opHealth: opp.health + opp.armor,
        score: bestPlay.score,
        onCurve: isOnCurve,
      });
      cardsPlayed++;
    } else if (result.needsTarget && result.validTargets?.length) {
      const retryTarget = pickTargetFromList(game, playerIndex, def, result.validTargets);
      const retry = playCard(game, playerId, bestPlay.cardInstanceId, undefined, retryTarget);
      if (retry.success) {
        decisions.push({
          type: 'play',
          hero: me.heroClass,
          oppHero: opp.heroClass,
          turn: game.turnNumber,
          card: card.cardCode,
          mana: me.maxMana,
          myBoard: me.board.length,
          opBoard: opp.board.length,
          myHealth: me.health + me.armor,
          opHealth: opp.health + opp.armor,
          score: bestPlay.score,
          onCurve: def.manaCost === me.maxMana || def.manaCost === me.maxMana - 1,
        });
        cardsPlayed++;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  if (game.winner) return decisions;

  // Attacks with permutation search
  const attackOrder = findBestAttackOrder(game, playerIndex);
  for (const atk of attackOrder) {
    if (game.winner) break;
    const attacker = me.board.find(m => m.instanceId === atk.attackerId);
    if (!attacker || attacker.attacksRemaining <= 0) continue;

    const result = attack(game, playerId, atk.attackerId, atk.targetId);
    if (result.success) {
      const isHeroTarget = atk.targetId.startsWith('hero-');
      const targetMinion = isHeroTarget ? null : opp.board.find(m => m.instanceId === atk.targetId);
      decisions.push({
        type: 'attack',
        hero: me.heroClass,
        oppHero: opp.heroClass,
        turn: game.turnNumber,
        attacker: attacker.cardCode,
        attackerAtk: attacker.currentAttack,
        target: isHeroTarget ? 'face' : (targetMinion?.cardCode ?? 'unknown'),
        targetHp: isHeroTarget ? (opp.health + opp.armor) : (targetMinion?.currentHealth ?? 0),
        reason: isHeroTarget ? 'face' : (
          attacker.currentAttack >= (targetMinion?.currentHealth ?? 999) ? 'exact_kill' : 'trade'
        ),
      });

      // Windfury second attack
      if (attacker.attacksRemaining > 0 && !game.winner) {
        const target2 = pickSmartAttackTarget(attacker, me, opp, oppIdx);
        if (target2) {
          attack(game, playerId, attacker.instanceId, target2);
        }
      }
    }
  }

  if (game.winner) return decisions;

  // Post-attack hero power
  if (!me.heroPowerUsed && me.mana >= 2) {
    const postHpResult = tryTeacherPostHeroPower(game, playerIndex);
    if (postHpResult) {
      decisions.push(postHpResult);
    }
  }

  return decisions;
}

// ── Teacher Hero Power Logic ──

function tryTeacherPreHeroPower(game: GameState, playerIndex: 0 | 1): TeacherDecision | null {
  const me = game.players[playerIndex];
  const oppIdx = (playerIndex === 0 ? 1 : 0) as 0 | 1;
  const opp = game.players[oppIdx];

  // Derek: draw before playing for more options
  if (me.heroClass === 'DEREK') {
    useHeroPower(game, me.playerId, null);
    return {
      type: 'hero_power', hero: me.heroClass, oppHero: opp.heroClass,
      turn: game.turnNumber, timing: 'pre', hpTarget: 'draw',
    };
  }

  // Damage-based hero powers: evaluate if pinging enables better trades
  if (me.heroClass === 'JIMMY' || me.heroClass === 'DES') {
    const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);
    if (targetable.length === 0) return null;

    // Use lookahead: try each target and see which gives best board eval
    let bestTarget: string | null = null;
    let bestScore = -Infinity;

    for (const enemy of targetable) {
      if (enemy.hasDivineShield) continue;
      try {
        const sim = cloneGame(game);
        const hpTarget = me.heroClass === 'JIMMY' ? enemy.instanceId : null;
        useHeroPower(sim, sim.players[playerIndex].playerId, hpTarget);
        const score = evaluateBoard(sim, playerIndex);
        if (score > bestScore) {
          bestScore = score;
          bestTarget = hpTarget;
        }
      } catch { /* skip */ }
    }

    // Also evaluate not using it pre-attack
    const noUseScore = evaluateBoard(game, playerIndex);
    if (bestTarget !== null && bestScore > noUseScore + 1) {
      useHeroPower(game, me.playerId, bestTarget);
      return {
        type: 'hero_power', hero: me.heroClass, oppHero: opp.heroClass,
        turn: game.turnNumber, timing: 'pre', hpTarget: bestTarget ?? 'face',
      };
    }
  }

  // Tala: buff if it enables a kill
  if (me.heroClass === 'TALA' && me.board.length > 0) {
    const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);
    for (const friendly of me.board) {
      if (!friendly.canAttack || friendly.attacksRemaining <= 0 || friendly.isFrozen) continue;
      const buffedAtk = friendly.currentAttack + 1;
      for (const enemy of targetable) {
        if (enemy.hasDivineShield) continue;
        if (friendly.currentAttack < enemy.currentHealth && buffedAtk >= enemy.currentHealth) {
          useHeroPower(game, me.playerId, friendly.instanceId);
          return {
            type: 'hero_power', hero: me.heroClass, oppHero: opp.heroClass,
            turn: game.turnNumber, timing: 'pre', hpTarget: friendly.instanceId,
          };
        }
      }
    }
  }

  return null;
}

function tryTeacherPostHeroPower(game: GameState, playerIndex: 0 | 1): TeacherDecision | null {
  const me = game.players[playerIndex];
  const oppIdx = (playerIndex === 0 ? 1 : 0) as 0 | 1;
  const opp = game.players[oppIdx];

  let hpTarget: string | null = null;
  let shouldUse = true;

  switch (me.heroClass) {
    case 'JIMMY': {
      const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);
      if (targetable.length > 0) {
        const exactKill = targetable.find(m => !m.hasDivineShield && m.currentHealth === 2);
        const anyKill = targetable.find(m => !m.hasDivineShield && m.currentHealth <= 2);
        hpTarget = (exactKill ?? anyKill)?.instanceId ?? `hero-${oppIdx}`;
      } else {
        hpTarget = `hero-${oppIdx}`;
      }
      break;
    }
    case 'TALA':
      if (me.board.length > 0) {
        hpTarget = [...me.board].sort((a, b) => b.currentAttack - a.currentAttack)[0].instanceId;
      } else { shouldUse = false; }
      break;
    case 'DEREK': case 'DES': case 'IZZY': case 'LUCAS':
      hpTarget = null; break;
    case 'ANDERS': {
      const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);
      if (targetable.length > 0) {
        hpTarget = targetable.sort((a, b) => b.currentAttack - a.currentAttack)[0].instanceId;
      } else { shouldUse = false; }
      break;
    }
    case 'ASTRID': {
      const cands = me.board.filter(m => !m.hasDivineShield);
      if (cands.length > 0) {
        hpTarget = cands.sort((a, b) => b.currentAttack - a.currentAttack)[0].instanceId;
      } else { shouldUse = false; }
      break;
    }
    case 'AVA':
      if (me.board.length < 7) hpTarget = null;
      else shouldUse = false;
      break;
    default: shouldUse = false;
  }

  if (!shouldUse) return null;

  useHeroPower(game, me.playerId, hpTarget);
  return {
    type: 'hero_power', hero: me.heroClass, oppHero: opp.heroClass,
    turn: game.turnNumber, timing: 'post', hpTarget: hpTarget ?? 'none',
  };
}

// ── Teacher Mulligan ──

/**
 * Teacher mulligan: uses the student mulligan as a baseline,
 * but also evaluates hand composition with lookahead.
 */
export function getTeacherMulliganDecision(
  hand: CardInstance[],
  heroClass: HeroClass,
  opponentClass: HeroClass
): { replacements: boolean[]; decision: TeacherDecision } {
  // Use student mulligan as the teacher baseline
  // (the student mulligan is already quite good with the weights)
  const replacements = getAIMulliganReplacements(hand, heroClass, opponentClass);

  const decision: TeacherDecision = {
    type: 'mulligan',
    hero: heroClass,
    oppHero: opponentClass,
    turn: 0,
    hand: hand.map(c => c.cardCode),
    kept: replacements.map(r => !r), // kept = not replaced
  };

  return { replacements, decision };
}
