import { createPortal } from 'react-dom';
import type { ClientCardInstance } from '../../../shared/types';
import { Card } from './Card';

interface DragOverlayProps {
  cardInstanceId: string;
  faceDown: boolean;
  cursorX: number;
  cursorY: number;
  cards: ClientCardInstance[];
  hideLabels?: boolean;
}

export function DragOverlay({ cardInstanceId, faceDown, cursorX, cursorY, cards, hideLabels }: DragOverlayProps) {
  const card = cards.find((c) => c.instanceId === cardInstanceId);
  if (!card) return null;

  const displayCard: ClientCardInstance = faceDown
    ? { instanceId: card.instanceId, cardCode: null, faceUp: false }
    : card;

  return createPortal(
    <div
      className="animate-drag-float"
      style={{
        position: 'fixed',
        left: Math.max(0, Math.min(window.innerWidth - 144, cursorX - 72)),
        top: Math.max(0, Math.min(window.innerHeight - 198, cursorY - 99)),
        pointerEvents: 'none',
        zIndex: 9999,
        transform: 'scale(0.75)',
        filter: 'drop-shadow(0 8px 24px rgba(0, 0, 0, 0.5))',
      }}
    >
      <Card card={displayCard} size="lg" />
      {!hideLabels && (
        <>
          <div
            className={`absolute -top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold ${
              faceDown
                ? 'bg-spero-yellow text-black'
                : 'bg-spero-blue text-white'
            }`}
          >
            {faceDown ? 'FACE DOWN' : 'FACE UP'}
          </div>
          {'ontouchstart' in window ? null : (
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 whitespace-nowrap">
              Hold Shift to toggle
            </div>
          )}
        </>
      )}
      {hideLabels && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold bg-amber-600 text-white">
          SPLIT
        </div>
      )}
    </div>,
    document.body
  );
}
