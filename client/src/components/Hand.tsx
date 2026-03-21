import type { ClientCardInstance } from '../../../shared/types';
import { Card } from './Card';
import { getCardDef } from '../utils/stackHelpers';

import { socket } from '../socket';

interface HandProps {
  cards: ClientCardInstance[];
  onCardClick?: (instanceId: string) => void;
  isMyTurn: boolean;
  highlightFilter?: (card: ClientCardInstance) => boolean;
  onDragStart?: (instanceId: string, e: React.PointerEvent) => void;
  draggingCardId?: string | null;
  cardSize?: 'sm' | 'md';
}

export function Hand({ cards, onCardClick, isMyTurn, highlightFilter, onDragStart, draggingCardId, cardSize = 'md' }: HandProps) {
  const totalCards = cards.length;
  const cardWidth = cardSize === 'sm' ? 96 : 144;
  const maxSpread = cardSize === 'sm' ? 600 : 900;
  const spacing = Math.min(cardWidth + 8, maxSpread / Math.max(totalCards, 1));

  const handleMouseEnter = () => {
    socket.emit('hover-hand', { isHovering: true });
  };

  const handleMouseLeave = () => {
    socket.emit('hover-hand', { isHovering: false });
  };

  return (
    <div
      className="relative flex justify-center items-end h-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {cards.map((card, i) => {
        const playable = isMyTurn && highlightFilter?.(card);
        const isDragging = draggingCardId === card.instanceId;
        const offset = i - (totalCards - 1) / 2;
        const fanAngle = totalCards > 1 ? Math.min(3, 18 / totalCards) : 0;
        const rotation = offset * fanAngle;
        const translateY = Math.abs(offset) * 3;

        return (
          <div
            key={card.instanceId}
            className={`relative transition-all duration-200 hover:-translate-y-6 hover:scale-110 hover:!rotate-0 hover:z-50 animate-card-deal ${isDragging ? 'opacity-10 scale-95' : ''}`}
            style={{
              transform: `translateY(${translateY}px) rotate(${rotation}deg)`,
              transformOrigin: 'bottom center',
              zIndex: isDragging ? 0 : i,
              marginLeft: i === 0 ? 0 : `${spacing - cardWidth}px`,
              animationDelay: `${i * 30}ms`,
            }}
          >
            <Card
              card={card}
              size={cardSize}
              onClick={playable ? () => onCardClick?.(card.instanceId) : undefined}
              disabled={!playable}
              highlighted={!!playable}
            />
            {/* Invisible drag overlay — captures pointer without fighting the button */}
            {playable && onDragStart && (
              <div
                className="absolute inset-0 z-10"
                style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDragStart(card.instanceId, e);
                }}
                onClick={(e) => {
                  // Let clicks through to the Card button
                  e.stopPropagation();
                  onCardClick?.(card.instanceId);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
