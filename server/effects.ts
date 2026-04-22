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
import { minionHasKeyword } from './keywords.js';

/** Spell Damage +1 applies to these damaging effect types. */
function isDamagingEffect(effect: EffectDef): boolean {
  const t = effect.type as string;
  return (
    t === 'DEAL_DAMAGE' ||
    t === 'DEAL_DAMAGE_ALL_ENEMIES' ||
    t === 'DEAL_DAMAGE_ALL_MINIONS' ||
    t === 'DEAL_DAMAGE_RANDOM_ENEMY' ||
    t === 'DEAL_DAMAGE_ALL_CHARACTERS'
  );
}

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
  targetId?: string | null,
  opts?: { fromSpell?: boolean }
): void {
  for (const effect of effects) {
    executeEffect(game, casterIndex, effect, targetId, opts);
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

/** Execute an effect, possibly targeting a specific entity.
 * `opts.fromSpell` is set when the effect originates from a spell cast —
 * this enables the HS-classic Spell Damage +N bonus on damaging spells. */
export function executeEffect(
  game: GameState,
  casterIndex: 0 | 1,
  effect: EffectDef,
  targetId?: string | null,
  opts?: { fromSpell?: boolean }
): void {
  const me = game.players[casterIndex];
  const oppIdx = (casterIndex === 0 ? 1 : 0) as 0 | 1;
  const opp = game.players[oppIdx];
  const baseValue = effect.value ?? 0;
  // Spell Damage +1 bonus: applies to damage-dealing spell effects only.
  // Sums across all friendly minions with the SPELL_DAMAGE keyword (silence
  // already zeros the keyword via minionHasKeyword).
  const spellBonus = (opts?.fromSpell && isDamagingEffect(effect))
    ? me.board.filter(m => !m.isSilenced && minionHasKeyword(m, 'SPELL_DAMAGE')).length
    : 0;
  const value = baseValue + spellBonus;

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
      // TARGET_ENEMY_HERO = auto-target opponent hero (no targetId needed)
      if ((effect.target as string) === 'TARGET_ENEMY_HERO') {
        applyDamageToHero(opp, value);
        game.playerStats[casterIndex].damageDealtToHeroes += value;
        addLog(game, casterIndex, `Deals ${value} damage to enemy hero`, 'EFFECT');
        checkHeroDeath(game);
        break;
      }
      if (!targetId) break;
      dealDamageToTarget(game, casterIndex, targetId, value);
      break;
    }
    case 'RESTORE_HEALTH': {
      if ((effect.target as string) === 'ALL_FRIENDLY_MINIONS') {
        for (const m of me.board) {
          restoreHealthToTarget(game, casterIndex, m.instanceId, value);
        }
        if (me.board.length > 0) {
          addLog(game, casterIndex, `Restores ${value} health to all friendly minions`, 'EFFECT');
        }
        break;
      }
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
        drawCard(game, casterIndex, true);
      }
      break;
    }
    case 'SUMMON_MINION': {
      const count = effect.summonCount ?? 1;
      const code = effect.summonCardCode;
      if (!code) break;
      for (let i = 0; i < count; i++) {
        if (me.board.length >= MAX_BOARD_SIZE) break;
        const minion = createBoardMinion(code, game.turnNumber);
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
      // DES023 "Destroy Your Surroundings", DES033 The Anarchist, DES038 Vyren
      // all specify target='RANDOM_ENEMY' to pick a random enemy minion.
      // Previously silent no-op because the handler required targetId.
      if (effect.target === 'RANDOM_ENEMY') {
        const alive = opp.board.filter(m => m.currentHealth > 0);
        if (alive.length > 0) {
          const pick = alive[Math.floor(Math.random() * alive.length)];
          pick.currentHealth = 0;
          addLog(game, casterIndex, `Destroys ${getCardDef(pick.cardCode).name} (random)`, 'EFFECT');
          checkDeaths(game);
        }
        break;
      }
      if (effect.target === 'RANDOM_FRIENDLY') {
        const alive = me.board.filter(m => m.currentHealth > 0);
        if (alive.length > 0) {
          const pick = alive[Math.floor(Math.random() * alive.length)];
          pick.currentHealth = 0;
          addLog(game, casterIndex, `Destroys ${getCardDef(pick.cardCode).name} (random friendly)`, 'EFFECT');
          checkDeaths(game);
        }
        break;
      }
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
        let frozenCount = 0;
        for (const m of opp.board) {
          m.isFrozen = true;
          frozenCount++;
        }
        // Track for Anders upgrade
        if (me.heroClass === 'ANDERS') me.upgradeProgress += frozenCount;
        if (opp.board.length > 0) {
          addLog(game, casterIndex, `Freezes all enemy minions`, 'EFFECT');
        }
        break;
      }
      if (effect.target === 'ALL_MINIONS') {
        let frozenCount = 0;
        for (const m of [...me.board, ...opp.board]) {
          m.isFrozen = true;
          frozenCount++;
        }
        if (me.heroClass === 'ANDERS') me.upgradeProgress += frozenCount;
        addLog(game, casterIndex, `Freezes all minions`, 'EFFECT');
        break;
      }
      if (!targetId) break;
      const target = findMinion(game, targetId);
      if (target) {
        target.isFrozen = true;
        if (me.heroClass === 'ANDERS') me.upgradeProgress++;
        addLog(game, casterIndex, `Freezes a minion`, 'EFFECT');
      }
      break;
    }
    case 'SILENCE_TARGET': {
      // AVA029 Nullification Field and any other "silence all enemy
      // minions" spell passes target='ALL_ENEMY_MINIONS'; the single-
      // target path (findMinion(targetId)) silently no-ops on those
      // because there's no per-minion targetId. Branch on the target.
      if (effect.target === 'ALL_ENEMY_MINIONS') {
        const opp = game.players[(casterIndex === 0 ? 1 : 0) as 0 | 1];
        let count = 0;
        for (const m of opp.board) {
          if (!m.isSilenced) { silenceMinion(m); count++; }
        }
        if (count > 0) addLog(game, casterIndex, `Silences ${count} enemy minion${count === 1 ? '' : 's'}`, 'EFFECT');
      } else if (effect.target === 'ALL_FRIENDLY_MINIONS') {
        const me = game.players[casterIndex];
        let count = 0;
        for (const m of me.board) {
          if (!m.isSilenced) { silenceMinion(m); count++; }
        }
        if (count > 0) addLog(game, casterIndex, `Silences ${count} friendly minion${count === 1 ? '' : 's'}`, 'EFFECT');
      } else {
        if (!targetId) break;
        const target = findMinion(game, targetId);
        if (target) {
          silenceMinion(target);
          addLog(game, casterIndex, `Silences a minion`, 'EFFECT');
        }
      }
      break;
    }
    case 'GAIN_ARMOR': {
      me.armor += value;
      // Track for Izzy upgrade
      if (me.heroClass === 'IZZY') me.upgradeProgress += value;
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
          // Track for Lucas upgrade: returning enemy minions
          if (pi !== casterIndex && me.heroClass === 'LUCAS') me.upgradeProgress++;
          if (p.hand.length < MAX_HAND_SIZE) {
            p.hand.push({ instanceId: minion.instanceId, cardCode: minion.cardCode });
            addLog(game, casterIndex, `Returns a minion to hand`, 'EFFECT');
          } else {
            const def = getCardDef(minion.cardCode);
            p.graveyard.push({ instanceId: minion.instanceId, cardCode: minion.cardCode });
            addLog(game, casterIndex, `Hand full! ${def.name} is burned`, 'EFFECT');
          }
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
    case 'SPELL_DISCOUNT': {
      me.spellDiscount = (me.spellDiscount ?? 0) + value;
      addLog(game, casterIndex, `Next spell costs ${value} less`, 'EFFECT');
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
        if (effect.grantKeyword === 'STEALTH') {
          target.hasStealthUntilAttack = true;
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
    case 'SWAP_ATTACK_HEALTH': {
      if (!targetId) break;
      const target = findMinion(game, targetId);
      if (target) {
        const oldAtk = target.currentAttack;
        const oldHp = target.currentHealth;
        target.currentAttack = oldHp;
        target.currentHealth = oldAtk;
        target.maxHealth = oldAtk;
        addLog(game, casterIndex, `Swaps a minion's Attack and Health (${oldAtk}/${oldHp} → ${target.currentAttack}/${target.currentHealth})`, 'EFFECT');
        checkDeaths(game);
      }
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
        drawCard(game, casterIndex, true);
      }
      break;
    }
    case 'DESTROY_ALL_ENEMY_MINIONS': {
      for (const m of [...opp.board]) {
        m.currentHealth = 0;
      }
      addLog(game, casterIndex, 'Destroys all enemy minions', 'EFFECT');
      checkDeaths(game);
      break;
    }
    case 'FREEZE_ALL_ENEMIES': {
      for (const m of opp.board) {
        m.isFrozen = true;
      }
      addLog(game, casterIndex, 'Freezes all enemy minions', 'EFFECT');
      break;
    }
    case 'GIVE_DIVINE_SHIELD': {
      // Targets a friendly minion
      if (targetId) {
        const target = me.board.find(m => m.instanceId === targetId);
        if (target) {
          target.hasDivineShield = true;
          addLog(game, casterIndex, `Gives Divine Shield to ${getCardDef(target.cardCode).name}`, 'EFFECT');
        }
      }
      break;
    }
    case 'BUFF_ALL_FRIENDLY_MINIONS': {
      const atkBuff = effect.attackBuff ?? 0;
      const hpBuff = effect.healthBuff ?? 0;
      const grantDS = effect.grantDivineShield ?? false;
      for (const m of me.board) {
        m.currentAttack += atkBuff;
        m.maxHealth += hpBuff;
        m.currentHealth += hpBuff;
        if (grantDS) m.hasDivineShield = true;
        m.enchantments.push({ source: 'buff-all', attackMod: atkBuff, healthMod: hpBuff });
      }
      addLog(game, casterIndex, `Gives all friendly minions +${atkBuff}/+${hpBuff}${grantDS ? ' and Divine Shield' : ''}`, 'EFFECT');
      break;
    }
    case 'SUMMON_TOKENS': {
      const count = effect.count ?? 1;
      const tokenCode = effect.tokenCode;
      for (let i = 0; i < count; i++) {
        if (me.board.length >= MAX_BOARD_SIZE) break;
        if (tokenCode) {
          const token = createBoardMinion(tokenCode, game.turnNumber);
          me.board.push(token);
        }
      }
      addLog(game, casterIndex, `Summons ${count} token(s)`, 'EFFECT');
      break;
    }
    case 'RETURN_TO_HAND_SELF': {
      // Deathrattle: return the dying minion to hand (handled specially in combat death processing)
      // For now, just add a card to hand
      if (me.hand.length < MAX_HAND_SIZE) {
        const cardCode = effect.cardCode ?? '';
        if (cardCode) me.hand.push(makeInstance(cardCode));
      }
      break;
    }
    case 'BOUNCE_ENEMY_MINIONS_CONDITIONAL': {
      const maxAttack = effect.maxAttack ?? 3;
      const bounced: string[] = [];
      for (let i = opp.board.length - 1; i >= 0; i--) {
        if (opp.board[i].currentAttack <= maxAttack) {
          const m = opp.board.splice(i, 1)[0];
          if (opp.hand.length < MAX_HAND_SIZE) {
            opp.hand.push(makeInstance(m.cardCode));
          }
          bounced.push(getCardDef(m.cardCode).name);
        }
      }
      if (bounced.length > 0) {
        addLog(game, casterIndex, `Returns ${bounced.join(', ')} to opponent's hand`, 'EFFECT');
      }
      break;
    }
    case 'GAIN_ARMOR_AND_DRAW': {
      const armor = effect.armor ?? 0;
      const draw = effect.draw ?? 0;
      me.armor += armor;
      for (let i = 0; i < draw; i++) drawCard(game, casterIndex, true);
      addLog(game, casterIndex, `Gains ${armor} Armor and draws ${draw} card(s)`, 'EFFECT');
      break;
    }
    case 'HEAL_ALL_FRIENDLY_FULL': {
      me.health = me.maxHealth;
      for (const m of me.board) {
        m.currentHealth = m.maxHealth;
      }
      addLog(game, casterIndex, 'Restores all friendly characters to full Health', 'EFFECT');
      break;
    }
    case 'DEAL_DAMAGE_ALL_CHARACTERS': {
      const dmg = value;
      for (const m of [...me.board]) applyDamageToMinion(m, dmg);
      for (const m of [...opp.board]) applyDamageToMinion(m, dmg);
      applyDamageToHero(me, dmg);
      applyDamageToHero(opp, dmg);
      addLog(game, casterIndex, `Deals ${dmg} damage to ALL characters`, 'EFFECT');
      checkDeaths(game);
      break;
    }
    case 'STEAL_MINION': {
      // DES024 Elixir of Domination: take control of an enemy minion
      // with 3 or less attack. The card's text encodes the attack cap;
      // we read effect.maxAttack (defaulting to the single targeted
      // case if a specific minion was targeted).
      if (!targetId) break;
      const maxAttack = effect.maxAttack ?? Infinity;
      const idx = opp.board.findIndex(m => m.instanceId === targetId);
      if (idx < 0) break;
      const minion = opp.board[idx];
      if (minion.currentAttack > maxAttack) break;
      if (me.board.length >= MAX_BOARD_SIZE) break;
      opp.board.splice(idx, 1);
      // Summoning sickness on change of side
      minion.canAttack = false;
      minion.attacksRemaining = 0;
      me.board.push(minion);
      addLog(game, casterIndex, `Steals ${getCardDef(minion.cardCode).name}`, 'EFFECT');
      break;
    }
    case 'DESTROY_FROZEN_MINION': {
      // AND039 Shatter: destroy a Frozen enemy minion (single-target).
      // If no targetId, fall back to destroying a random frozen enemy
      // (some UI paths might auto-pick).
      if (targetId) {
        const target = findMinion(game, targetId);
        if (target && target.isFrozen) {
          target.currentHealth = 0;
          addLog(game, casterIndex, `Shatters a frozen minion`, 'EFFECT');
          checkDeaths(game);
        }
        break;
      }
      const frozen = opp.board.filter(m => m.isFrozen && m.currentHealth > 0);
      if (frozen.length > 0) {
        const pick = frozen[Math.floor(Math.random() * frozen.length)];
        pick.currentHealth = 0;
        addLog(game, casterIndex, `Shatters ${getCardDef(pick.cardCode).name}`, 'EFFECT');
        checkDeaths(game);
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

export function drawCard(game: GameState, playerIndex: 0 | 1, fromEffect = false): void {
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
    if (fromEffect) {
      game.playerStats[playerIndex].cardsDrawnFromEffects++;
    }
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
