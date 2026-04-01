import type { GameState, BoardMinion, PlayerState, Keyword } from '../shared/types.js';
import { MAX_BOARD_SIZE } from '../shared/types.js';
import { getCardDef } from './cards.js';
import { makeInstance } from './deck.js';
import { addLog } from './log.js';
import { minionHasKeyword, hasActiveTaunt, getTauntMinions } from './keywords.js';
import { applyDamageToMinion, applyDamageToHero, checkHeroDeath, executeEffect, findMinion } from './effects.js';
import { applySummonRules } from './keywords.js';
import { checkSecrets } from './secrets.js';
import { checkHeroPowerUpgrade } from './upgrade.js';

/** Create a BoardMinion from a card code */
export function createBoardMinion(cardCode: string): BoardMinion {
  const def = getCardDef(cardCode);
  const minion: BoardMinion = {
    instanceId: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    cardCode,
    currentAttack: def.attack,
    currentHealth: def.health,
    maxHealth: def.health,
    canAttack: false,  // summoning sickness
    attacksRemaining: 1,
    hasDivineShield: def.keywords.includes('DIVINE_SHIELD'),
    isFrozen: false,
    isSilenced: false,
    hasStealthUntilAttack: false,
    enchantments: [],
  };
  applySummonRules(minion);
  return minion;
}

/** Attack: attacker (minion or hero) attacks target (minion or hero) */
export function attack(
  game: GameState,
  playerId: string,
  attackerInstanceId: string,
  targetId: string
): { success: boolean; error?: string } {
  if (game.phase !== 'PLAYING') return { success: false, error: 'Game not in playing phase' };
  if (game.winner) return { success: false, error: 'Game is over' };

  const myIdx = game.players.findIndex(p => p.playerId === playerId);
  if (myIdx === -1) return { success: false, error: 'Player not in game' };
  if (myIdx !== game.currentPlayerIndex) return { success: false, error: 'Not your turn' };

  const me = game.players[myIdx] as PlayerState;
  const oppIdx = (myIdx === 0 ? 1 : 0) as 0 | 1;
  const opp = game.players[oppIdx];

  // Determine if attacker is hero or minion
  const isHeroAttack = attackerInstanceId === `hero-${myIdx}`;
  let attackerMinion: BoardMinion | null = null;

  if (isHeroAttack) {
    const heroAtk = (me.weapon?.currentAttack ?? 0) + (me.heroAttackThisTurn ?? 0);
    if (heroAtk <= 0) return { success: false, error: 'No weapon equipped' };
    if ((me.heroAttacksRemaining ?? 1) <= 0) return { success: false, error: 'Hero has already attacked this turn' };
  } else {
    attackerMinion = me.board.find(m => m.instanceId === attackerInstanceId) ?? null;
    if (!attackerMinion) return { success: false, error: 'Attacker not found on your board' };
    if (!attackerMinion.canAttack) return { success: false, error: 'This minion has summoning sickness' };
    if (attackerMinion.attacksRemaining <= 0) return { success: false, error: 'This minion has no attacks remaining' };
    if (attackerMinion.isFrozen) return { success: false, error: 'This minion is frozen' };
    if (attackerMinion.currentAttack <= 0) return { success: false, error: 'This minion has 0 attack' };
  }

  // Determine target
  const isTargetHero = targetId === `hero-${oppIdx}`;
  let targetMinion: BoardMinion | null = null;

  if (!isTargetHero) {
    targetMinion = opp.board.find(m => m.instanceId === targetId) ?? null;
    if (!targetMinion) return { success: false, error: 'Target not found' };
    if (targetMinion.hasStealthUntilAttack) return { success: false, error: 'Cannot target Stealthed minion' };
  }

  // Taunt check
  if (!isTargetHero && targetMinion && !minionHasKeyword(targetMinion, 'TAUNT') && hasActiveTaunt(opp.board)) {
    return { success: false, error: 'Must attack a minion with Taunt' };
  }
  if (isTargetHero && hasActiveTaunt(opp.board)) {
    return { success: false, error: 'Must attack a minion with Taunt first' };
  }

  const attackerName = isHeroAttack
    ? me.playerName
    : getCardDef(attackerMinion!.cardCode).name;

  // ─── Check secrets before resolving attack ───
  // WHEN_HERO_ATTACKED fires first (more specific), then WHEN_ATTACKED
  if (isTargetHero) {
    checkSecrets(game, 'WHEN_HERO_ATTACKED', {
      actingPlayerIndex: myIdx as 0 | 1,
      attackerInstanceId,
      targetId,
    });
  }
  checkSecrets(game, 'WHEN_ATTACKED', {
    actingPlayerIndex: myIdx as 0 | 1,
    attackerInstanceId,
    targetId,
  });

  // Re-validate: attacker may have been bounced/killed by a secret
  if (!isHeroAttack) {
    if (!findMinion(game, attackerInstanceId)) {
      // Attacker was removed (bounced/killed by secret) — attack aborted
      return { success: true };
    }
  }
  if (!isTargetHero && targetMinion) {
    if (!findMinion(game, targetId)) {
      // Target was removed by secret — attack aborted
      return { success: true };
    }
  }

  if (isHeroAttack) {
    const totalHeroAtk = (me.weapon?.currentAttack ?? 0) + (me.heroAttackThisTurn ?? 0);

    if (isTargetHero) {
      applyDamageToHero(opp, totalHeroAtk);
      game.playerStats[myIdx as 0 | 1].damageDealtToHeroes += totalHeroAtk;
      addLog(game, myIdx as 0 | 1, `${me.playerName} attacks ${opp.playerName} for ${totalHeroAtk}`, 'COMBAT', me.weapon?.cardCode);
    } else {
      const targetDef = getCardDef(targetMinion!.cardCode);
      applyDamageToMinion(targetMinion!, totalHeroAtk);
      applyDamageToHero(me, targetMinion!.currentAttack);
      game.playerStats[myIdx as 0 | 1].damageDealtToMinions += totalHeroAtk;
      addLog(game, myIdx as 0 | 1, `${me.playerName} attacks ${targetDef.name} for ${totalHeroAtk}`, 'COMBAT', me.weapon?.cardCode);
    }

    // Consume weapon durability
    if (me.weapon) {
      me.weapon.durability--;
      if (me.weapon.durability <= 0) {
        addLog(game, myIdx as 0 | 1, `${me.playerName}'s weapon breaks!`, 'COMBAT', me.weapon!.cardCode);
        me.weapon = null;
      }
    }
    // Hero attack from hero power is one-use per turn
    me.heroAttackThisTurn = 0;
    // Decrement hero attacks remaining
    me.heroAttacksRemaining = Math.max(0, (me.heroAttacksRemaining ?? 1) - 1);
  } else {
    // Remove stealth when attacking
    if (attackerMinion!.hasStealthUntilAttack) {
      attackerMinion!.hasStealthUntilAttack = false;
    }

    if (isTargetHero) {
      applyDamageToHero(opp, attackerMinion!.currentAttack);
      game.playerStats[myIdx as 0 | 1].damageDealtToHeroes += attackerMinion!.currentAttack;
      addLog(game, myIdx as 0 | 1, `${attackerName} attacks ${opp.playerName} for ${attackerMinion!.currentAttack}`, 'COMBAT', attackerMinion!.cardCode);
    } else {
      // Minion vs Minion — both take damage
      const atkDmg = attackerMinion!.currentAttack;
      const defDmg = targetMinion!.currentAttack;

      applyDamageToMinion(targetMinion!, atkDmg);
      applyDamageToMinion(attackerMinion!, defDmg);

      game.playerStats[myIdx as 0 | 1].damageDealtToMinions += atkDmg;
      game.playerStats[oppIdx].damageDealtToMinions += defDmg;

      const targetName = getCardDef(targetMinion!.cardCode).name;
      addLog(game, myIdx as 0 | 1, `${attackerName} attacks ${targetName}`, 'COMBAT', attackerMinion!.cardCode);

      // Collar: if attacker has Collar keyword and target survived, apply Collar debuff
      if (!attackerMinion!.isSilenced && targetMinion!.currentHealth > 0) {
        const atkDef = getCardDef(attackerMinion!.cardCode);
        if (atkDef.keywords.includes('COLLAR') && !targetMinion!.isCollared) {
          targetMinion!.isCollared = true;
          targetMinion!.collarOwnerIndex = myIdx as 0 | 1;
          addLog(game, myIdx as 0 | 1, `${targetName} has been Collared!`, 'EFFECT', attackerMinion!.cardCode);
        }
      }
    }

    attackerMinion!.attacksRemaining--;
  }

  // Process deaths
  checkDeaths(game);
  checkHeroDeath(game);

  // Check hero power upgrade for both players
  // Hero power upgrades removed
  // checkHeroPowerUpgrade(game, 0);
  // checkHeroPowerUpgrade(game, 1);

  game.lastAction = `${attackerName} attacks!`;

  return { success: true };
}

/** Check all boards for dead minions, remove them, and trigger Deathrattles */
const MAX_DEATH_ITERATIONS = 100;

export function checkDeaths(game: GameState): void {
  let hadDeath = true;
  let iterations = 0;
  while (hadDeath) {
    if (++iterations > MAX_DEATH_ITERATIONS) {
      console.warn('checkDeaths: hit iteration cap — possible infinite deathrattle loop');
      break;
    }
    hadDeath = false;

    for (let pi = 0; pi < 2; pi++) {
      const player = game.players[pi];
      const dead: BoardMinion[] = [];

      for (let i = player.board.length - 1; i >= 0; i--) {
        if (player.board[i].currentHealth <= 0) {
          dead.push(player.board.splice(i, 1)[0]);
          hadDeath = true;
        }
      }

      for (const minion of dead) {
        const def = getCardDef(minion.cardCode);
        const ownerIdx = pi as 0 | 1;

        addLog(game, ownerIdx, `${def.name} dies`, 'COMBAT', minion.cardCode);
        game.playerStats[ownerIdx === 0 ? 1 : 0].minionsKilled++;

        player.graveyard.push({ instanceId: minion.instanceId, cardCode: minion.cardCode });

        if (!minion.isSilenced && def.keywords.includes('DEATHRATTLE') && def.deathrattleEffect) {
          addLog(game, ownerIdx, `${def.name}'s Deathrattle triggers!`, 'EFFECT', minion.cardCode);
          // Special: Collar Drone — collar a random enemy minion
          if (def.cardCode === 'DES_COLLAR_02') {
            const enemyIdx = (ownerIdx === 0 ? 1 : 0) as 0 | 1;
            const uncollared = game.players[enemyIdx].board.filter(m => !m.isCollared);
            if (uncollared.length > 0) {
              const target = uncollared[Math.floor(Math.random() * uncollared.length)];
              target.isCollared = true;
              target.collarOwnerIndex = ownerIdx;
              const targetDef = getCardDef(target.cardCode);
              addLog(game, ownerIdx, `${targetDef.name} has been Collared!`, 'EFFECT', minion.cardCode);
            }
          } else {
            executeEffect(game, ownerIdx, def.deathrattleEffect);
          }
        }

        // Check WHEN_FRIENDLY_MINION_DIES secrets
        checkSecrets(game, 'WHEN_FRIENDLY_MINION_DIES', {
          actingPlayerIndex: (ownerIdx === 0 ? 1 : 0) as 0 | 1,
          deadMinionCardCode: minion.cardCode,
          deadMinionOwnerIndex: ownerIdx,
        });
      }
    }
  }
}
