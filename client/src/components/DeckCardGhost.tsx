import { createPortal } from 'react-dom';
import { Card } from './Card';

interface DeckCardGhostProps {
  cardCode: string;
  cursorX: number;
  cursorY: number;
}

export function DeckCardGhost({ cardCode, cursorX, cursorY }: DeckCardGhostProps) {
  return createPortal(
    <div
      className="fixed pointer-events-none z-[100] opacity-80 animate-drag-float"
      style={{
        left: cursorX - 40,
        top: cursorY - 55,
      }}
    >
      <Card
        card={{ instanceId: cardCode, cardCode, faceUp: true }}
        size="sm"
      />
    </div>,
    document.body
  );
}
