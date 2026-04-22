/**
 * GameState object pool for the AI lookahead loop.
 *
 * Why this exists
 * ───────────────
 * `cloneGame` in ai-teacher.ts is called 30-50× per AI turn and up to
 * ~512× per game in mulligan evaluation (256 keep-masks × 2 rollouts).
 * Each clone allocates ~12 fresh arrays (2 hands, 2 boards, 2 decks,
 * 2 graveyards, 2 secret lists, 2 location lists) plus all the inner
 * shallow object copies. At ~3-4 KB per clone × 50 clones/turn × 100
 * turns/game × 18 sim workers, the GC eats a measurable fraction of
 * sim time.
 *
 * The pool reuses pre-allocated GameState shells (and the array
 * references inside them) across consecutive `acquire`/`release` pairs.
 * The inner objects (CardInstance, BoardMinion, Enchantment) are still
 * shallow-cloned per element, but the OUTER container arrays are
 * cleared in place via `arr.length = 0; arr.push(...)` so they don't
 * trigger fresh allocations.
 *
 * Behind a feature flag
 * ─────────────────────
 * Off by default. Enable with `AI_CLONE_POOL=1`. The risk profile is
 * "subtle state-leak bugs hide as flaky tests" — the pool is the
 * highest-risk piece of perf code in the engine. The flag lets us
 * A/B test in production without changing behavior for everyone.
 *
 * Usage
 * ─────
 *   import { gameStatePool, AI_CLONE_POOL_ENABLED } from './ai-state-pool.js';
 *
 *   const sim = AI_CLONE_POOL_ENABLED ? gameStatePool.acquire(game) : cloneGame(game);
 *   try {
 *     // ...mutate sim...
 *   } finally {
 *     if (AI_CLONE_POOL_ENABLED) gameStatePool.release(sim);
 *   }
 */

import type {
  GameState, PlayerState, BoardMinion, CardInstance, PlayerStats,
} from '../shared/types.js';

export const AI_CLONE_POOL_ENABLED = process.env.AI_CLONE_POOL === '1';

/**
 * Build an empty GameState shell with all the inner arrays
 * pre-allocated. Used when the pool is empty and we need to seed a
 * new shell to acquire into.
 */
function emptyGameState(): GameState {
  const emptyStats = (): PlayerStats => ({
    minionsPlayed: 0, spellsCast: 0, weaponsEquipped: 0, locationsPlayed: 0,
    heroPowerUses: 0, minionsKilled: 0, damageDealtToHeroes: 0,
    damageDealtToMinions: 0, healingDone: 0, cardsDrawn: 0,
    cardsDrawnFromEffects: 0, turnsPlayed: 0, manaSpent: 0,
  });
  const emptyPlayer = (): PlayerState => ({
    playerId: '', playerName: '', heroClass: 'JIMMY',
    health: 0, maxHealth: 0, armor: 0, mana: 0, maxMana: 0,
    hand: [], board: [], weapon: null, locations: [],
    heroPowerUsed: false, heroAttackThisTurn: 0, heroAttacksRemaining: 1,
    fatigueDamage: 0, graveyard: [], secrets: [],
    heroPowerUpgraded: false, upgradeProgress: 0, spellDiscount: 0,
  });
  return {
    players: [emptyPlayer(), emptyPlayer()],
    decks: [[], []],
    currentPlayerIndex: 0,
    turnNumber: 0,
    phase: 'PLAYING',
    mulliganChoices: [null, null],
    mulliganConfirmed: [false, false],
    winner: null,
    winReason: null,
    lastAction: null,
    log: [],
    turnStartedAt: null,
    playerStats: [emptyStats(), emptyStats()],
    pendingInteraction: null,
    cardsPlayedThisTurn: 0,
  };
}

/**
 * Copy `src` into `dst`, reusing dst's outer arrays in place. Mirrors
 * the structure of `cloneGame` in ai-teacher.ts and MUST stay in sync
 * with any future fields added to GameState. The unit tests in
 * server/__tests__ exercise the round-trip (clone → mutate → release →
 * acquire on the SAME shell → verify) which catches missed fields.
 */
export function copyGameStateInto(src: GameState, dst: GameState): void {
  copyPlayerInto(src.players[0], dst.players[0]);
  copyPlayerInto(src.players[1], dst.players[1]);
  copyCardInstanceArrayInto(src.decks[0], dst.decks[0]);
  copyCardInstanceArrayInto(src.decks[1], dst.decks[1]);
  dst.currentPlayerIndex = src.currentPlayerIndex;
  dst.turnNumber = src.turnNumber;
  dst.phase = src.phase;
  // mulliganChoices: nullable boolean[] tuples. Reuse the slot if both
  // sides are non-null; otherwise overwrite the slot with a fresh ref.
  dst.mulliganChoices[0] = src.mulliganChoices[0] ? src.mulliganChoices[0].slice() : null;
  dst.mulliganChoices[1] = src.mulliganChoices[1] ? src.mulliganChoices[1].slice() : null;
  dst.mulliganConfirmed[0] = src.mulliganConfirmed[0];
  dst.mulliganConfirmed[1] = src.mulliganConfirmed[1];
  dst.winner = src.winner;
  dst.winReason = src.winReason;
  dst.lastAction = src.lastAction;
  // Drop the log — matches cloneGame() behavior. The AI evaluator
  // never reads the log so there's no point copying it.
  dst.log.length = 0;
  dst.turnStartedAt = src.turnStartedAt;
  copyStatsInto(src.playerStats[0], dst.playerStats[0]);
  copyStatsInto(src.playerStats[1], dst.playerStats[1]);
  // pendingInteraction is a UI signal that the AI sim doesn't honor —
  // null it out same as cloneGame.
  dst.pendingInteraction = null;
  dst.cardsPlayedThisTurn = src.cardsPlayedThisTurn;
  dst.pendingBattlecry = src.pendingBattlecry ?? null;
}

function copyStatsInto(src: PlayerStats, dst: PlayerStats): void {
  dst.minionsPlayed = src.minionsPlayed;
  dst.spellsCast = src.spellsCast;
  dst.weaponsEquipped = src.weaponsEquipped;
  dst.locationsPlayed = src.locationsPlayed;
  dst.heroPowerUses = src.heroPowerUses;
  dst.minionsKilled = src.minionsKilled;
  dst.damageDealtToHeroes = src.damageDealtToHeroes;
  dst.damageDealtToMinions = src.damageDealtToMinions;
  dst.healingDone = src.healingDone;
  dst.cardsDrawn = src.cardsDrawn;
  dst.cardsDrawnFromEffects = src.cardsDrawnFromEffects;
  dst.turnsPlayed = src.turnsPlayed;
  dst.manaSpent = src.manaSpent;
}

function copyPlayerInto(src: PlayerState, dst: PlayerState): void {
  dst.playerId = src.playerId;
  dst.playerName = src.playerName;
  dst.heroClass = src.heroClass;
  dst.health = src.health;
  dst.maxHealth = src.maxHealth;
  dst.armor = src.armor;
  dst.mana = src.mana;
  dst.maxMana = src.maxMana;
  copyCardInstanceArrayInto(src.hand, dst.hand);
  copyMinionArrayInto(src.board, dst.board);
  // weapon is a small object — shallow clone is fine
  dst.weapon = src.weapon ? { ...src.weapon } : null;
  // locations: shallow clone each location
  dst.locations.length = 0;
  for (const l of src.locations) dst.locations.push({ ...l });
  dst.heroPowerUsed = src.heroPowerUsed;
  dst.heroAttackThisTurn = src.heroAttackThisTurn;
  dst.heroAttacksRemaining = src.heroAttacksRemaining ?? 1;
  dst.fatigueDamage = src.fatigueDamage;
  copyCardInstanceArrayInto(src.graveyard, dst.graveyard);
  // secrets: shallow clone each secret
  dst.secrets.length = 0;
  for (const s of src.secrets) dst.secrets.push({ ...s });
  dst.heroPowerUpgraded = src.heroPowerUpgraded;
  dst.upgradeProgress = src.upgradeProgress;
  dst.spellDiscount = src.spellDiscount ?? 0;
}

/**
 * In-place copy of a CardInstance[] reusing dst's existing array. The
 * inner objects are still shallow-cloned per element so the AI sim
 * can mutate sim cards without aliasing the source.
 */
function copyCardInstanceArrayInto(src: CardInstance[], dst: CardInstance[]): void {
  dst.length = 0;
  for (let i = 0; i < src.length; i++) {
    dst.push({ ...src[i] });
  }
}

/**
 * In-place copy of a BoardMinion[]. Each minion is deep-cloned via
 * the same logic as cloneMinion() in ai-teacher.ts — enchantments
 * array reused per minion.
 */
function copyMinionArrayInto(src: BoardMinion[], dst: BoardMinion[]): void {
  dst.length = 0;
  for (let i = 0; i < src.length; i++) {
    const m = src[i];
    dst.push({
      instanceId: m.instanceId,
      cardCode: m.cardCode,
      currentAttack: m.currentAttack,
      currentHealth: m.currentHealth,
      maxHealth: m.maxHealth,
      canAttack: m.canAttack,
      attacksRemaining: m.attacksRemaining,
      hasDivineShield: m.hasDivineShield,
      isFrozen: m.isFrozen,
      isSilenced: m.isSilenced,
      hasStealthUntilAttack: m.hasStealthUntilAttack,
      enchantments: m.enchantments.map(e => ({
        ...e,
        addedKeywords: e.addedKeywords ? [...e.addedKeywords] : undefined,
      })),
    });
  }
}

/**
 * Frame-based GameState pool. Why frames vs explicit release:
 *
 * The AI lookahead code clones game state inside try/catch blocks
 * with no natural "release" point — the clones go out of scope when
 * the function returns. Adding explicit `release(sim)` calls to every
 * clone site would touch ~6 functions and require careful handling
 * of try/finally to avoid leaking on the catch path.
 *
 * Frames sidestep this: each AI evaluation function calls
 * `pushFrame()` at the top and `popFrame()` in a finally. Any clones
 * allocated between are tracked in the frame and recycled in bulk
 * when the frame is popped. The clone-site code stays nearly
 * unchanged: it just calls `acquireCloneScoped(game)` instead of
 * `cloneGame(game)`.
 *
 * Nested frames work like a stack — popFrame returns the most-recent
 * frame's clones. If popFrame is called without a matching push (bug),
 * we silently no-op rather than crash.
 */
class GameStatePool {
  private freeList: GameState[] = [];
  private frames: GameState[][] = [];
  // Diagnostics
  private acquires = 0;
  private hits = 0; // acquires that found a recycled state
  private maxFreeList = 0;

  pushFrame(): void {
    this.frames.push([]);
  }

  popFrame(): void {
    const frame = this.frames.pop();
    if (!frame) return;
    for (const g of frame) {
      this.freeList.push(g);
    }
    if (this.freeList.length > this.maxFreeList) {
      this.maxFreeList = this.freeList.length;
    }
  }

  /**
   * Acquire a recycled or fresh GameState, copy `source` into it, and
   * register it with the current frame so popFrame() will recycle it.
   * If no frame is open, the clone is allocated but won't be reused
   * (it falls out of scope on next GC). This makes the pool a no-op
   * for callers that haven't opted in via pushFrame.
   */
  acquireCloneScoped(source: GameState): GameState {
    this.acquires++;
    let target = this.freeList.pop();
    if (target) {
      this.hits++;
    } else {
      target = emptyGameState();
    }
    copyGameStateInto(source, target);
    if (this.frames.length > 0) {
      this.frames[this.frames.length - 1].push(target);
    }
    return target;
  }

  stats(): { acquires: number; hits: number; hitRate: number; maxFreeList: number; currentFree: number; openFrames: number } {
    return {
      acquires: this.acquires,
      hits: this.hits,
      hitRate: this.acquires > 0 ? this.hits / this.acquires : 0,
      maxFreeList: this.maxFreeList,
      currentFree: this.freeList.length,
      openFrames: this.frames.length,
    };
  }

  reset(): void {
    this.freeList.length = 0;
    this.frames.length = 0;
    this.acquires = 0;
    this.hits = 0;
    this.maxFreeList = 0;
  }
}

export const gameStatePool = new GameStatePool();
