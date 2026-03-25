import type { GameState, BoardMinion, PlayerState, CardDef, HeroClass, CardInstance } from '../shared/types.js';
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

const AGGRO_CLASSES: HeroClass[] = ['JIMMY', 'LUCAS', 'DES'];

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
 * Aggro classes (JIMMY, LUCAS, DES) keep only 1-2 mana cards.
 * Other classes keep 1-3 mana cards.
 */
export function getAIMulliganReplacements(hand: CardInstance[], heroClass: HeroClass): boolean[] {
  const isAggro = AGGRO_CLASSES.includes(heroClass);
  const keepThreshold = isAggro ? 2 : 3; // keep cards at or below this cost

  return hand.map(card => {
    const def = getCardDef(card.cardCode);
    // Always keep The Coin
    if (card.cardCode === 'COIN') return false;
    // Replace cards above the threshold
    return def.manaCost > keepThreshold;
  });
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

  // Phase 3: Attacks (one at a time)
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

  for (const card of playableCards) {
    if (game.winner) break;
    const def = getCardDef(card.cardCode);
    if (def.type === 'MINION' && me.board.length >= 7) continue;
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
      const retry = playCard(game, aiPlayerId, card.instanceId, undefined, retryTarget);
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

  for (const minion of me.board) {
    if (game.winner) break;
    if (!minion.canAttack || minion.attacksRemaining <= 0 || minion.isFrozen || minion.currentAttack <= 0) continue;

    const targetId = pickSmartAttackTarget(minion, me, opp, oppIdx);
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

      // Skip if board is full and it's a minion
      if (def.type === 'MINION' && me.board.length >= 7) continue;

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

/**
 * Priority score for deciding which card to play first.
 * Higher = play first.
 */
function cardPlayPriority(def: CardDef, me: PlayerState, opp: PlayerState): number {
  let score = def.manaCost; // base: prefer expensive cards

  // Removal spells get high priority when opponent has threats
  const effects = def.type === 'SPELL'
    ? (def.spellEffects ?? (def.spellEffect ? [def.spellEffect] : []))
    : (def.battlecryEffects ?? (def.battlecryEffect ? [def.battlecryEffect] : []));

  for (const eff of effects) {
    if (eff.type === 'DESTROY_MINION') score += 15;
    if (eff.type === 'DEAL_DAMAGE' && opp.board.length > 0) score += 10;
    if (eff.type === 'DEAL_DAMAGE_ALL_ENEMIES' && opp.board.length >= 2) score += 12;
    if (eff.type === 'DEAL_DAMAGE_ALL_MINIONS' && opp.board.length > me.board.length) score += 10;
    if (eff.type === 'FREEZE_TARGET' && opp.board.length > 0) score += 8;
    if (eff.type === 'RETURN_TO_HAND') score += 8;
  }

  // Taunt minions get bonus when we're behind on health
  if (def.keywords.includes('TAUNT') && me.health <= 15) score += 5;

  // Weapons are strong tempo plays
  if (def.type === 'WEAPON') score += 3;

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
function pickSmartAttackTarget(
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
    case 'JIMMY':
      // Fireblast: 2 damage targeted — prefer killing a minion exactly, else hit face
      hpTarget = pickDamageHeroPowerTarget(opp, oppIdx, 2);
      break;

    case 'DES':
      // Dark Command is now TARGETED like Jimmy — pick optimal target
      hpTarget = pickDamageHeroPowerTarget(opp, oppIdx, 2);
      break;

    case 'TALA': {
      // Heal 3 — prefer damaged friendly minions with high attack, then self if damaged
      const damaged = me.board
        .filter(m => m.currentHealth < m.maxHealth)
        .sort((a, b) => {
          // Prefer healing minions with higher attack (more value preserved)
          const aValue = a.currentAttack * (a.maxHealth - a.currentHealth);
          const bValue = b.currentAttack * (b.maxHealth - b.currentHealth);
          return bValue - aValue;
        });
      if (damaged.length > 0) {
        hpTarget = damaged[0].instanceId;
      } else if (me.health < me.maxHealth) {
        hpTarget = `hero-${myIdx}`;
      } else {
        // Full health everywhere — skip
        shouldUse = false;
      }
      break;
    }

    case 'DEREK':
      // Draw a card — always good
      hpTarget = null;
      break;

    case 'ANDERS':
      // Freeze + 1 damage to enemy minion — target highest threat
      if (opp.board.length > 0) {
        const targetable = opp.board.filter(m => !m.hasStealthUntilAttack);
        if (targetable.length > 0) {
          // Prefer freezing highest-attack minion (prevents most damage)
          hpTarget = targetable.sort((a, b) => b.currentAttack - a.currentAttack)[0].instanceId;
        } else {
          shouldUse = false;
        }
      } else {
        shouldUse = false;
      }
      break;

    case 'ASTRID': {
      // Mighty Guard: give Divine Shield to biggest friendly minion without it
      const candidates = me.board.filter(m => !m.hasDivineShield && !minionHasKeyword(m, 'DIVINE_SHIELD'));
      if (candidates.length > 0) {
        // Prefer minion with highest attack (most value to protect)
        hpTarget = candidates.sort((a, b) => threatScore(b) - threatScore(a))[0].instanceId;
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
      // Coyote Trick: random bounce — only use if enemy has minions, prefer when they have big minions
      if (opp.board.length > 0) {
        // Worth using if opponent has minions with high mana cost / threat
        const highestThreat = Math.max(...opp.board.map(m => threatScore(m)));
        if (highestThreat >= 5) {
          hpTarget = null;
        } else {
          // Low-value targets: still use if we have mana to spare
          hpTarget = null;
        }
      } else {
        shouldUse = false;
      }
      break;

    case 'IZZY':
      // Chart Course: gain 2 armor (draws a card at 5+ armor)
      // Use aggressively to build toward card draw threshold
      if (me.armor >= 3) {
        // At 3+ armor, next use hits 5+ and draws a card — high priority
        hpTarget = null;
      } else {
        // Building armor; still worth using for the armor + eventual draw
        hpTarget = null;
      }
      break;

    default:
      shouldUse = false;
  }

  if (!shouldUse) return;

  const noTargetNeeded = ['DEREK', 'IZZY'].includes(me.heroClass) ||
    (me.heroClass === 'AVA' && me.board.length < 7) ||
    (me.heroClass === 'LUCAS' && opp.board.length > 0);

  if (hpTarget !== null || noTargetNeeded) {
    useHeroPower(game, aiPlayerId, hpTarget);
    broadcast();
  }
}

/**
 * Pick target for a 2-damage hero power (Jimmy Fireblast, Des Dark Command).
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

function pickSmartTarget(
  game: GameState,
  myIdx: 0 | 1,
  def: CardDef
): string | null {
  const oppIdx = (myIdx === 0 ? 1 : 0) as 0 | 1;
  const opp = game.players[oppIdx];
  const me = game.players[myIdx];

  const effects = def.type === 'SPELL'
    ? (def.spellEffects ?? (def.spellEffect ? [def.spellEffect] : []))
    : (def.battlecryEffects ?? (def.battlecryEffect ? [def.battlecryEffect] : []));
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

function pickTargetFromList(
  game: GameState,
  myIdx: 0 | 1,
  def: CardDef,
  validTargets: string[]
): string {
  const oppIdx = (myIdx === 0 ? 1 : 0) as 0 | 1;
  const me = game.players[myIdx];
  const opp = game.players[oppIdx];

  const effects = def.type === 'SPELL'
    ? (def.spellEffects ?? (def.spellEffect ? [def.spellEffect] : []))
    : (def.battlecryEffects ?? (def.battlecryEffect ? [def.battlecryEffect] : []));
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
