import type {
  GameState,
  EffectDef,
  EffectTarget,
  BoardMinion,
  PlayerState,
  Keyword,
} from '../shared/types.js';
import { MAX_BOARD_SIZE, MAX_HAND_SIZE } from '../shared/types.js';
import { getCardDef } from './cards.js';
import { makeInstance } from './deck.js';
import { addLog } from './log.js';
import { createBoardMinion } from './combat.js';
import { checkDeaths } from './combat.js';

/** Resolve valid targets for an effect that requires targeting */
export function getValidTargets(
  game: GameState,
  casterIndex: 0 | 1,
  targetType: EffectTarget
): string[] {
  const me = game.players[casterIndex];
  const opp = game.players[casterIndex === 0 ? 1 : 0];
  const oppIdx = casterIndex === 0 ? 1 : 0;
  const ids: string[] = [];

  switch (targetType) {
    case 'TARGET_MINION':
      ids.push(...me.board.map(m => m.instanceId));
      ids.push(...opp.board.filter(m => !m.hasStealthUntilAttack).map(m => m.instanceId));
      break;
    case 'TARGET_ANY':
      ids.push(...me.board.map(m => m.instanceId));
      ids.push(...opp.board.filter(m => !m.hasStealthUntilAttack).map(m => m.instanceId));
      ids.push(`hero-${casterIndex}`, `hero-${oppIdx}`);
      break;
    case 'TARGET_FRIENDLY_MINION':
      ids.push(...me.board.map(m => m.instanceId));
      break;
    case 'TARGET_ENEMY_MINION':
      ids.push(...opp.board.filter(m => !m.hasStealthUntilAttack).map(m => m.instanceId));
      break;
    case 'TARGET_HERO':
      ids.push(`hero-${casterIndex}`, `hero-${oppIdx}`);
      break;
    default:
      break;
  }

  return ids;
}

/** Execute an array of effects sequentially, sharing the same target */
export function executeEffects(
  game: GameState,
  casterIndex: 0 | 1,
  effects: EffectDef[],
  targetId?: string | null
): void {
  for (const effect of effects) {
    executeEffect(game, casterIndex, effect, targetId);
  }
}

/** Check if any effect in an array needs a target selection */
export function effectsNeedTarget(effects: EffectDef[]): boolean {
  return effects.some(e => effectNeedsTarget(e));
}

/** Get the target type from the first targeting effect in an array */
export function getEffectsTargetType(effects: EffectDef[]): EffectDef['target'] {
  for (const e of effects) {
    if (effectNeedsTarget(e)) return e.target;
  }
  return 'NONE';
}

/** Check if an effect needs a target selection from the player */
export function effectNeedsTarget(effect: EffectDef): boolean {
  return [
    'TARGET_MINION',
    'TARGET_ANY',
    'TARGET_FRIENDLY_MINION',
    'TARGET_ENEMY_MINION',
  ].includes(effect.target);
}

/** Execute an effect, possibly targeting a specific entity */
export function executeEffect(
  game: GameState,
  casterIndex: 0 | 1,
  effect: EffectDef,
  targetId?: string | null
): void {
  const me = game.players[casterIndex];
  const oppIdx = (casterIndex === 0 ? 1 : 0) as 0 | 1;
  const opp = game.players[oppIdx];
  const value = effect.value ?? 0;

  // Auto-resolve TARGET_HERO: damage → opponent hero, healing → own hero
  if (effect.target === 'TARGET_HERO' && !targetId) {
    targetId = effect.type === 'DEAL_DAMAGE' ? `hero-${oppIdx}` : `hero-${casterIndex}`;
  }

  switch (effect.type) {
    case 'DEAL_DAMAGE': {
      // SELF target = deal damage to caster's own hero (for Life Tap cards)
      if (effect.target === 'SELF') {
        applyDamageToHero(me, value);
        addLog(game, casterIndex, `Takes ${value} damage`, 'EFFECT');
        checkHeroDeath(game);
        break;
      }
      if (!targetId) break;
      dealDamageToTarget(game, casterIndex, targetId, value);
      break;
    }
    case 'RESTORE_HEALTH': {
      const healTarget = targetId ?? (
        effect.target === 'TARGET_HERO' || effect.target === 'SELF'
          ? `hero-${casterIndex}`
          : null
      );
      if (!healTarget) break;
      restoreHealthToTarget(game, casterIndex, healTarget, value);
      break;
    }
    case 'DRAW_CARDS': {
      for (let i = 0; i < value; i++) {
        drawCard(game, casterIndex);
      }
      break;
    }
    case 'SUMMON_MINION': {
      const count = effect.summonCount ?? 1;
      const code = effect.summonCardCode;
      if (!code) break;
      for (let i = 0; i < count; i++) {
        if (me.board.length >= MAX_BOARD_SIZE) break;
        const minion = createBoardMinion(code);
        me.board.push(minion);
        const def = getCardDef(code);
        addLog(game, casterIndex, `Summons ${def.name}`, 'EFFECT');
      }
      break;
    }
    case 'BUFF_MINION': {
      if (!targetId) break;
      const minion = findMinion(game, targetId);
      if (minion) {
        buffMinion(minion, effect.attackBuff ?? 0, effect.healthBuff ?? 0, 'buff');
        addLog(game, casterIndex, `Buffs minion +${effect.attackBuff ?? 0}/+${effect.healthBuff ?? 0}`, 'EFFECT');
      }
      break;
    }
    case 'BUFF_ALL_FRIENDLY': {
      for (const m of me.board) {
        buffMinion(m, effect.attackBuff ?? 0, effect.healthBuff ?? 0, 'buff');
      }
      if (me.board.length > 0) {
        addLog(game, casterIndex, `Buffs all friendly minions +${effect.attackBuff ?? 0}/+${effect.healthBuff ?? 0}`, 'EFFECT');
      }
      break;
    }
    case 'BUFF_ALL_ENEMY': {
      for (const m of opp.board) {
        buffMinion(m, effect.attackBuff ?? 0, effect.healthBuff ?? 0, 'debuff');
      }
      break;
    }
    case 'DESTROY_MINION': {
      if (!targetId) break;
      const target = findMinion(game, targetId);
      if (target) {
        target.currentHealth = 0;
        addLog(game, casterIndex, `Destroys a minion`, 'EFFECT');
        checkDeaths(game);
      }
      break;
    }
    case 'FREEZE_TARGET': {
      // Handle AoE freeze targets
      if (effect.target === 'ALL_ENEMY_MINIONS') {
        for (const m of opp.board) {
          m.isFrozen = true;
        }
        if (opp.board.length > 0) {
          addLog(game, casterIndex, `Freezes all enemy minions`, 'EFFECT');
        }
        break;
      }
      if (effect.target === 'ALL_MINIONS') {
        for (const m of [...me.board, ...opp.board]) {
          m.isFrozen = true;
        }
        addLog(game, casterIndex, `Freezes all minions`, 'EFFECT');
        break;
      }
      if (!targetId) break;
      const target = findMinion(game, targetId);
      if (target) {
        target.isFrozen = true;
        addLog(game, casterIndex, `Freezes a minion`, 'EFFECT');
      }
      break;
    }
    case 'SILENCE_TARGET': {
      if (!targetId) break;
      const target = findMinion(game, targetId);
      if (target) {
        silenceMinion(target);
        addLog(game, casterIndex, `Silences a minion`, 'EFFECT');
      }
      break;
    }
    case 'GAIN_ARMOR': {
      me.armor += value;
      addLog(game, casterIndex, `Gains ${value} Armor`, 'EFFECT');
      break;
    }
    case 'DEAL_DAMAGE_ALL_ENEMIES': {
      // Damage all enemy minions (and hero too unless target is ALL_ENEMY_MINIONS)
      for (const m of [...opp.board]) {
        applyDamageToMinion(m, value);
      }
      if (effect.target !== 'ALL_ENEMY_MINIONS') {
        applyDamageToHero(opp, value);
        game.playerStats[casterIndex].damageDealtToHeroes += value;
        addLog(game, casterIndex, `Deals ${value} damage to all enemies`, 'EFFECT');
      } else {
        addLog(game, casterIndex, `Deals ${value} damage to all enemy minions`, 'EFFECT');
      }
      checkDeaths(game);
      break;
    }
    case 'DEAL_DAMAGE_ALL_MINIONS': {
      for (const m of [...me.board]) {
        applyDamageToMinion(m, value);
      }
      for (const m of [...opp.board]) {
        applyDamageToMinion(m, value);
      }
      addLog(game, casterIndex, `Deals ${value} damage to ALL minions`, 'EFFECT');
      checkDeaths(game);
      break;
    }
    case 'DEAL_DAMAGE_RANDOM_ENEMY': {
      const targets = [...opp.board.map(m => m.instanceId), `hero-${oppIdx}`];
      if (targets.length > 0) {
        for (let i = 0; i < value; i++) {
          const validTargets = [...opp.board.filter(m => m.currentHealth > 0).map(m => m.instanceId), `hero-${oppIdx}`];
          if (validTargets.length === 0) break;
          const pick = validTargets[Math.floor(Math.random() * validTargets.length)];
          dealDamageToTarget(game, casterIndex, pick, 1);
        }
      }
      break;
    }
    case 'RETURN_TO_HAND': {
      if (!targetId) break;
      // Find which player owns the minion
      for (let pi = 0; pi < 2; pi++) {
        const p = game.players[pi as 0 | 1];
        const idx = p.board.findIndex(m => m.instanceId === targetId);
        if (idx >= 0) {
          const minion = p.board.splice(idx, 1)[0];
          if (p.hand.length < MAX_HAND_SIZE) {
            p.hand.push({ instanceId: minion.instanceId, cardCode: minion.cardCode });
          }
          addLog(game, casterIndex, `Returns a minion to hand`, 'EFFECT');
          break;
        }
      }
      break;
    }
    case 'GAIN_MANA_CRYSTAL': {
      if (me.maxMana < 10) {
        me.maxMana += value;
        if (me.maxMana > 10) me.maxMana = 10;
        me.mana += value;
        if (me.mana > me.maxMana) me.mana = me.maxMana;
        addLog(game, casterIndex, `Gains ${value} Mana Crystal(s)`, 'EFFECT');
      }
      break;
    }
    case 'GAIN_TEMPORARY_MANA': {
      me.mana += value;
      // Temporary mana can exceed maxMana
      addLog(game, casterIndex, `Gains ${value} temporary mana`, 'EFFECT');
      break;
    }
    case 'GRANT_KEYWORD': {
      if (!effect.grantKeyword) break;
      // AoE grant keyword (e.g. AST020 gives all friendly minions Divine Shield)
      if (effect.target === 'ALL_FRIENDLY_MINIONS') {
        for (const m of me.board) {
          if (effect.grantKeyword === 'DIVINE_SHIELD') {
            m.hasDivineShield = true;
          }
          m.enchantments.push({
            source: 'grant-keyword',
            attackMod: 0,
            healthMod: 0,
            addedKeywords: [effect.grantKeyword],
          });
        }
        if (me.board.length > 0) {
          addLog(game, casterIndex, `Grants ${effect.grantKeyword} to all friendly minions`, 'EFFECT');
        }
        break;
      }
      // Single-target grant keyword
      if (!targetId) break;
      const target = findMinion(game, targetId);
      if (target) {
        if (effect.grantKeyword === 'DIVINE_SHIELD') {
          target.hasDivineShield = true;
        }
        target.enchantments.push({
          source: 'grant-keyword',
          attackMod: 0,
          healthMod: 0,
          addedKeywords: [effect.grantKeyword],
        });
        addLog(game, casterIndex, `Grants ${effect.grantKeyword} to a minion`, 'EFFECT');
      }
      break;
    }
    case 'COUNTER_SPELL': {
      // Handled by secrets.ts returning countered flag; no additional effect needed
      break;
    }
    case 'COPY_MINION': {
      // Handled by secrets.ts directly; no additional effect needed
      break;
    }
    case 'DEAL_DAMAGE_BASED_ON_ARMOR': {
      // Deal damage equal to caster's armor to all enemy minions
      const armorDmg = me.armor;
      if (armorDmg <= 0) break;
      for (const m of [...opp.board]) {
        applyDamageToMinion(m, armorDmg);
      }
      addLog(game, casterIndex, `Deals ${armorDmg} damage to all enemy minions (from Armor)`, 'EFFECT');
      checkDeaths(game);
      break;
    }
    case 'DRAW_CARDS_CONDITIONAL': {
      // Draw cards — more if condition is met
      let drawCount = value;
      if (effect.condition === 'HAS_DIVINE_SHIELD_MINION') {
        const hasDivineShield = me.board.some(m => m.hasDivineShield);
        if (hasDivineShield) drawCount = value + 1;
      }
      for (let i = 0; i < drawCount; i++) {
        drawCard(game, casterIndex);
      }
      break;
    }
  }
}

// ─── Helpers ───

export function findMinion(game: GameState, instanceId: string): BoardMinion | null {
  for (const p of game.players) {
    const m = p.board.find(m => m.instanceId === instanceId);
    if (m) return m;
  }
  return null;
}

export function findMinionOwnerIndex(game: GameState, instanceId: string): 0 | 1 | null {
  for (let i = 0; i < 2; i++) {
    if (game.players[i].board.some(m => m.instanceId === instanceId)) {
      return i as 0 | 1;
    }
  }
  return null;
}

function dealDamageToTarget(game: GameState, casterIndex: 0 | 1, targetId: string, amount: number): void {
  // Hero target
  if (targetId.startsWith('hero-')) {
    const heroIdx = parseInt(targetId.split('-')[1]) as 0 | 1;
    applyDamageToHero(game.players[heroIdx], amount);
    game.playerStats[casterIndex].damageDealtToHeroes += amount;
    addLog(game, casterIndex, `Deals ${amount} damage to ${game.players[heroIdx].playerName}`, 'EFFECT');
    checkHeroDeath(game);
    return;
  }
  // Minion target
  const minion = findMinion(game, targetId);
  if (!minion) return;
  applyDamageToMinion(minion, amount);
  game.playerStats[casterIndex].damageDealtToMinions += amount;
  checkDeaths(game);
}

function restoreHealthToTarget(game: GameState, casterIndex: 0 | 1, targetId: string, amount: number): void {
  if (targetId.startsWith('hero-')) {
    const heroIdx = parseInt(targetId.split('-')[1]) as 0 | 1;
    const hero = game.players[heroIdx];
    const healed = Math.min(amount, hero.maxHealth - hero.health);
    hero.health += healed;
    game.playerStats[casterIndex].healingDone += healed;
    if (healed > 0) addLog(game, casterIndex, `Restores ${healed} health to ${hero.playerName}`, 'EFFECT');
    return;
  }
  const minion = findMinion(game, targetId);
  if (!minion) return;
  const healed = Math.min(amount, minion.maxHealth - minion.currentHealth);
  minion.currentHealth += healed;
  game.playerStats[casterIndex].healingDone += healed;
}

export function applyDamageToMinion(minion: BoardMinion, amount: number): void {
  if (amount <= 0) return;
  if (minion.hasDivineShield) {
    minion.hasDivineShield = false;
    return;
  }
  minion.currentHealth -= amount;
}

export function applyDamageToHero(hero: PlayerState, amount: number): void {
  if (amount <= 0) return;
  // Armor absorbs first
  if (hero.armor > 0) {
    if (hero.armor >= amount) {
      hero.armor -= amount;
      return;
    }
    amount -= hero.armor;
    hero.armor = 0;
  }
  hero.health -= amount;
}

function buffMinion(minion: BoardMinion, atkBuff: number, hpBuff: number, _source: string): void {
  minion.currentAttack += atkBuff;
  minion.currentHealth += hpBuff;
  minion.maxHealth += hpBuff;
  minion.enchantments.push({
    source: _source,
    attackMod: atkBuff,
    healthMod: hpBuff,
  });
}

export function silenceMinion(minion: BoardMinion): void {
  minion.isSilenced = true;
  minion.hasDivineShield = false;
  minion.isFrozen = false;
  minion.hasStealthUntilAttack = false;
  // Remove enchantments and reset stats to base
  const def = getCardDef(minion.cardCode);
  minion.currentAttack = def.attack;
  minion.maxHealth = def.health;
  minion.currentHealth = Math.min(minion.currentHealth, def.health);
  minion.enchantments = [];
  minion.attacksRemaining = 1;
}

export function drawCard(game: GameState, playerIndex: 0 | 1): void {
  const player = game.players[playerIndex];
  const deck = game.decks[playerIndex];

  if (deck.length === 0) {
    // Fatigue
    player.fatigueDamage++;
    applyDamageToHero(player, player.fatigueDamage);
    addLog(game, playerIndex, `Takes ${player.fatigueDamage} fatigue damage!`, 'GAME');
    checkHeroDeath(game);
    return;
  }

  const card = deck.pop()!;
  if (player.hand.length < MAX_HAND_SIZE) {
    player.hand.push(card);
    game.playerStats[playerIndex].cardsDrawn++;
  } else {
    // Overdraw — card is burned
    player.graveyard.push(card);
    const def = getCardDef(card.cardCode);
    addLog(game, playerIndex, `Overdraw! ${def.name} is burned`, 'GAME');
  }
}

export function checkHeroDeath(game: GameState): void {
  for (let i = 0; i < 2; i++) {
    if (game.players[i].health <= 0 && !game.winner) {
      const winnerId = game.players[i === 0 ? 1 : 0].playerId;
      game.winner = winnerId;
      game.winReason = 'kill';
      const loserName = game.players[i].playerName;
      const winnerName = game.players[i === 0 ? 1 : 0].playerName;
      game.lastAction = `${loserName} has been defeated! ${winnerName} wins!`;
      addLog(game, null, game.lastAction, 'GAME');
    }
  }
}
