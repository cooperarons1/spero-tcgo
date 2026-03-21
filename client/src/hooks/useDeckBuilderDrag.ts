import { useState, useCallback } from 'react';

export interface DeckDragState {
  cardCode: string;
  source: 'collection' | 'deck';
  cursorX: number;
  cursorY: number;
}

const ACTIVATION_THRESHOLD = 5;

export function useDeckBuilderDrag() {
  const [dragState, setDragState] = useState<DeckDragState | null>(null);
  const [pending, setPending] = useState<{
    cardCode: string;
    source: 'collection' | 'deck';
    startX: number;
    startY: number;
  } | null>(null);

  const startDrag = useCallback((cardCode: string, source: 'collection' | 'deck', e: PointerEvent) => {
    setPending({ cardCode, source, startX: e.clientX, startY: e.clientY });
  }, []);

  const updateDrag = useCallback((e: PointerEvent) => {
    if (pending && !dragState) {
      const dx = Math.abs(e.clientX - pending.startX);
      const dy = Math.abs(e.clientY - pending.startY);
      if (dx > ACTIVATION_THRESHOLD || dy > ACTIVATION_THRESHOLD) {
        setDragState({
          cardCode: pending.cardCode,
          source: pending.source,
          cursorX: e.clientX,
          cursorY: e.clientY,
        });
      }
      return;
    }
    if (dragState) {
      setDragState(prev => prev ? { ...prev, cursorX: e.clientX, cursorY: e.clientY } : null);
    }
  }, [pending, dragState]);

  const endDrag = useCallback((): DeckDragState | null => {
    const result = dragState;
    setDragState(null);
    setPending(null);
    return result;
  }, [dragState]);

  return {
    state: dragState,
    isDragging: !!dragState,
    startDrag,
    updateDrag,
    endDrag,
  };
}
