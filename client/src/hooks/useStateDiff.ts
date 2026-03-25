import { useRef, useEffect, useState } from 'react';
import type { ClientGameState, BoardMinion } from '../../../shared/types';

export interface FloatingNumber {
  id: string;
  targetId: string;
  amount: number;
  type: 'damage' | 'heal';
}

export interface StateDiff {
  entranceIds: Set<string>;
  deadMinions: BoardMinion[];
  floatingNumbers: FloatingNumber[];
  newCardIds: Set<string>;
  manaSpent: number;
  newlyBuffedIds: Set<string>;
  damageIds: Set<string>;
  myHeroDamaged: boolean;
  opHeroDamaged: boolean;
  myHeroDamageAmount: number;
  opHeroDamageAmount: number;
}

const EMPTY_DIFF: StateDiff = {
  entranceIds: new Set(),
  deadMinions: [],
  floatingNumbers: [],
  newCardIds: new Set(),
  manaSpent: 0,
  newlyBuffedIds: new Set(),
  damageIds: new Set(),
  myHeroDamaged: false,
  opHeroDamaged: false,
  myHeroDamageAmount: 0,
  opHeroDamageAmount: 0,
};

export function useStateDiff(gs: ClientGameState): StateDiff {
  const prevMyBoardRef = useRef<Map<string, BoardMinion>>(new Map());
  const prevOpBoardRef = useRef<Map<string, BoardMinion>>(new Map());
  const prevMyHeroHp = useRef<number | null>(null);
  const prevOpHeroHp = useRef<number | null>(null);
  const prevMyMana = useRef<number | null>(null);
  const prevHandIds = useRef<Set<string>>(new Set());
  const [diff, setDiff] = useState<StateDiff>(EMPTY_DIFF);

  const myBoard = gs.myBoard;
  const opBoard = gs.opponent.board;

  useEffect(() => {
    const prevMyBoard = prevMyBoardRef.current;
    const prevOpBoard = prevOpBoardRef.current;

    // --- Entrance: new minions on board ---
    const entranceIds = new Set<string>();
    for (const m of myBoard) {
      if (!prevMyBoard.has(m.instanceId)) entranceIds.add(m.instanceId);
    }
    for (const m of opBoard) {
      if (!prevOpBoard.has(m.instanceId)) entranceIds.add(m.instanceId);
    }

    // --- Dead minions: were on board, now gone ---
    const currentIds = new Set<string>();
    for (const m of myBoard) currentIds.add(m.instanceId);
    for (const m of opBoard) currentIds.add(m.instanceId);

    const deadMinions: BoardMinion[] = [];
    for (const [id, m] of prevMyBoard) {
      if (!currentIds.has(id)) deadMinions.push(m);
    }
    for (const [id, m] of prevOpBoard) {
      if (!currentIds.has(id)) deadMinions.push(m);
    }

    // --- Damage detection ---
    const damageIds = new Set<string>();
    const floatingNumbers: FloatingNumber[] = [];
    let counter = 0;

    for (const m of [...myBoard, ...opBoard]) {
      const prev = prevMyBoard.get(m.instanceId) ?? prevOpBoard.get(m.instanceId);
      if (prev) {
        const hpDiff = m.currentHealth - prev.currentHealth;
        if (hpDiff < 0) {
          damageIds.add(m.instanceId);
          floatingNumbers.push({
            id: `fn-${Date.now()}-${counter++}`,
            targetId: m.instanceId,
            amount: hpDiff,
            type: 'damage',
          });
        } else if (hpDiff > 0) {
          floatingNumbers.push({
            id: `fn-${Date.now()}-${counter++}`,
            targetId: m.instanceId,
            amount: hpDiff,
            type: 'heal',
          });
        }
      }
    }

    // --- Hero damage ---
    let myHeroDamaged = false;
    let opHeroDamaged = false;
    let myHeroDamageAmount = 0;
    let opHeroDamageAmount = 0;

    if (prevMyHeroHp.current !== null && gs.myHealth < prevMyHeroHp.current) {
      myHeroDamaged = true;
      myHeroDamageAmount = prevMyHeroHp.current - gs.myHealth;
      floatingNumbers.push({
        id: `fn-${Date.now()}-${counter++}`,
        targetId: `hero-${gs.myPlayerIndex}`,
        amount: -myHeroDamageAmount,
        type: 'damage',
      });
    }
    if (prevOpHeroHp.current !== null && gs.opponent.health < prevOpHeroHp.current) {
      opHeroDamaged = true;
      opHeroDamageAmount = prevOpHeroHp.current - gs.opponent.health;
      floatingNumbers.push({
        id: `fn-${Date.now()}-${counter++}`,
        targetId: `hero-${1 - gs.myPlayerIndex}`,
        amount: -opHeroDamageAmount,
        type: 'damage',
      });
    }

    // Hero heals
    if (prevMyHeroHp.current !== null && gs.myHealth > prevMyHeroHp.current) {
      floatingNumbers.push({
        id: `fn-${Date.now()}-${counter++}`,
        targetId: `hero-${gs.myPlayerIndex}`,
        amount: gs.myHealth - prevMyHeroHp.current,
        type: 'heal',
      });
    }
    if (prevOpHeroHp.current !== null && gs.opponent.health > prevOpHeroHp.current) {
      floatingNumbers.push({
        id: `fn-${Date.now()}-${counter++}`,
        targetId: `hero-${1 - gs.myPlayerIndex}`,
        amount: gs.opponent.health - prevOpHeroHp.current,
        type: 'heal',
      });
    }

    // --- Mana spent ---
    const manaSpent = prevMyMana.current !== null
      ? Math.max(0, prevMyMana.current - gs.myMana)
      : 0;

    // --- New cards in hand ---
    const newCardIds = new Set<string>();
    for (const c of gs.myHand) {
      if (!prevHandIds.current.has(c.instanceId)) {
        newCardIds.add(c.instanceId);
      }
    }

    // --- Buff detection (attack or health increased) ---
    const newlyBuffedIds = new Set<string>();
    for (const m of [...myBoard, ...opBoard]) {
      const prev = prevMyBoard.get(m.instanceId) ?? prevOpBoard.get(m.instanceId);
      if (prev) {
        if (m.currentAttack > prev.currentAttack || m.maxHealth > prev.maxHealth) {
          newlyBuffedIds.add(m.instanceId);
        }
      }
    }

    setDiff({
      entranceIds,
      deadMinions,
      floatingNumbers,
      newCardIds,
      manaSpent,
      newlyBuffedIds,
      damageIds,
      myHeroDamaged,
      opHeroDamaged,
      myHeroDamageAmount,
      opHeroDamageAmount,
    });

    // --- Update refs ---
    const newMyBoard = new Map<string, BoardMinion>();
    for (const m of myBoard) newMyBoard.set(m.instanceId, { ...m });
    prevMyBoardRef.current = newMyBoard;

    const newOpBoard = new Map<string, BoardMinion>();
    for (const m of opBoard) newOpBoard.set(m.instanceId, { ...m });
    prevOpBoardRef.current = newOpBoard;

    prevMyHeroHp.current = gs.myHealth;
    prevOpHeroHp.current = gs.opponent.health;
    prevMyMana.current = gs.myMana;
    prevHandIds.current = new Set(gs.myHand.map(c => c.instanceId));
  }, [myBoard, opBoard, gs.myHealth, gs.opponent.health, gs.myMana, gs.myHand, gs.myPlayerIndex]);

  return diff;
}
