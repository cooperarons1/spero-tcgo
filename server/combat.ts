import type { GameState, BoardMinion, PlayerState, Keyword } from '../shared/types.js';
import { MAX_BOARD_SIZE } from '../shared/types.js';
import { getCardDef } from './cards.js';
import { makeInstance } from './deck.js';
import { addLog } from './log.js';
import { minionHasKeyword, hasActiveTaunt, getTauntMinions } from './keywords.js';
import { applyDamageToMinion, applyDamageToHero, checkHeroDeath, executeEffect } from './effects.js';
import { applySummonRules } from './keywords.js';

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
    if (!me.weapon) return { success: false, error: 'No weapon equipped' };
    if (me.weapon.currentAttack <= 0) return { success: false, error: 'Weapon has 0 attack' };
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

  if (isHeroAttack) {
    const weaponAtk = me.weapon!.currentAttack;

    if (isTargetHero) {
      applyDamageToHero(opp, weaponAtk);
      game.playerStats[myIdx as 0 | 1].damageDealtToHeroes += weaponAtk;
      addLog(game, myIdx as 0 | 1, `${me.playerName} attacks ${opp.playerName} for ${weaponAtk}`, 'COMBAT');
    } else {
      const targetDef = getCardDef(targetMinion!.cardCode);
      applyDamageToMinion(targetMinion!, weaponAtk);
      applyDamageToHero(me, targetMinion!.currentAttack);
      game.playerStats[myIdx as 0 | 1].damageDealtToMinions += weaponAtk;
      addLog(game, myIdx as 0 | 1, `${me.playerName} attacks ${targetDef.name} for ${weaponAtk}`, 'COMBAT');
    }

    me.weapon!.durability--;
    if (me.weapon!.durability <= 0) {
      addLog(game, myIdx as 0 | 1, `${me.playerName}'s weapon breaks!`, 'COMBAT');
      me.weapon = null;
    }
  } else {
    // Remove stealth when attacking
    if (attackerMinion!.hasStealthUntilAttack) {
      attackerMinion!.hasStealthUntilAttack = false;
    }

    if (isTargetHero) {
      applyDamageToHero(opp, attackerMinion!.currentAttack);
      game.playerStats[myIdx as 0 | 1].damageDealtToHeroes += attackerMinion!.currentAttack;
      addLog(game, myIdx as 0 | 1, `${attackerName} attacks ${opp.playerName} for ${attackerMinion!.currentAttack}`, 'COMBAT');
    } else {
      // Minion vs Minion — both take damage
      const atkDmg = attackerMinion!.currentAttack;
      const defDmg = targetMinion!.currentAttack;

      applyDamageToMinion(targetMinion!, atkDmg);
      applyDamageToMinion(attackerMinion!, defDmg);

      game.playerStats[myIdx as 0 | 1].damageDealtToMinions += atkDmg;
      game.playerStats[oppIdx].damageDealtToMinions += defDmg;

      const targetName = getCardDef(targetMinion!.cardCode).name;
      addLog(game, myIdx as 0 | 1, `${attackerName} attacks ${targetName}`, 'COMBAT');
    }

    attackerMinion!.attacksRemaining--;
  }

  // Process deaths
  checkDeaths(game);
  checkHeroDeath(game);

  game.lastAction = `${attackerName} attacks!`;

  return { success: true };
}

/** Check all boards for dead minions, remove them, and trigger Deathrattles */
export function checkDeaths(game: GameState): void {
  let hadDeath = true;
  while (hadDeath) {
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

        addLog(game, ownerIdx, `${def.name} dies`, 'COMBAT');
        game.playerStats[ownerIdx === 0 ? 1 : 0].minionsKilled++;

        player.graveyard.push({ instanceId: minion.instanceId, cardCode: minion.cardCode });

        if (!minion.isSilenced && def.keywords.includes('DEATHRATTLE') && def.deathrattleEffect) {
          addLog(game, ownerIdx, `${def.name}'s Deathrattle triggers!`, 'EFFECT');
          executeEffect(game, ownerIdx, def.deathrattleEffect);
        }
      }
    }
  }
}
