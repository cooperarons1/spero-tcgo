import { useState, useEffect, useCallback } from 'react';
import type { ClientGameState } from '../../../shared/types';

const STORAGE_KEY = 'spero-hints-seen';

export interface HintConfig {
  id: string;
  target: string;        // data-hint-target value
  text: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const ALL_HINTS: HintConfig[] = [
  { id: 'hand', target: 'hand', text: 'Drag or click a card to build it onto a stack', position: 'top' },
  { id: 'stacks', target: 'stacks', text: 'Cards combine Power and Smarts for missions', position: 'top' },
  { id: 'builds', target: 'builds', text: 'You get 2 builds per turn', position: 'bottom' },
  { id: 'action', target: 'action-area', text: 'Click a stack to launch a mission', position: 'top' },
  { id: 'missions', target: 'ap-counter', text: 'Reach 15 AP to win!', position: 'right' },
  { id: 'phases', target: 'phase-bar', text: 'Shows the current turn phase', position: 'left' },
];

function getSeenHints(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function markSeen(id: string): void {
  const seen = getSeenHints();
  seen.add(id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  } catch { /* ignore */ }
}

export function useOnboardingHints(gameState: ClientGameState) {
  const [activeHint, setActiveHint] = useState<HintConfig | null>(null);
  const [seen, setSeen] = useState<Set<string>>(getSeenHints);

  const isMyTurn = gameState.myPlayerIndex === gameState.currentPlayerIndex;

  useEffect(() => {
    if (gameState.winner) {
      setActiveHint(null);
      return;
    }

    // Don't show hints if all seen
    if (seen.size >= ALL_HINTS.length) return;

    let hintToShow: HintConfig | null = null;

    if (!seen.has('phases')) {
      hintToShow = ALL_HINTS.find(h => h.id === 'phases')!;
    } else if (isMyTurn && gameState.turnPhase === 'BUILD' && !seen.has('hand')) {
      hintToShow = ALL_HINTS.find(h => h.id === 'hand')!;
    } else if (isMyTurn && gameState.turnPhase === 'BUILD' && !seen.has('builds')) {
      hintToShow = ALL_HINTS.find(h => h.id === 'builds')!;
    } else if (gameState.myStacks.length > 0 && !seen.has('stacks')) {
      hintToShow = ALL_HINTS.find(h => h.id === 'stacks')!;
    } else if (isMyTurn && gameState.turnPhase === 'ACTION' && !seen.has('action')) {
      hintToShow = ALL_HINTS.find(h => h.id === 'action')!;
    } else if (isMyTurn && gameState.turnPhase === 'ACTION' && !seen.has('missions')) {
      hintToShow = ALL_HINTS.find(h => h.id === 'missions')!;
    }

    setActiveHint(hintToShow);
  }, [gameState.turnPhase, gameState.myStacks.length, isMyTurn, seen, gameState.winner]);

  const dismissHint = useCallback(() => {
    if (activeHint) {
      markSeen(activeHint.id);
      setSeen(prev => new Set([...prev, activeHint.id]));
      setActiveHint(null);
    }
  }, [activeHint]);

  return { activeHint, dismissHint };
}
