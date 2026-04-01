import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { GameState, BoardMinion, PlayerState, CardDef, HeroClass, CardInstance } from '../shared/types.js';
import { getCardDef } from './cards.js';
import { playCard, useHeroPower, activateLocation, resolveBattlecry, cancelBattlecry } from './actions.js';
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
  action: 2200,
  endTurn: 1500,
};

const AGGRO_CLASSES: HeroClass[] = ['JIMMY', 'LUCAS', 'DES'];

// ── AI Weights (loaded from simulation data) ──

interface CardStats {
  played: number;
  winRate: number;
  keepRate: number;
  keepWinRate: number;
}

interface AIWeights {
  version: number;
  classWinRates: Record<string, number>;
  matchupMatrix: Record<string, Record<string, number>>;
  classProfile: Record<string, string>; // 'aggro' | 'control' | 'midrange'
  cardStats?: Record<string, CardStats>;
  // v3 distilled fields (from teacher AI)
  cardMatchupBonus?: Record<string, Record<string, number>>;    // cardCode → oppClass → bonus
  cardOnCurveBonus?: Record<string, number>;                    // cardCode → on-curve bonus
  mulliganKeepByMatchup?: Record<string, Record<string, number>>; // cardCode → oppProfile → keep score
  attackFaceThreshold?: Record<string, number>;                 // oppProfile → board advantage to go face
  heroPowerTiming?: Record<string, 'pre' | 'post' | 'always'>; // class → timing preference
  // v4 distilled fields
  attackFaceThresholdByMatchup?: Record<string, Record<string, number>>; // hero → oppHero → threshold
  cardPositionBonus?: Record<string, Record<string, number>>;   // cardCode → 'ahead'|'even'|'behind' → bonus
  cardPhaseBonus?: Record<string, Record<string, number>>;      // cardCode → 'early'|'mid'|'late' → bonus
  heroPowerTargetStrategy?: Record<string, string>;             // heroClass → targeting strategy
  comboPairs?: Record<string, Record<string, number>>;          // cardCode → partnerCode → bonus
}

let aiWeights: AIWeights | null = null;

try {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const weightsPath = path.join(__dirname, '..', 'data', 'ai-weights.json');
  if (fs.existsSync(weightsPath)) {
    aiWeights = JSON.parse(fs.readFileSync(weightsPath, 'utf-8'));
    console.log('[AI] Loaded simulation weights from ai-weights.json');
  }
} catch {
  // Weights file missing or invalid — use defaults
}

/** Reload weights from disk (used by learn mode between cycles) */
export function reloadAIWeights(): void {
  try {
    const __dir = path.dirname(fileURLToPath(import.meta.url));
    const weightsPath = path.join(__dir, '..', 'data', 'ai-weights.json');
    if (fs.existsSync(weightsPath)) {
      aiWeights = JSON.parse(fs.readFileSync(weightsPath, 'utf-8'));
      console.log('[AI] Reloaded simulation weights from ai-weights.json');
    }
  } catch {
    // Weights file missing or invalid — keep existing
  }
}

/** Get per-card win rate from simulation data */
function getCardWinRate(cardCode: string): number | null {
  const stats = aiWeights?.cardStats?.[cardCode];
  if (!stats || stats.played < 50) return null;
  return stats.winRate;
}

/** Get per-card mulligan keep win rate */
function getCardKeepWinRate(cardCode: string): number | null {
  const stats = aiWeights?.cardStats?.[cardCode];
  if (!stats || stats.played < 50) return null;
  return stats.keepWinRate;
}

/** Get card matchup bonus from distilled teacher data */
function getCardMatchupBonus(cardCode: string, oppClass: HeroClass): number {
  return aiWeights?.cardMatchupBonus?.[cardCode]?.[oppClass] ?? 0;
}

/** Get card on-curve bonus from distilled teacher data */
function getCardOnCurveBonus(cardCode: string): number {
  return aiWeights?.cardOnCurveBonus?.[cardCode] ?? 0;
}

/** Get mulligan keep score from distilled teacher data */
function getMulliganKeepScore(cardCode: string, oppProfile: string): number | null {
  const score = aiWeights?.mulliganKeepByMatchup?.[cardCode]?.[oppProfile];
  return score !== undefined ? score : null;
}

/** Get attack face threshold from distilled teacher data */
function getAttackFaceThreshold(oppProfile: string): number {
  return aiWeights?.attackFaceThreshold?.[oppProfile] ?? 3;
}

/** Get hero power timing preference from distilled teacher data */
function getHeroPowerTiming(heroClass: HeroClass): 'pre' | 'post' | 'always' | null {
  return aiWeights?.heroPowerTiming?.[heroClass] ?? null;
}

/** v4: Get per-matchup attack face threshold (hero vs oppHero), fallback to profile-based */
function getAttackFaceThresholdByMatchup(myHero: HeroClass, oppHero: HeroClass): number | null {
  const threshold = aiWeights?.attackFaceThresholdByMatchup?.[myHero]?.[oppHero];
  return threshold !== undefined ? threshold : null;
}

/** v4: Get card position bonus (ahead/even/behind) */
function getCardPositionBonus(cardCode: string, position: 'ahead' | 'even' | 'behind'): number {
  return aiWeights?.cardPositionBonus?.[cardCode]?.[position] ?? 0;
}

/** v4: Get card phase bonus (early/mid/late) */
function getCardPhaseBonus(cardCode: string, phase: 'early' | 'mid' | 'late'): number {
  return aiWeights?.cardPhaseBonus?.[cardCode]?.[phase] ?? 0;
}

/** v4: Get hero power target strategy */
function getHeroPowerTargetStrategy(heroClass: HeroClass): string | null {
  return aiWeights?.heroPowerTargetStrategy?.[heroClass] ?? null;
}

/** v4: Get combo pair bonus for playing a card when partner is in hand */
function getComboPairBonus(cardCode: string, partnerCode: string): number {
  return aiWeights?.comboPairs?.[cardCode]?.[partnerCode] ?? 0;
}

/** Get opponent's class profile from weights */
function getOpponentProfile(oppClass: HeroClass): string {
  if (aiWeights?.classProfile?.[oppClass]) return aiWeights.classProfile[oppClass];
  if (AGGRO_CLASSES.includes(oppClass)) return 'aggro';
  return 'midrange';
}

/** Get matchup-aware priority adjustment */
function matchupPriorityAdjust(myClass: HeroClass, oppClass: HeroClass, effectType: string): number {
  const oppProfile = getOpponentProfile(oppClass);

  if (oppProfile === 'aggro') {
    // vs aggro: prioritize taunt, healing, cheap removal
    if (effectType === 'TAUNT') return 10;
    if (effectType === 'RESTORE_HEALTH' || effectType === 'GAIN_ARMOR') return 5;
    if (effectType === 'DEAL_DAMAGE' || effectType === 'DEAL_DAMAGE_ALL_ENEMIES') return 5;
  } else if (oppProfile === 'control') {
    // vs control: prioritize tempo, card draw, big threats
    if (effectType === 'DRAW_CARDS') return 5;
    if (effectType === 'CHARGE') return 3;
    if (effectType === 'TEMPO') return 5;
  }

  return 0;
}

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
 * Mulligan strategy: replace expensive cards, keep cheap ones.
 * Uses simulation weights when available for matchup-aware mulligan.
 * vs aggro: keep 1-2 mana cards (cheap removal, taunts)
 * vs control: keep 3-4 mana tempo plays
 */
export function getAIMulliganReplacements(hand: CardInstance[], heroClass: HeroClass, opponentClass?: HeroClass): boolean[] {
  const oppProfile = opponentClass ? getOpponentProfile(opponentClass) : null;

  let keepThreshold: number;
  if (oppProfile === 'aggro') {
    // vs aggro: keep cheap cards to survive early game
    keepThreshold = 2;
  } else if (oppProfile === 'control') {
    // vs control: keep mid-cost tempo plays
    keepThreshold = 4;
  } else {
    // Default: aggro classes keep cheap, others keep mid
    const isAggro = AGGRO_CLASSES.includes(heroClass);
    keepThreshold = isAggro ? 2 : 3;
  }

  return hand.map(card => {
    const def = getCardDef(card.cardCode);
    // Always keep The Coin
    if (card.cardCode === 'COIN') return false;
    // vs aggro: always keep taunt minions even if expensive (up to 5 mana)
    if (oppProfile === 'aggro' && def.keywords.includes('TAUNT') && def.manaCost <= 5) return false;

    // v3 distilled mulligan: matchup-specific keep scores from teacher data
    if (oppProfile) {
      const teacherKeep = getMulliganKeepScore(card.cardCode, oppProfile);
      if (teacherKeep !== null) {
        // Teacher score is -1..+1: positive = keep, negative = replace
        if (teacherKeep >= 0.3) return false;  // teacher says keep
        if (teacherKeep <= -0.3) return true;  // teacher says replace
        // Between -0.3 and 0.3: fall through to other heuristics
      }
    }

    // Per-card ML mulligan: if we have keep win rate data, use it
    const keepWR = getCardKeepWinRate(card.cardCode);
    if (keepWR !== null) {
      // Keep cards with above-average keep win rate, replace poor performers
      if (keepWR >= 0.55) return false; // keep
      if (keepWR < 0.42) return true;  // replace
    }

    // Replace cards above the threshold
    return def.manaCost > keepThreshold;
  });
}

// ── Lethal Detection ──

/**
 * Check if we have lethal: total available damage >= opponent health.
 * Accounts for taunts — if any taunt exists, we can't go face freely.
 * Returns true if all attacks should go face.
 */
export function hasLethal(me: PlayerState, opp: PlayerState): boolean {
  const taunts = getTauntMinions(opp.board);
  const oppEffectiveHealth = opp.health + opp.armor;

  // Calculate total available damage
  let totalDamage = 0;

  // Minion attacks
  for (const minion of me.board) {
    if (!minion.canAttack || minion.attacksRemaining <= 0 || minion.isFrozen || minion.currentAttack <= 0) continue;
    const attacks = minion.attacksRemaining; // handles Windfury
    totalDamage += minion.currentAttack * attacks;
  }

  // Weapon attack
  if (me.weapon && me.weapon.currentAttack > 0) {
    totalDamage += me.weapon.currentAttack;
  }

  // Hero attack (e.g. Lucas hero power)
  if (me.heroAttackThisTurn > 0) {
    totalDamage += me.heroAttackThisTurn;
  }

  if (taunts.length > 0) {
    // Must kill all taunts first — subtract their total health from our damage budget
    let tauntHealth = 0;
    for (const t of taunts) {
      tauntHealth += t.hasDivineShield ? t.currentHealth + 1 : t.currentHealth; // rough estimate for shield
    }
    return (totalDamage - tauntHealth) >= oppEffectiveHealth;
  }

  return totalDamage >= oppEffectiveHealth;
}

/** When going for lethal, attack face unless a taunt blocks */
export function pickLethalTarget(attacker: BoardMinion, opp: PlayerState, oppIdx: 0 | 1): string {
  const taunts = getTauntMinions(opp.board);
  if (taunts.length > 0) {
    // Must kill taunt first — pick one we can kill
    const killable = taunts.filter(t => !t.hasDivineShield && t.currentHealth <= attacker.currentAttack);
    if (killable.length > 0) return killable[0].instanceId;
    // Can't kill any taunt — hit lowest health to chip it down
    return taunts.sort((a, b) => a.currentHealth - b.currentHealth)[0].instanceId;
  }
  return `hero-${oppIdx}`;
}

// ── Threat Evaluation ──

function threatScore(minion: BoardMinion): number {
  let score = minion.currentAttack * 2 + minion.currentHealth;
  if (minionHasKeyword(minion, 'TAUNT')) score += 5;
  if (minionHasKeyword(minion, 'WINDFURY')) score += minion.currentAttack;
  if (minionHasKeyword(minion, 'DIVINE_SHIELD')) score += 3;
  if (minion.hasStealthUntilAttack) score += 2;
  return score;
}

/**
 * Board advantage: positive means we're ahead, negative means behind.
 */
function boardAdvantage(me: PlayerState, opp: PlayerState): number {
  const myStrength = me.board.reduce((s, m) => s + threatScore(m), 0);
  const oppStrength = opp.board.reduce((s, m) => s + threatScore(m), 0);
  return myStrength - oppStrength;
}

// ── Schedule & Execute ──

/**
 * Schedule an AI turn. The AI evaluates board state, plays cards intelligently,
 * makes optimal trades, and uses hero power with proper timing.
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
  const oppIdx = (myIdx === 0 ? 1 : 0) as 0 | 1;

  // Build action queue: each action is a function that returns true if it did something
  const actionQueue: Array<() => boolean> = [];

  // Phase 1: Pre-attack hero power
  actionQueue.push(() => {
    const me = game.players[myIdx];
    if (!me.heroPowerUsed && me.mana >= 2) {
      return tryPreAttackHeroPower(game, aiPlayerId, myIdx, oppIdx, broadcast);
    }
    return false;
  });

  // Phase 2: Play cards (one at a time — this gets called repeatedly)
  for (let i = 0; i < 10; i++) { // max 10 card plays per turn
    actionQueue.push(() => playOneCard(game, aiPlayerId, myIdx, oppIdx, broadcast));
  }

  // Phase 3: Activate locations (one at a time)
  for (let i = 0; i < 3; i++) { // max 3 location activations per turn
    actionQueue.push(() => activateOneLocation(game, aiPlayerId, myIdx, oppIdx, broadcast));
  }

  // Phase 4: Attacks (one at a time)
  for (let i = 0; i < 8; i++) { // max 7 minions + 1 weapon
    actionQueue.push(() => attackWithOneMinion(game, aiPlayerId, myIdx, oppIdx, broadcast));
  }

  // Phase 4: Post-attack hero power
  actionQueue.push(() => {
    const me = game.players[myIdx];
    if (!me.heroPowerUsed && me.mana >= 2) {
      usePostAttackHeroPower(game, aiPlayerId, myIdx, oppIdx, broadcast);
      return true;
    }
    return false;
  });

  // Execute one action at a time with delays, skipping no-ops
  executeActionQueue(game, aiPlayerId, actionQueue, 0, broadcast);
}

/** Execute action queue: run each action, delay only when action did something */
function executeActionQueue(
  game: GameState,
  aiPlayerId: string,
  queue: Array<() => boolean>,
  index: number,
  broadcast: () => void
): void {
  if (game.winner) return;
  if (game.players[game.currentPlayerIndex]?.playerId !== aiPlayerId) return;

  if (index >= queue.length) {
    // All actions done — end turn
    setTimeout(() => {
      if (game.winner) return;
      if (game.players[game.currentPlayerIndex]?.playerId !== aiPlayerId) return;
      endTurn(game, aiPlayerId);
      broadcast();
    }, DELAYS.endTurn);
    return;
  }

  const didSomething = queue[index]();

  if (didSomething) {
    // Action happened — delay before next action so client can see it
    setTimeout(() => {
      executeActionQueue(game, aiPlayerId, queue, index + 1, broadcast);
    }, DELAYS.action);
  } else {
    // No-op — use setTimeout(0) to avoid deep recursion from many consecutive no-ops
    setTimeout(() => executeActionQueue(game, aiPlayerId, queue, index + 1, broadcast), 0);
  }
}

/**
 * Like playCardsPhase, but plays only ONE card and returns true if it played one.
 * Call repeatedly (with delays) to play all cards.
 */
function playOneCard(
  game: GameState,
  aiPlayerId: string,
  myIdx: 0 | 1,
  oppIdx: 0 | 1,
  broadcast: () => void
): boolean {
  const me = game.players[myIdx];
  const opp = game.players[oppIdx];

  // Coin logic
  const coinCard = me.hand.find(c => c.cardCode === 'COIN');
  if (coinCard) {
    const shouldUseCoin = evaluateCoinUsage(me, opp, game.turnNumber);
    if (shouldUseCoin) {
      const bestUnplayable = me.hand
        .filter(c => c.cardCode !== 'COIN')
        .filter(c => {
          const d = getCardDef(c.cardCode);
          return d.manaCost > me.mana && d.manaCost <= me.mana + 1;
        })
        .sort((a, b) => {
          const da = getCardDef(a.cardCode);
          const db = getCardDef(b.cardCode);
          return cardPlayPriority(db, me, opp) - cardPlayPriority(da, me, opp);
        })[0];
      if (bestUnplayable) {
        const coinResult = playCard(game, aiPlayerId, coinCard.instanceId);
        if (coinResult.success) { broadcast(); return true; }
      }
    }
  }

  const minionAdvantage = me.board.length - opp.board.length;
  const playableCards = me.hand
    .filter(c => {
      const def = getCardDef(c.cardCode);
      return def.manaCost <= me.mana && c.cardCode !== 'COIN';
    })
    .sort((a, b) => {
      const da = getCardDef(a.cardCode);
      const db = getCardDef(b.cardCode);
      return cardPlayPriority(db, me, opp) - cardPlayPriority(da, me, opp);
    });

  // Mana curve optimization: if best card leaves ≥2 mana unspent and we have a
  // card that fills the leftover exactly, prefer the filler card first
  if (playableCards.length >= 2) {
    const bestDef = getCardDef(playableCards[0].cardCode);
    const leftover = me.mana - bestDef.manaCost;
    if (leftover >= 2) {
      const filler = playableCards.find((c, i) => {
        if (i === 0) return false;
        const d = getCardDef(c.cardCode);
        return d.manaCost === leftover;
      });
      if (filler) {
        // Move filler to front so we play it first, then the big card next cycle
        const idx = playableCards.indexOf(filler);
        playableCards.splice(idx, 1);
        playableCards.unshift(filler);
      }
    }
  }

  for (const card of playableCards) {
    if (game.winner) break;
    const def = getCardDef(card.cardCode);
    const totalBoardSize = me.board.length + me.locations.length;
    if (def.type === 'MINION' && totalBoardSize >= 7) continue;
    if (def.type === 'LOCATION' && totalBoardSize >= 7) continue;
    if (def.type === 'MINION' && minionAdvantage >= 3) {
      const isHighValue = def.manaCost >= 4 ||
        def.keywords.includes('TAUNT') ||
        def.keywords.includes('DIVINE_SHIELD') ||
        def.battlecryEffect !== undefined ||
        (def.battlecryEffects && def.battlecryEffects.length > 0);
      if (!isHighValue) continue;
    }
    if (def.secretTrigger) {
      if (me.secrets.some(s => s.cardCode === card.cardCode)) continue;
      if (me.secrets.length >= 5) continue;
      const result = playCard(game, aiPlayerId, card.instanceId);
      if (result.success) { broadcast(); return true; }
      continue;
    }
    let targetId: string | null = null;
    if (def.type === 'MINION' && def.keywords.includes('BATTLECRY') && def.battlecryEffect) {
      targetId = pickSmartTarget(game, myIdx, def);
    } else if (def.type === 'SPELL' && def.spellEffect) {
      targetId = pickSmartTarget(game, myIdx, def);
    }
    const result = playCard(game, aiPlayerId, card.instanceId, undefined, targetId);
    if (result.success) { broadcast(); return true; }
    if (result.needsTarget && result.validTargets && result.validTargets.length > 0) {
      const retryTarget = pickTargetFromList(game, myIdx, def, result.validTargets);
      if (result.placed) {
        // Minion already on board — resolve battlecry directly
        const resolve = resolveBattlecry(game, aiPlayerId, retryTarget);
        if (resolve.success) { broadcast(); return true; }
        cancelBattlecry(game, aiPlayerId);
      } else {
        const retry = playCard(game, aiPlayerId, card.instanceId, undefined, retryTarget);
        if (retry.success) { broadcast(); return true; }
      }
    }
  }
  return false;
}

/**
 * Activate ONE location and return true if it activated.
 */
function activateOneLocation(
  game: GameState,
  aiPlayerId: string,
  myIdx: 0 | 1,
  oppIdx: 0 | 1,
  broadcast: () => void
): boolean {
  const me = game.players[myIdx];

  for (const location of me.locations) {
    if (game.winner) break;
    if (location.cooldownRemaining > 0 || location.activatedThisTurn) continue;

    const def = getCardDef(location.cardCode);
    const locEffects = def.locationEffects ?? (def.locationEffect ? [def.locationEffect] : []);
    if (locEffects.length === 0) continue;

    // Try to pick a smart target for the location effect
    let targetId: string | null = null;
    targetId = pickSmartTarget(game, myIdx, def);

    const result = activateLocation(game, aiPlayerId, location.instanceId, targetId);
    if (result.success) { broadcast(); return true; }
    if (result.needsTarget && result.validTargets && result.validTargets.length > 0) {
      const retryTarget = pickTargetFromList(game, myIdx, def, result.validTargets);
      const retry = activateLocation(game, aiPlayerId, location.instanceId, retryTarget);
      if (retry.success) { broadcast(); return true; }
    }
  }
  return false;
}

/**
 * Attack with ONE minion and return true if an attack happened.
 * Call repeatedly to attack with all minions.
 */
function attackWithOneMinion(
  game: GameState,
  aiPlayerId: string,
  myIdx: 0 | 1,
  oppIdx: 0 | 1,
  broadcast: () => void
): boolean {
  const me = game.players[myIdx];
  const opp = game.players[oppIdx];

  // Lethal check: if we can kill opponent, go all-face (respecting taunts)
  const goingLethal = hasLethal(me, opp);

  for (const minion of me.board) {
    if (game.winner) break;
    if (!minion.canAttack || minion.attacksRemaining <= 0 || minion.isFrozen || minion.currentAttack <= 0) continue;

    // If lethal detected, attack face (taunts are handled by pickSmartAttackTarget since they're mandatory)
    const targetId = goingLethal
      ? pickLethalTarget(minion, opp, oppIdx)
      : pickSmartAttackTarget(minion, me, opp, oppIdx);
    if (!targetId) continue;

    const result = attack(game, aiPlayerId, minion.instanceId, targetId);
    if (result.success) {
      broadcast();
      // Windfury second attack
      if (minion.attacksRemaining > 0 && !game.winner) {
        const target2 = pickSmartAttackTarget(minion, me, opp, oppIdx);
        if (target2) {
          attack(game, aiPlayerId, minion.instanceId, target2);
          broadcast();
        }
      }
      return true;
    }
  }

  // Weapon attack
  if (me.weapon && me.weapon.currentAttack > 0) {
    const heroTarget = pickAttackTargetForHero(me, opp, oppIdx);
    if (heroTarget) {
      const result = attack(game, aiPlayerId, `hero-${myIdx}`, heroTarget);
      if (result.success) { broadcast(); return true; }
    }
  }

  return false;
}

// ── Phase 1: Pre-attack hero power ──
// Use damage hero powers BEFORE attacks so we can set up kills

function tryPreAttackHeroPower(
  game: GameState,
  aiPlayerId: string,
  myIdx: 0 | 1,
  oppIdx: 0 | 1,
  broadcast: () => void
): boolean {
  const me = game.players[myIdx];
  const opp = game.players[oppIdx];

  // v3 distilled: if teacher data says this class should use post-attack timing, skip pre-attack
  const timingPref = getHeroPowerTiming(me.heroClass);
  if (timingPref === 'post') return false;

  // Derek: draw a card BEFORE playing cards (more options)
  if (me.heroClass === 'DEREK') {
    useHeroPower(game, aiPlayerId, null);
    broadcast();
    return true;
  }

  // Tala: buff before attacks if it enables a kill
  if (me.heroClass === 'TALA' && me.board.length > 0) {
    const opp = game.players[oppIdx];
    const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);
    // Check if buffing any friendly minion (+1/+1) enables a kill it couldn't make before
    for (const friendly of me.board) {
      if (!friendly.canAttack || friendly.attacksRemaining <= 0 || friendly.isFrozen) continue;
      const buffedAtk = friendly.currentAttack + 1;
      for (const enemy of targetable) {
        if (enemy.hasDivineShield) continue;
        if (friendly.currentAttack < enemy.currentHealth && buffedAtk >= enemy.currentHealth) {
          // Buff enables a kill — use hero power on this minion now
          useHeroPower(game, aiPlayerId, friendly.instanceId);
          broadcast();
          return true;
        }
      }
    }
    // No kill enabled — don't use pre-attack, save for post-attack
  }

  // Only use hero power pre-attack for damage classes that enable better trades
  if (me.heroClass === 'JIMMY' || me.heroClass === 'DES') {
    // Check if pinging an enemy minion would let one of our minions make a clean trade
    const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);
    if (targetable.length === 0) return false;

    // Find a minion where dealing 2 damage (Jimmy) or 2 damage (Des, now targeted) sets up a kill
    for (const enemy of targetable) {
      if (enemy.hasDivineShield) continue;
      const hpAfterPing = enemy.currentHealth - 2;
      if (hpAfterPing <= 0) {
        // Ping kills it outright — prefer exact kill over overkill
        const hpTarget = enemy.instanceId;
        useHeroPower(game, aiPlayerId, hpTarget);
        broadcast();
        return true;
      }
      // Check if any of our minions can now cleanly trade
      for (const friendly of me.board) {
        if (!friendly.canAttack || friendly.attacksRemaining <= 0 || friendly.isFrozen || friendly.currentAttack <= 0) continue;
        if (friendly.currentAttack === hpAfterPing && enemy.currentAttack < friendly.currentHealth) {
          // Perfect: ping + trade = clean kill with our minion surviving
          const hpTarget = enemy.instanceId;
          useHeroPower(game, aiPlayerId, hpTarget);
          broadcast();
          return true;
        }
      }
    }

    // No trade setup benefit; save hero power for after cards
    return false;
  }

  return false;
}

// ── Phase 2: Play cards ──

function playCardsPhase(
  game: GameState,
  aiPlayerId: string,
  myIdx: 0 | 1,
  oppIdx: 0 | 1,
  broadcast: () => void
): void {
  const me = game.players[myIdx];
  const opp = game.players[oppIdx];

  let played = true;
  while (played && !game.winner) {
    played = false;

    // ── Coin logic: save for key tempo turns ──
    const coinCard = me.hand.find(c => c.cardCode === 'COIN');
    if (coinCard) {
      const shouldUseCoin = evaluateCoinUsage(me, opp, game.turnNumber);
      if (shouldUseCoin) {
        const bestUnplayable = me.hand
          .filter(c => c.cardCode !== 'COIN')
          .filter(c => {
            const d = getCardDef(c.cardCode);
            return d.manaCost > me.mana && d.manaCost <= me.mana + 1;
          })
          .sort((a, b) => {
            const da = getCardDef(a.cardCode);
            const db = getCardDef(b.cardCode);
            return cardPlayPriority(db, me, opp) - cardPlayPriority(da, me, opp);
          })[0];
        if (bestUnplayable) {
          const coinResult = playCard(game, aiPlayerId, coinCard.instanceId);
          if (coinResult.success) {
            played = true;
            broadcast();
            continue;
          }
        }
      }
    }

    // ── Board overcommit check ──
    const minionAdvantage = me.board.length - opp.board.length;

    // Sort hand by play priority (removal first, then high-value plays)
    const playableCards = me.hand
      .filter(c => {
        const def = getCardDef(c.cardCode);
        return def.manaCost <= me.mana && c.cardCode !== 'COIN';
      })
      .sort((a, b) => {
        const da = getCardDef(a.cardCode);
        const db = getCardDef(b.cardCode);
        return cardPlayPriority(db, me, opp) - cardPlayPriority(da, me, opp);
      });

    for (const card of playableCards) {
      if (game.winner) break;
      const def = getCardDef(card.cardCode);

      // Skip if board is full and it's a minion or location
      const totalBoardSize2 = me.board.length + me.locations.length;
      if (def.type === 'MINION' && totalBoardSize2 >= 7) continue;
      if (def.type === 'LOCATION' && totalBoardSize2 >= 7) continue;

      // Board overcommit prevention: don't play low-value minions when ahead
      if (def.type === 'MINION' && minionAdvantage >= 3) {
        // Only play minions that are high-value (cost 4+ or have taunt/divine shield)
        const isHighValue = def.manaCost >= 4 ||
          def.keywords.includes('TAUNT') ||
          def.keywords.includes('DIVINE_SHIELD') ||
          def.battlecryEffect !== undefined ||
          (def.battlecryEffects && def.battlecryEffects.length > 0);
        if (!isHighValue) continue;
      }

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
        targetId = pickSmartTarget(game, myIdx, def);
      } else if (def.type === 'SPELL' && def.spellEffect) {
        targetId = pickSmartTarget(game, myIdx, def);
      }

      const result = playCard(game, aiPlayerId, card.instanceId, undefined, targetId);
      if (result.success) {
        played = true;
        broadcast();
        break; // Re-evaluate after each play
      } else if (result.needsTarget && result.validTargets && result.validTargets.length > 0) {
        const retryTarget = pickTargetFromList(game, myIdx, def, result.validTargets);
        if (result.placed) {
          const resolve = resolveBattlecry(game, aiPlayerId, retryTarget);
          if (resolve.success) {
            played = true;
            broadcast();
            break;
          }
          cancelBattlecry(game, aiPlayerId);
        } else {
          const retry = playCard(game, aiPlayerId, card.instanceId, undefined, retryTarget);
          if (retry.success) {
            played = true;
            broadcast();
            break;
          }
        }
      }
    }
  }
}

/**
 * Priority score for deciding which card to play first.
 * Higher = play first. Uses simulation weights for matchup-aware scoring.
 */
export function cardPlayPriority(def: CardDef, me: PlayerState, opp: PlayerState): number {
  let score = def.manaCost; // base: prefer expensive cards

  const oppProfile = getOpponentProfile(opp.heroClass);

  // Removal spells get high priority when opponent has threats
  const effects = def.type === 'SPELL'
    ? (def.spellEffects ?? (def.spellEffect ? [def.spellEffect] : []))
    : (def.battlecryEffects ?? (def.battlecryEffect ? [def.battlecryEffect] : []));

  for (const eff of effects) {
    if (eff.type === 'DESTROY_MINION') score += 15;
    if (eff.type === 'DEAL_DAMAGE' && opp.board.length > 0) score += 10 + matchupPriorityAdjust(me.heroClass, opp.heroClass, 'DEAL_DAMAGE');
    if (eff.type === 'DEAL_DAMAGE_ALL_ENEMIES' && opp.board.length >= 2) score += 12 + matchupPriorityAdjust(me.heroClass, opp.heroClass, 'DEAL_DAMAGE_ALL_ENEMIES');
    if (eff.type === 'DEAL_DAMAGE_ALL_MINIONS' && opp.board.length > me.board.length) score += 10;
    if (eff.type === 'FREEZE_TARGET' && opp.board.length > 0) score += 8;
    if (eff.type === 'RETURN_TO_HAND') score += 8;
    if (eff.type === 'DRAW_CARDS') score += matchupPriorityAdjust(me.heroClass, opp.heroClass, 'DRAW_CARDS');
    if (eff.type === 'RESTORE_HEALTH') score += matchupPriorityAdjust(me.heroClass, opp.heroClass, 'RESTORE_HEALTH');
    if (eff.type === 'GAIN_ARMOR') score += matchupPriorityAdjust(me.heroClass, opp.heroClass, 'GAIN_ARMOR');
  }

  // Taunt minions: base bonus when low HP, extra bonus vs aggro from weights
  if (def.keywords.includes('TAUNT')) {
    if (me.health <= 15) score += 5;
    score += matchupPriorityAdjust(me.heroClass, opp.heroClass, 'TAUNT');
  }

  // Charge minions get bonus vs control (tempo matters)
  if (def.keywords.includes('CHARGE')) {
    score += matchupPriorityAdjust(me.heroClass, opp.heroClass, 'CHARGE');
  }

  // Weapons are strong tempo plays
  if (def.type === 'WEAPON') score += 3 + matchupPriorityAdjust(me.heroClass, opp.heroClass, 'TEMPO');

  // Locations are moderate priority
  if (def.type === 'LOCATION') score += 5;

  // Per-card ML bonus: cards with high win rates get a boost
  const cardWR = getCardWinRate(def.cardCode);
  if (cardWR !== null) {
    // Scale: 50% WR = +0, 60% = +1, 70% = +2, etc. Max ±5
    score += Math.max(-5, Math.min(5, (cardWR - 0.5) * 10));
  }

  // v3 distilled bonuses from teacher AI
  // Card-matchup bonus: how well this card performs against the opponent's class
  score += getCardMatchupBonus(def.cardCode, opp.heroClass);

  // On-curve bonus: bonus when played on-curve (turn ≈ mana cost)
  const turnMana = me.maxMana; // proxy for current turn
  if (def.manaCost >= turnMana - 1 && def.manaCost <= turnMana) {
    score += getCardOnCurveBonus(def.cardCode);
  }

  // v4: Position-aware card bonus (ahead/even/behind)
  const advantage = boardAdvantage(me, opp);
  const position: 'ahead' | 'even' | 'behind' = advantage > 5 ? 'ahead' : advantage < -5 ? 'behind' : 'even';
  score += getCardPositionBonus(def.cardCode, position);

  // v4: Phase-aware card bonus (early/mid/late)
  const phase: 'early' | 'mid' | 'late' = me.maxMana <= 4 ? 'early' : me.maxMana <= 7 ? 'mid' : 'late';
  score += getCardPhaseBonus(def.cardCode, phase);

  // v4: Combo pair bonus — boost if a known combo partner is in hand
  for (const handCard of me.hand) {
    if (handCard.cardCode === def.cardCode) continue;
    const comboBonus = getComboPairBonus(def.cardCode, handCard.cardCode);
    if (comboBonus > 0) {
      score += comboBonus;
      break; // only apply best combo bonus once
    }
  }

  return score;
}

/**
 * Decide whether to use The Coin this turn.
 * Good coin usage: coin out a 2-drop on turn 1, coin out a 4-drop on turn 3.
 * Bad coin usage: coin for hero power.
 */
function evaluateCoinUsage(me: PlayerState, opp: PlayerState, turnNumber: number): boolean {
  // Coin out a 2-drop on turn 1 (tempo play)
  if (me.mana === 1) {
    const has2Drop = me.hand.some(c => {
      const d = getCardDef(c.cardCode);
      return d.manaCost === 2 && c.cardCode !== 'COIN';
    });
    if (has2Drop) return true;
  }

  // Coin out a 4-drop on turn 3
  if (me.mana === 3) {
    const has4Drop = me.hand.some(c => {
      const d = getCardDef(c.cardCode);
      return d.manaCost === 4 && c.cardCode !== 'COIN';
    });
    if (has4Drop) return true;
  }

  // Coin out a strong 6-drop on turn 5
  if (me.mana === 5) {
    const has6Drop = me.hand.some(c => {
      const d = getCardDef(c.cardCode);
      return d.manaCost === 6 && c.cardCode !== 'COIN';
    });
    if (has6Drop) return true;
  }

  // Coin to play a removal spell that clears a big threat
  const bestUnplayable = me.hand
    .filter(c => c.cardCode !== 'COIN')
    .filter(c => {
      const d = getCardDef(c.cardCode);
      return d.manaCost === me.mana + 1 && d.type === 'SPELL';
    });
  for (const card of bestUnplayable) {
    const d = getCardDef(card.cardCode);
    const effects = d.spellEffects ?? (d.spellEffect ? [d.spellEffect] : []);
    const isRemoval = effects.some(e =>
      e.type === 'DESTROY_MINION' ||
      e.type === 'DEAL_DAMAGE' ||
      e.type === 'DEAL_DAMAGE_ALL_ENEMIES'
    );
    if (isRemoval && opp.board.length > 0) return true;
  }

  // Late game: coin if it lets us play 2 cards this turn
  if (me.mana >= 5) {
    const currentPlayable = me.hand.filter(c => {
      const d = getCardDef(c.cardCode);
      return d.manaCost <= me.mana && c.cardCode !== 'COIN';
    });
    const coinPlayable = me.hand.filter(c => {
      const d = getCardDef(c.cardCode);
      return d.manaCost <= me.mana + 1 && c.cardCode !== 'COIN';
    });
    if (coinPlayable.length > currentPlayable.length) return true;
  }

  return false;
}

// ── Phase 3: Attacks with threat-aware targeting ──

function executeAIAttacks(
  game: GameState,
  aiPlayerId: string,
  myIdx: 0 | 1,
  oppIdx: 0 | 1,
  broadcast: () => void
): void {
  const me = game.players[myIdx];
  const opp = game.players[oppIdx];

  // Sort our attackers: small minions first (use them for trades), big minions go face
  const attackers = [...me.board]
    .filter(m => m.canAttack && m.attacksRemaining > 0 && !m.isFrozen && m.currentAttack > 0)
    .sort((a, b) => a.currentAttack - b.currentAttack);

  for (const minion of attackers) {
    if (game.winner) break;
    // Re-check in case board state changed
    if (minion.attacksRemaining <= 0) continue;

    const targetId = pickSmartAttackTarget(minion, me, opp, oppIdx);
    if (!targetId) continue;

    const result = attack(game, aiPlayerId, minion.instanceId, targetId);
    if (result.success) broadcast();

    // If Windfury, attack again
    if (minion.attacksRemaining > 0 && !game.winner) {
      const target2 = pickSmartAttackTarget(minion, me, opp, oppIdx);
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

/**
 * Smart attack targeting using threat scores.
 * Priority: taunts > exact kills on high-threats > favorable trades > go face.
 */
export function pickSmartAttackTarget(
  attacker: BoardMinion,
  me: PlayerState,
  opp: PlayerState,
  oppIdx: 0 | 1
): string | null {
  // Must attack taunt first
  const taunts = getTauntMinions(opp.board);
  if (taunts.length > 0) {
    return pickBestTauntTarget(attacker, taunts);
  }

  const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);

  // Look for exact kills (no overkill waste) on high-threat minions
  const exactKills = targetable
    .filter(m => !m.hasDivineShield && m.currentHealth === attacker.currentAttack)
    .sort((a, b) => threatScore(b) - threatScore(a));
  if (exactKills.length > 0) {
    // Take the exact kill if the enemy is a real threat or we survive
    const best = exactKills[0];
    if (best.currentAttack < attacker.currentHealth || threatScore(best) >= 6) {
      return best.instanceId;
    }
  }

  // Look for favorable trades: we can kill them and survive
  const favorableTrades = targetable
    .filter(m => !m.hasDivineShield && m.currentHealth <= attacker.currentAttack && m.currentAttack < attacker.currentHealth)
    .sort((a, b) => threatScore(b) - threatScore(a));
  if (favorableTrades.length > 0) {
    return favorableTrades[0].instanceId;
  }

  // Look for high-threat minions worth trading into even if we die
  // (e.g. our 2/1 kills their 5/2)
  const worthyTrades = targetable
    .filter(m => !m.hasDivineShield && m.currentHealth <= attacker.currentAttack)
    .filter(m => threatScore(m) > threatScore(attacker))
    .sort((a, b) => threatScore(b) - threatScore(a));
  if (worthyTrades.length > 0) {
    return worthyTrades[0].instanceId;
  }

  // Pop divine shields on high-threat minions with small minions
  if (attacker.currentAttack <= 2) {
    const shielded = targetable
      .filter(m => m.hasDivineShield)
      .sort((a, b) => threatScore(b) - threatScore(a));
    if (shielded.length > 0) {
      return shielded[0].instanceId;
    }
  }

  // v4: per-matchup threshold with v3 profile-based fallback
  const oppProfile = getOpponentProfile(opp.heroClass);
  const faceThreshold = getAttackFaceThresholdByMatchup(me.heroClass, opp.heroClass)
    ?? getAttackFaceThreshold(oppProfile);
  const advantage = boardAdvantage(me, opp);

  // Only go face if we have sufficient board advantage
  if (advantage < faceThreshold && targetable.length > 0) {
    // Try to chip down the highest-threat minion instead of going face
    const bestChip = targetable
      .filter(m => !m.hasDivineShield)
      .sort((a, b) => threatScore(b) - threatScore(a));
    if (bestChip.length > 0 && threatScore(bestChip[0]) >= 4) {
      return bestChip[0].instanceId;
    }
  }

  // Go face
  return `hero-${oppIdx}`;
}

function pickBestTauntTarget(attacker: BoardMinion, taunts: BoardMinion[]): string {
  // Prefer exact kills to avoid overkill waste
  const exactKills = taunts.filter(t => !t.hasDivineShield && t.currentHealth === attacker.currentAttack);
  if (exactKills.length > 0) {
    return exactKills.sort((a, b) => threatScore(b) - threatScore(a))[0].instanceId;
  }

  // Prefer killing a taunt (any kill)
  const killable = taunts.filter(t => !t.hasDivineShield && t.currentHealth <= attacker.currentAttack);
  if (killable.length > 0) {
    // Kill highest threat taunt we can
    return killable.sort((a, b) => threatScore(b) - threatScore(a))[0].instanceId;
  }

  // Pop divine shield on lowest-attack taunt
  const shielded = taunts.filter(t => t.hasDivineShield);
  if (shielded.length > 0) {
    return shielded.sort((a, b) => a.currentAttack - b.currentAttack)[0].instanceId;
  }

  // Attack into the taunt with lowest health (chip it down)
  return taunts.sort((a, b) => a.currentHealth - b.currentHealth)[0].instanceId;
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
    if (killable.length > 0) {
      return killable.sort((a, b) => threatScore(b) - threatScore(a))[0].instanceId;
    }
    return taunts.sort((a, b) => a.currentHealth - b.currentHealth)[0].instanceId;
  }

  // Kill high-threat minions if our health is comfortable
  if (me.health > 15) {
    const targetable = opp.board.filter(m => !m.hasStealthUntilAttack && !m.hasDivineShield);
    const killable = targetable
      .filter(m => m.currentHealth <= weaponAtk)
      .sort((a, b) => threatScore(b) - threatScore(a));
    if (killable.length > 0 && threatScore(killable[0]) >= 6) {
      return killable[0].instanceId;
    }
  }

  // Go face
  return `hero-${oppIdx}`;
}

// ── Phase 4: Post-attack hero power ──

function usePostAttackHeroPower(
  game: GameState,
  aiPlayerId: string,
  myIdx: 0 | 1,
  oppIdx: 0 | 1,
  broadcast: () => void
): void {
  const me = game.players[myIdx];
  const opp = game.players[oppIdx];

  let hpTarget: string | null = null;
  let shouldUse = true;

  switch (me.heroClass) {
    case 'JIMMY': {
      // v4: use distilled strategy if available
      const jimmyTarget = getDistilledHeroPowerTarget(me.heroClass, me, opp, oppIdx);
      if (jimmyTarget !== undefined) {
        hpTarget = jimmyTarget;
      } else {
        // Orra Arrow: 2 damage targeted — prefer killing a minion exactly, else hit face
        hpTarget = pickDamageHeroPowerTarget(opp, oppIdx, 2);
      }
      break;
    }

    case 'DES':
      // Orra Siphon: 2 damage to enemy hero (no targeting needed)
      hpTarget = null;
      break;

    case 'TALA': {
      // Healing Touch: Restore 2 Health to any character — prefer own damaged minions, then hero
      const damaged = me.board.filter(m => m.currentHealth < m.maxHealth);
      if (damaged.length > 0) {
        hpTarget = damaged.sort((a, b) => threatScore(b) - threatScore(a))[0].instanceId;
      } else if (me.health < me.maxHealth - 4) {
        hpTarget = `hero-${myIdx}`;
      } else {
        shouldUse = false;
      }
      break;
    }

    case 'DEREK':
      // Draw a card — always good
      hpTarget = null;
      break;

    case 'ANDERS': {
      // v4: use distilled strategy if available
      const andersTarget = getDistilledHeroPowerTarget(me.heroClass, me, opp, oppIdx);
      if (andersTarget !== undefined) {
        if (andersTarget === null) shouldUse = false;
        else hpTarget = andersTarget;
      } else {
        // Freeze + 1 damage to enemy minion — target highest threat
        if (opp.board.length > 0) {
          const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);
          if (targetable.length > 0) {
            hpTarget = targetable.sort((a, b) => b.currentAttack - a.currentAttack)[0].instanceId;
          } else {
            shouldUse = false;
          }
        } else {
          shouldUse = false;
        }
      }
      break;
    }

    case 'ASTRID': {
      // Shield Wall: give +2 Health to biggest friendly minion
      if (me.board.length > 0) {
        hpTarget = me.board.slice().sort((a, b) => threatScore(b) - threatScore(a))[0].instanceId;
      } else {
        shouldUse = false;
      }
      break;
    }

    case 'AVA':
      // Deploy Drone: summon 1/1 — use if board not full and we're not way ahead
      if (me.board.length < 7) {
        hpTarget = null;
      } else {
        shouldUse = false;
      }
      break;

    case 'LUCAS':
      // Coyote's Veil: +1 Attack and 1 Armor — always worth using
      hpTarget = null;
      break;

    case 'IZZY':
      // Chart Course: gain 2 armor — always worth using
      hpTarget = null;
      break;

    default:
      shouldUse = false;
  }

  if (!shouldUse) return;

  const noTargetNeeded = ['DEREK', 'IZZY', 'DES', 'LUCAS'].includes(me.heroClass) ||
    (me.heroClass === 'AVA' && me.board.length < 7);

  if (hpTarget !== null || noTargetNeeded) {
    useHeroPower(game, aiPlayerId, hpTarget);
    broadcast();
  }
}

/**
 * v4: Pick hero power target using distilled strategy from teacher data.
 * Returns undefined if no strategy available (fall back to hand-coded logic).
 * Returns null if strategy says don't use.
 */
function getDistilledHeroPowerTarget(
  heroClass: HeroClass,
  me: PlayerState,
  opp: PlayerState,
  oppIdx: 0 | 1
): string | null | undefined {
  const strategy = getHeroPowerTargetStrategy(heroClass);
  if (!strategy) return undefined; // no distilled data, use fallback

  const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);
  if (targetable.length === 0) {
    // Face or no use depending on hero
    if (heroClass === 'JIMMY') return `hero-${oppIdx}`;
    return null;
  }

  switch (strategy) {
    case 'exact_kill': {
      // Try to find a minion we can exactly kill
      const hpDamage = heroClass === 'JIMMY' ? 2 : heroClass === 'ANDERS' ? 1 : 2;
      const exact = targetable
        .filter(m => !m.hasDivineShield && m.currentHealth === hpDamage)
        .sort((a, b) => threatScore(b) - threatScore(a));
      if (exact.length > 0) return exact[0].instanceId;
      // Fall through to highest_threat
      return targetable.sort((a, b) => threatScore(b) - threatScore(a))[0].instanceId;
    }
    case 'highest_threat':
      return targetable.sort((a, b) => threatScore(b) - threatScore(a))[0].instanceId;
    case 'highest_attack':
      return targetable.sort((a, b) => b.currentAttack - a.currentAttack)[0].instanceId;
    case 'most_damaged': {
      const damaged = targetable.filter(m => m.currentHealth < m.maxHealth);
      if (damaged.length > 0) return damaged.sort((a, b) => (a.currentHealth / a.maxHealth) - (b.currentHealth / b.maxHealth))[0].instanceId;
      return targetable.sort((a, b) => threatScore(b) - threatScore(a))[0].instanceId;
    }
    case 'face_damage':
      return `hero-${oppIdx}`;
    default:
      return undefined; // unknown strategy, use fallback
  }
}

/**
 * Pick target for a 2-damage hero power (Jimmy Orra Arrow).
 * Prefer: exact kill on highest-threat > any kill > face.
 */
function pickDamageHeroPowerTarget(opp: PlayerState, oppIdx: 0 | 1, damage: number): string {
  const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);

  if (targetable.length > 0) {
    // Exact kills (no waste)
    const exactKills = targetable
      .filter(m => !m.hasDivineShield && m.currentHealth === damage)
      .sort((a, b) => threatScore(b) - threatScore(a));
    if (exactKills.length > 0) return exactKills[0].instanceId;

    // Any kill
    const kills = targetable
      .filter(m => !m.hasDivineShield && m.currentHealth <= damage)
      .sort((a, b) => threatScore(b) - threatScore(a));
    if (kills.length > 0) return kills[0].instanceId;

    // Chip highest-threat minion (if it's worth it)
    const highThreats = targetable
      .filter(m => !m.hasDivineShield)
      .sort((a, b) => threatScore(b) - threatScore(a));
    if (highThreats.length > 0 && threatScore(highThreats[0]) >= 8) {
      return highThreats[0].instanceId;
    }
  }

  // Go face
  return `hero-${oppIdx}`;
}

// ── Smart Targeting for Spells & Battlecries ──

export function pickSmartTarget(
  game: GameState,
  myIdx: 0 | 1,
  def: CardDef
): string | null {
  const oppIdx = (myIdx === 0 ? 1 : 0) as 0 | 1;
  const opp = game.players[oppIdx];
  const me = game.players[myIdx];

  let effects;
  if (def.type === 'SPELL') {
    effects = def.spellEffects ?? (def.spellEffect ? [def.spellEffect] : []);
  } else if (def.type === 'LOCATION') {
    effects = def.locationEffects ?? (def.locationEffect ? [def.locationEffect] : []);
  } else {
    effects = def.battlecryEffects ?? (def.battlecryEffect ? [def.battlecryEffect] : []);
  }
  const effect = effects[0];
  if (!effect) return null;

  switch (effect.type) {
    case 'DEAL_DAMAGE': {
      const dmg = effect.value ?? 0;
      const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);

      if (targetable.length > 0) {
        // Priority 1: Exact kills on highest-threat minions (no overkill waste)
        const exactKills = targetable
          .filter(m => !m.hasDivineShield && m.currentHealth === dmg)
          .sort((a, b) => threatScore(b) - threatScore(a));
        if (exactKills.length > 0) return exactKills[0].instanceId;

        // Priority 2: Any kill, sorted by threat
        const kills = targetable
          .filter(m => !m.hasDivineShield && m.currentHealth <= dmg)
          .sort((a, b) => threatScore(b) - threatScore(a));
        if (kills.length > 0) return kills[0].instanceId;

        // Priority 3: Hit highest-threat minion even if it doesn't die
        const highThreats = targetable
          .filter(m => !m.hasDivineShield)
          .sort((a, b) => threatScore(b) - threatScore(a));
        if (highThreats.length > 0 && threatScore(highThreats[0]) >= 6) {
          return highThreats[0].instanceId;
        }
      }
      // Default: go face
      return `hero-${oppIdx}`;
    }

    case 'RESTORE_HEALTH': {
      // Heal most damaged friendly minion (weighted by attack value)
      const damaged = me.board.filter(m => m.currentHealth < m.maxHealth);
      if (damaged.length > 0) {
        return damaged.sort((a, b) => {
          const aValue = a.currentAttack * (a.maxHealth - a.currentHealth);
          const bValue = b.currentAttack * (b.maxHealth - b.currentHealth);
          return bValue - aValue;
        })[0].instanceId;
      }
      return me.health < me.maxHealth ? `hero-${myIdx}` : null;
    }

    case 'BUFF_MINION': {
      // Buff a minion that can make favorable trades
      if (me.board.length === 0) return null;
      const atkBuff = effect.attackBuff ?? 0;
      const hpBuff = effect.healthBuff ?? 0;

      // Prefer minions that can attack and would get a kill with the buff
      const canAttack = me.board.filter(m => m.canAttack && m.attacksRemaining > 0 && !m.isFrozen);
      const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);

      for (const friendly of canAttack.sort((a, b) => threatScore(b) - threatScore(a))) {
        const buffedAtk = friendly.currentAttack + atkBuff;
        // Check if buffing this minion lets it kill an enemy it couldn't before
        for (const enemy of targetable) {
          if (enemy.hasDivineShield) continue;
          if (friendly.currentAttack < enemy.currentHealth && buffedAtk >= enemy.currentHealth) {
            // The buff enables a kill — great target
            return friendly.instanceId;
          }
        }
      }

      // Fallback: buff the highest-threat friendly minion (strongest gets stronger)
      return me.board.sort((a, b) => threatScore(b) - threatScore(a))[0].instanceId;
    }

    case 'DESTROY_MINION': {
      // Destroy highest-threat enemy
      const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);
      if (targetable.length === 0) return null;
      return targetable.sort((a, b) => threatScore(b) - threatScore(a))[0].instanceId;
    }

    case 'FREEZE_TARGET': {
      // Freeze highest-attack enemy (prevents most damage)
      const targetable = opp.board.filter(m => !m.hasStealthUntilAttack && !m.isFrozen);
      if (targetable.length === 0) return null;
      return targetable.sort((a, b) => b.currentAttack - a.currentAttack)[0].instanceId;
    }

    case 'RETURN_TO_HAND': {
      // Bounce highest mana-cost enemy (most tempo loss for them)
      const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);
      if (targetable.length === 0) return null;
      // Sort by threat score as proxy for value (mana cost not available on BoardMinion)
      return targetable.sort((a, b) => threatScore(b) - threatScore(a))[0].instanceId;
    }

    case 'SILENCE_TARGET': {
      // Silence enemy minion with most keywords/enchantments/buffs
      const targetable = opp.board.filter(m => !m.hasStealthUntilAttack && !m.isSilenced);
      if (targetable.length === 0) return null;
      return targetable.sort((a, b) => {
        // Prefer silencing minions with taunt (if threatening), divine shield, or big enchantments
        let aScore = a.enchantments.length * 3;
        let bScore = b.enchantments.length * 3;
        if (minionHasKeyword(a, 'TAUNT')) aScore += 4;
        if (minionHasKeyword(b, 'TAUNT')) bScore += 4;
        if (minionHasKeyword(a, 'DIVINE_SHIELD')) aScore += 3;
        if (minionHasKeyword(b, 'DIVINE_SHIELD')) bScore += 3;
        if (minionHasKeyword(a, 'WINDFURY')) aScore += 5;
        if (minionHasKeyword(b, 'WINDFURY')) bScore += 5;
        return bScore - aScore;
      })[0].instanceId;
    }

    case 'GRANT_KEYWORD': {
      // Grant keyword to best candidate
      if (me.board.length === 0) return null;
      const keyword = effect.grantKeyword;
      if (keyword === 'WINDFURY') {
        // Give windfury to highest-attack minion that can attack
        const candidates = me.board
          .filter(m => !minionHasKeyword(m, 'WINDFURY'))
          .sort((a, b) => b.currentAttack - a.currentAttack);
        return candidates.length > 0 ? candidates[0].instanceId : me.board[0].instanceId;
      }
      if (keyword === 'TAUNT') {
        // Give taunt to highest-health minion
        return me.board.sort((a, b) => b.currentHealth - a.currentHealth)[0].instanceId;
      }
      if (keyword === 'DIVINE_SHIELD') {
        // Give divine shield to highest-threat minion
        return me.board.sort((a, b) => threatScore(b) - threatScore(a))[0].instanceId;
      }
      // Default: biggest minion
      return me.board.sort((a, b) => threatScore(b) - threatScore(a))[0].instanceId;
    }

    case 'COPY_MINION': {
      // Copy the highest-threat minion on board (enemy or friendly depending on target)
      if (effect.target === 'TARGET_ENEMY_MINION') {
        const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);
        if (targetable.length === 0) return null;
        return targetable.sort((a, b) => threatScore(b) - threatScore(a))[0].instanceId;
      }
      if (effect.target === 'TARGET_FRIENDLY_MINION') {
        if (me.board.length === 0) return null;
        return me.board.sort((a, b) => threatScore(b) - threatScore(a))[0].instanceId;
      }
      // TARGET_MINION or TARGET_ANY: pick highest threat from any board
      const all = [
        ...opp.board.filter(m => !m.hasStealthUntilAttack),
        ...me.board,
      ];
      if (all.length === 0) return null;
      return all.sort((a, b) => threatScore(b) - threatScore(a))[0].instanceId;
    }

    default:
      return null;
  }
}

export function pickTargetFromList(
  game: GameState,
  myIdx: 0 | 1,
  def: CardDef,
  validTargets: string[]
): string {
  const oppIdx = (myIdx === 0 ? 1 : 0) as 0 | 1;
  const me = game.players[myIdx];
  const opp = game.players[oppIdx];

  let effects;
  if (def.type === 'SPELL') {
    effects = def.spellEffects ?? (def.spellEffect ? [def.spellEffect] : []);
  } else if (def.type === 'LOCATION') {
    effects = def.locationEffects ?? (def.locationEffect ? [def.locationEffect] : []);
  } else {
    effects = def.battlecryEffects ?? (def.battlecryEffect ? [def.battlecryEffect] : []);
  }
  const effect = effects[0];

  if (effect?.type === 'DEAL_DAMAGE' || effect?.type === 'DESTROY_MINION' || effect?.type === 'FREEZE_TARGET' || effect?.type === 'RETURN_TO_HAND' || effect?.type === 'SILENCE_TARGET') {
    // Prefer enemy targets, sorted by threat
    const enemyMinionTargets = validTargets.filter(id =>
      opp.board.some(m => m.instanceId === id)
    );
    if (enemyMinionTargets.length > 0) {
      // Sort by threat score
      return enemyMinionTargets.sort((a, b) => {
        const mA = opp.board.find(m => m.instanceId === a);
        const mB = opp.board.find(m => m.instanceId === b);
        if (!mA || !mB) return 0;

        if (effect?.type === 'DEAL_DAMAGE') {
          const dmg = effect.value ?? 0;
          // Prefer exact kills
          const aExact = mA.currentHealth === dmg ? 1 : 0;
          const bExact = mB.currentHealth === dmg ? 1 : 0;
          if (aExact !== bExact) return bExact - aExact;
          // Then prefer kills
          const aKill = mA.currentHealth <= dmg ? 1 : 0;
          const bKill = mB.currentHealth <= dmg ? 1 : 0;
          if (aKill !== bKill) return bKill - aKill;
        }

        return threatScore(mB) - threatScore(mA);
      })[0];
    }
    // Enemy hero as fallback
    const enemyHero = validTargets.find(id => id === `hero-${oppIdx}`);
    if (enemyHero) return enemyHero;
  }

  if (effect?.type === 'RESTORE_HEALTH' || effect?.type === 'BUFF_MINION' || effect?.type === 'GRANT_KEYWORD') {
    // Prefer friendly targets
    const friendlyMinionTargets = validTargets.filter(id =>
      me.board.some(m => m.instanceId === id)
    );
    if (friendlyMinionTargets.length > 0) {
      if (effect.type === 'BUFF_MINION') {
        // Prefer highest-threat friendly
        return friendlyMinionTargets.sort((a, b) => {
          const mA = me.board.find(m => m.instanceId === a);
          const mB = me.board.find(m => m.instanceId === b);
          if (!mA || !mB) return 0;
          return threatScore(mB) - threatScore(mA);
        })[0];
      }
      if (effect.type === 'RESTORE_HEALTH') {
        // Prefer most damaged
        return friendlyMinionTargets.sort((a, b) => {
          const mA = me.board.find(m => m.instanceId === a);
          const mB = me.board.find(m => m.instanceId === b);
          if (!mA || !mB) return 0;
          return (mB.maxHealth - mB.currentHealth) - (mA.maxHealth - mA.currentHealth);
        })[0];
      }
      return friendlyMinionTargets[0];
    }
    const friendlyHero = validTargets.find(id => id === `hero-${myIdx}`);
    if (friendlyHero) return friendlyHero;
  }

  return validTargets[0];
}
