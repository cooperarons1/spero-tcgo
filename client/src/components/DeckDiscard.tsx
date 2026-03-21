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
  const [deckHover, setDeckHover] = useState(false);
  const [discardHover, setDiscardHover] = useState(false);
  const hasCards = discardCards && discardCards.length > 0;

  return (
    <div className="bg-board-surface rounded-xl p-3 border border-board-accent">
      <div className="flex flex-col gap-3">
        {/* Deck */}
        <div className="relative">
          <div className="text-xs uppercase tracking-wider text-gray-600 mb-1">Deck</div>
          <div
            className="flex items-center gap-2 hover:bg-white/10 rounded-lg p-1 -m-1 transition-colors cursor-pointer"
            onMouseEnter={() => setDeckHover(true)}
            onMouseLeave={() => setDeckHover(false)}
          >
            <CardBack size="sm" />
            <span className="text-lg font-bold text-gray-300">{deckCount}</span>
          </div>

          {/* Deck hover tooltip */}
          {deckHover && (
            <div className="absolute left-full ml-2 top-0 z-40 bg-board-surface border border-board-accent rounded-xl p-3 shadow-xl animate-tooltip-fade whitespace-nowrap">
              <div className="text-sm text-white font-bold mb-1">{deckCount} cards remaining</div>
              <div className="flex gap-0.5">
                {Array.from({ length: Math.min(deckCount, 8) }, (_, i) => (
                  <div key={i} className="w-5 h-7 rounded bg-gradient-to-br from-board-accent via-board-surface to-board-accent border border-gray-700"
                    style={{ marginLeft: i > 0 ? -8 : 0 }}
                  />
                ))}
                {deckCount > 8 && <span className="text-[10px] text-gray-500 ml-1">+{deckCount - 8}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Discard */}
        <div className="relative">
          <div className="text-xs uppercase tracking-wider text-gray-600 mb-1">Discard</div>
          <div
            className={`flex items-center gap-2 ${hasCards ? 'cursor-pointer hover:bg-white/10 rounded-lg p-1 -m-1 transition-colors' : ''}`}
            onClick={hasCards ? () => setExpanded(!expanded) : undefined}
            onMouseEnter={() => hasCards && setDiscardHover(true)}
            onMouseLeave={() => setDiscardHover(false)}
          >
            <div className="w-24 h-[132px] rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center">
              <span className="text-gray-600 text-sm">{discardCount}</span>
            </div>
            <span className="text-lg font-bold text-gray-300">{discardCount}</span>
            {hasCards && (
              <span className="text-gray-500 text-xs ml-auto">{expanded ? '▲' : '▼'}</span>
            )}
          </div>

          {/* Discard hover popover */}
          {discardHover && hasCards && !expanded && (
            <div className="absolute left-full ml-2 top-0 z-40 bg-board-surface border border-board-accent rounded-xl p-3 shadow-xl animate-tooltip-fade max-h-[300px] overflow-y-auto">
              <div className="text-xs text-gray-400 mb-2">{discardCount} cards in discard</div>
              <div className="grid grid-cols-2 gap-1.5" style={{ width: '200px' }}>
                {discardCards!.map((card) => (
                  <Card key={card.instanceId} card={card} size="sm" />
                ))}
              </div>
            </div>
          )}

          {/* Expanded discard viewer (click) */}
          {expanded && hasCards && (
            <div className="mt-2 max-h-[300px] overflow-y-auto border border-board-accent rounded-lg p-2 bg-board-surface/80">
              <div className="grid grid-cols-2 gap-1.5">
                {discardCards!.map((card) => (
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
