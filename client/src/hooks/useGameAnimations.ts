import { useRef, useEffect, useState } from 'react';
import type { ClientGameState, ClientStack, ClientCardInstance } from '../../../shared/types';

export type GameEffect =
  | { type: 'card-built'; cardInstanceId: string; stackId: string }
  | { type: 'card-drawn'; count: number }
  | { type: 'stun'; stackId: string; cardInstanceId: string }
  | { type: 'damage'; stackId: string }
  | { type: 'restore'; stackId: string; cardInstanceId: string }
  | { type: 'ap-change'; playerIndex: 0 | 1; delta: number }
  | { type: 'turn-start'; isMyTurn: boolean }
  | { type: 'combat-resolved' }
  | { type: 'mission-launched'; stackId: string }
  | { type: 'game-over'; isWin: boolean };

interface PrevSnapshot {
  myHand: string[];           // instanceIds
  oppHandCount: number;
  myStacks: Map<string, Set<string>>;   // stackId -> card instanceIds
  oppStacks: Map<string, Set<string>>;
  myStackFaceUp: Map<string, Map<string, boolean>>; // stackId -> instanceId -> faceUp
  oppStackFaceUp: Map<string, Map<string, boolean>>;
  apScores: [number, number];
  currentPlayerIndex: 0 | 1;
  combatState: boolean;
  winner: string | null;
}

function snapshotStacks(stacks: ClientStack[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const s of stacks) {
    m.set(s.stackId, new Set(s.cards.map(c => c.instanceId)));
  }
  return m;
}

function snapshotFaceUp(stacks: ClientStack[]): Map<string, Map<string, boolean>> {
  const m = new Map<string, Map<string, boolean>>();
  for (const s of stacks) {
    const fm = new Map<string, boolean>();
    for (const c of s.cards) {
      fm.set(c.instanceId, c.faceUp);
    }
    m.set(s.stackId, fm);
  }
  return m;
}

function takeSnapshot(gs: ClientGameState): PrevSnapshot {
  return {
    myHand: gs.myHand.map(c => c.instanceId),
    oppHandCount: gs.opponent.handCount,
    myStacks: snapshotStacks(gs.myStacks),
    oppStacks: snapshotStacks(gs.opponent.stacks),
    myStackFaceUp: snapshotFaceUp(gs.myStacks),
    oppStackFaceUp: snapshotFaceUp(gs.opponent.stacks),
    apScores: [...gs.apScores] as [number, number],
    currentPlayerIndex: gs.currentPlayerIndex,
    combatState: !!gs.combatState,
    winner: gs.winner,
  };
}

export function useGameAnimations(gameState: ClientGameState) {
  const prevRef = useRef<PrevSnapshot | null>(null);
  const [effects, setEffects] = useState<GameEffect[]>([]);

  useEffect(() => {
    const prev = prevRef.current;
    const next = takeSnapshot(gameState);
    prevRef.current = next;

    if (!prev) return; // First render, no diff

    const newEffects: GameEffect[] = [];

    // Detect draws: cards added to my hand
    const prevHandSet = new Set(prev.myHand);
    const newHandCards = next.myHand.filter(id => !prevHandSet.has(id));
    if (newHandCards.length > 0) {
      newEffects.push({ type: 'card-drawn', count: newHandCards.length });
    }

    // Detect builds: cards removed from hand that appear in a stack
    const nextHandSet = new Set(next.myHand);
    const removedFromHand = prev.myHand.filter(id => !nextHandSet.has(id));
    for (const cardId of removedFromHand) {
      for (const [stackId, cards] of next.myStacks) {
        if (cards.has(cardId) && (!prev.myStacks.has(stackId) || !prev.myStacks.get(stackId)!.has(cardId))) {
          newEffects.push({ type: 'card-built', cardInstanceId: cardId, stackId });
        }
      }
    }

    // Detect stuns (faceUp → false) and restores (false → true) in all stacks
    const detectFaceUpChanges = (
      prevFU: Map<string, Map<string, boolean>>,
      nextStacks: ClientStack[],
    ) => {
      for (const stack of nextStacks) {
        const prevCards = prevFU.get(stack.stackId);
        if (!prevCards) continue;
        for (const card of stack.cards) {
          const wasFaceUp = prevCards.get(card.instanceId);
          if (wasFaceUp === undefined) continue;
          if (wasFaceUp && !card.faceUp) {
            newEffects.push({ type: 'stun', stackId: stack.stackId, cardInstanceId: card.instanceId });
          }
          if (!wasFaceUp && card.faceUp) {
            newEffects.push({ type: 'restore', stackId: stack.stackId, cardInstanceId: card.instanceId });
          }
        }
      }
    };

    detectFaceUpChanges(prev.myStackFaceUp, gameState.myStacks);
    detectFaceUpChanges(prev.oppStackFaceUp, gameState.opponent.stacks);

    // Detect damage: stack lost cards (count decreased, not from stun)
    const detectDamage = (
      prevStacks: Map<string, Set<string>>,
      nextStacks: ClientStack[],
    ) => {
      for (const stack of nextStacks) {
        const prevCards = prevStacks.get(stack.stackId);
        if (!prevCards) continue;
        const nextCards = new Set(stack.cards.map(c => c.instanceId));
        const lost = [...prevCards].filter(id => !nextCards.has(id));
        if (lost.length > 0) {
          newEffects.push({ type: 'damage', stackId: stack.stackId });
        }
      }
    };

    detectDamage(prev.myStacks, gameState.myStacks);
    detectDamage(prev.oppStacks, gameState.opponent.stacks);

    // Detect AP changes
    for (const idx of [0, 1] as const) {
      const delta = next.apScores[idx] - prev.apScores[idx];
      if (delta !== 0) {
        newEffects.push({ type: 'ap-change', playerIndex: idx, delta });
      }
    }

    // Detect turn change
    if (prev.currentPlayerIndex !== next.currentPlayerIndex) {
      newEffects.push({
        type: 'turn-start',
        isMyTurn: next.currentPlayerIndex === gameState.myPlayerIndex,
      });
    }

    // Detect combat resolved
    if (prev.combatState && !next.combatState) {
      newEffects.push({ type: 'combat-resolved' });
    }

    // Detect game over
    if (!prev.winner && next.winner) {
      newEffects.push({
        type: 'game-over',
        isWin: next.winner === gameState.myPlayerId,
      });
    }

    if (newEffects.length > 0) {
      setEffects(newEffects);
      const timer = setTimeout(() => setEffects([]), 600);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  return effects;
}
