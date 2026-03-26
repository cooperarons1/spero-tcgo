import { useEffect, useRef } from 'react';
import { soundManager } from '../utils/soundManager';
import type { StateDiff } from './useStateDiff';
import type { ClientGameState } from '../../../shared/types';

export function useSoundEffects(diff: StateDiff, gs: ClientGameState) {
  const prevTurnRef = useRef<number>(gs.turnNumber);
  const prevWinnerRef = useRef<string | null>(gs.winner);
  const isMyTurn = gs.currentPlayerIndex === gs.myPlayerIndex;

  useEffect(() => {
    if (soundManager.muted) return;

    // Card draw
    if (diff.newCardIds.size > 0) {
      soundManager.play('CARD_DRAW');
    }

    // Combat / damage
    if (diff.damageIds.size > 0 || diff.myHeroDamaged || diff.opHeroDamaged) {
      soundManager.play('COMBAT_HIT');
    }

    // Minion death
    if (diff.deadMinions.length > 0) {
      soundManager.play('MINION_DEATH');
    }

    // Turn start
    if (gs.turnNumber !== prevTurnRef.current && isMyTurn) {
      soundManager.play('TURN_START');
    }
    prevTurnRef.current = gs.turnNumber;

    // Game over
    if (gs.winner && gs.winner !== prevWinnerRef.current) {
      if (gs.winner === gs.myPlayerId) {
        soundManager.play('VICTORY');
      } else {
        soundManager.play('DEFEAT');
      }
    }
    prevWinnerRef.current = gs.winner;
  }, [diff, gs.turnNumber, gs.winner, gs.myPlayerId, isMyTurn]);
}
