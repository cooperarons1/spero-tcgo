import { useState, useCallback, useEffect } from 'react';

interface DragState {
  cardInstanceId: string;
  faceDown: boolean;
  cursorX: number;
  cursorY: number;
  startX: number;
  startY: number;
  activated: boolean; // true once 5px threshold is crossed
}

export function useDragCard() {
  const [state, setState] = useState<DragState | null>(null);

  const startDrag = useCallback((instanceId: string, e: PointerEvent) => {
    setState({
      cardInstanceId: instanceId,
      faceDown: false,
      cursorX: e.clientX,
      cursorY: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      activated: false,
    });
  }, []);

  const updateDrag = useCallback((e: PointerEvent) => {
    setState((prev) => {
      if (!prev) return null;
      const dx = e.clientX - prev.startX;
      const dy = e.clientY - prev.startY;
      const activated = prev.activated || Math.sqrt(dx * dx + dy * dy) > 5;
      return {
        ...prev,
        cursorX: e.clientX,
        cursorY: e.clientY,
        activated,
      };
    });
  }, []);

  const endDrag = useCallback(() => {
    const current = state;
    setState(null);
    if (!current || !current.activated) return null;
    return {
      cardInstanceId: current.cardInstanceId,
      faceDown: current.faceDown,
      cursorX: current.cursorX,
      cursorY: current.cursorY,
    };
  }, [state]);

  const toggleFaceDown = useCallback(() => {
    setState((prev) => prev ? { ...prev, faceDown: !prev.faceDown } : null);
  }, []);

  // Listen for Shift key to toggle faceDown during drag
  useEffect(() => {
    if (!state) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        toggleFaceDown();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state, toggleFaceDown]);

  // Return activated state only (hide pre-threshold state from consumers)
  const visibleState = state?.activated ? state : null;

  return {
    state: visibleState,
    isDragging: state !== null,
    startDrag,
    updateDrag,
    endDrag,
    toggleFaceDown,
  };
}
