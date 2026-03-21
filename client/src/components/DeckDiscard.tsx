import { useState } from 'react';
import { Card } from './Card';
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
  const topCard = hasCards ? discardCards[discardCards.length - 1] : null;

  return (
    <div className="bg-board-surface rounded-xl p-3 border border-board-accent">
      <div className="flex flex-col gap-3">
        {/* Deck — stacked card backs, bottom layers peek below */}
        <div className="relative">
          <div className="text-xs uppercase tracking-wider text-gray-600 mb-1">Deck</div>
          <div
            className="relative w-24 h-[132px] cursor-default"
            onMouseEnter={() => setDeckHover(true)}
            onMouseLeave={() => setDeckHover(false)}
          >
            {deckCount > 0 && (
              <>
                {deckCount >= 3 && (
                  <div className="absolute top-[4px] left-0 w-full h-full rounded-lg border border-gray-700 bg-gradient-to-br from-board-accent via-board-surface to-board-accent" />
                )}
                {deckCount >= 2 && (
                  <div className="absolute top-[2px] left-0 w-full h-full rounded-lg border border-gray-700 bg-gradient-to-br from-board-accent via-board-surface to-board-accent" />
                )}
                <div className="absolute top-0 left-0 w-full h-full rounded-lg border border-gray-600 bg-gradient-to-b from-board-accent via-board-surface to-board-accent flex items-center justify-center shadow-md">
                  <span className="text-gray-500 text-[10px] font-bold tracking-widest select-none">SPERO</span>
                </div>
              </>
            )}
            {deckCount === 0 && (
              <div className="w-full h-full rounded-lg border-2 border-dashed border-gray-700/50 flex items-center justify-center">
                <span className="text-gray-700 text-xs">Empty</span>
              </div>
            )}
          </div>

          {/* Deck hover tooltip */}
          {deckHover && deckCount > 0 && (
            <div className="absolute left-full ml-2 top-0 z-40 bg-board-surface border border-board-accent rounded-xl px-3 py-2 shadow-xl animate-tooltip-fade whitespace-nowrap">
              <span className="text-sm text-white font-bold">{deckCount}</span>
              <span className="text-sm text-gray-400"> cards</span>
            </div>
          )}
        </div>

        {/* Discard — top card face-up at natural sm size */}
        <div className="relative">
          <div className="text-xs uppercase tracking-wider text-gray-600 mb-1">Discard</div>
          <div
            className={`${hasCards ? 'cursor-pointer' : 'cursor-default'}`}
            onClick={hasCards ? () => setExpanded(!expanded) : undefined}
            onMouseEnter={() => hasCards && setDiscardHover(true)}
            onMouseLeave={() => setDiscardHover(false)}
          >
            {topCard ? (
              <Card card={topCard} size="sm" />
            ) : (
              <div className="w-24 h-[132px] rounded-lg border-2 border-dashed border-gray-700/50 flex items-center justify-center">
                <span className="text-gray-700 text-xs">Empty</span>
              </div>
            )}
          </div>

          {/* Discard hover tooltip */}
          {discardHover && hasCards && !expanded && (
            <div className="absolute left-full ml-2 top-0 z-40 bg-board-surface border border-board-accent rounded-xl px-3 py-2 shadow-xl animate-tooltip-fade whitespace-nowrap">
              <span className="text-sm text-white font-bold">{discardCount}</span>
              <span className="text-sm text-gray-400"> cards</span>
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
