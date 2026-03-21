import { useEffect } from 'react';
import type { GameEffect } from './useGameAnimations';
import { soundManager } from '../utils/soundManager';

export function useSoundEffects(effects: GameEffect[]) {
  useEffect(() => {
    for (const e of effects) {
      switch (e.type) {
        case 'card-built':
          soundManager.play('CARD_PLAY');
          break;
        case 'card-drawn':
          soundManager.play('CARD_DRAW');
          break;
        case 'mission-launched':
          soundManager.play('MISSION_LAUNCH');
          break;
        case 'damage':
          soundManager.play('COMBAT_HIT');
          break;
        case 'ap-change':
          if (e.delta > 0) soundManager.play('AP_GAIN');
          break;
        case 'turn-start':
          soundManager.play('TURN_START');
          break;
        case 'game-over':
          soundManager.play(e.isWin ? 'VICTORY' : 'DEFEAT');
          break;
        case 'combat-resolved':
          soundManager.play('COMBAT_HIT');
          break;
      }
    }
  }, [effects]);
}
