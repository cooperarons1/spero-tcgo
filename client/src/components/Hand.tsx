import type { ClientCardInstance } from '../../../shared/types';
import { Card } from './Card';
import { getCardDef } from '../utils/stackHelpers';

interface HandProps {
  cards: ClientCardInstance[];
  onCardClick?: (instanceId: string) => void;
  isMyTurn: boolean;
  highlightFilter?: (card: ClientCardInstance) => boolean;
}

export function Hand({ cards, onCardClick, isMyTurn, highlightFilter }: HandProps) {
  return (
    <div className="flex justify-center items-end flex-wrap px-2 py-1 gap-1">
      {cards.map((card, i) => {
        const playable = isMyTurn && highlightFilter?.(card);
        return (
          <div
            key={card.instanceId}
            className="animate-slide-up"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <Card
              card={card}
              size="md"
              onClick={playable ? () => onCardClick?.(card.instanceId) : undefined}
              disabled={!playable}
              highlighted={!!playable}
            />
          </div>
        );
      })}
    </div>
  );
}
