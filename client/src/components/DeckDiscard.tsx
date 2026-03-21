import { useState } from 'react';
import { CardBack, Card } from './Card';
import type { ClientCardInstance } from '../../../shared/types';

interface DeckDiscardProps {
  deckCount: number;
  discardCount: number;
  discardCards?: ClientCardInstance[];
}

export function DeckDiscard({ deckCount, discardCount, discardCards }: DeckDiscardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasCards = discardCards && discardCards.length > 0;

  return (
    <div className="bg-board-surface rounded-xl p-3 border border-board-accent">
      <div className="flex flex-col gap-3">
        {/* Deck */}
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-600 mb-1">Deck</div>
          <div className="flex items-center gap-2">
            <CardBack size="sm" />
            <span className="text-lg font-bold text-gray-300">{deckCount}</span>
          </div>
        </div>

        {/* Discard */}
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-600 mb-1">Discard</div>
          <div
            className={`flex items-center gap-2 ${hasCards ? 'cursor-pointer hover:bg-white/5 rounded-lg p-1 -m-1 transition-colors' : ''}`}
            onClick={hasCards ? () => setExpanded(!expanded) : undefined}
          >
            <div className="w-24 h-[132px] rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center">
              <span className="text-gray-600 text-sm">{discardCount}</span>
            </div>
            <span className="text-lg font-bold text-gray-300">{discardCount}</span>
            {hasCards && (
              <span className="text-gray-500 text-xs ml-auto">{expanded ? '▲' : '▼'}</span>
            )}
          </div>

          {/* Expanded discard viewer */}
          {expanded && hasCards && (
            <div className="mt-2 max-h-[300px] overflow-y-auto border border-board-accent rounded-lg p-2 bg-board-surface/80">
              <div className="grid grid-cols-2 gap-1.5">
                {discardCards.map((card) => (
                  <Card key={card.instanceId} card={card} size="sm" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
