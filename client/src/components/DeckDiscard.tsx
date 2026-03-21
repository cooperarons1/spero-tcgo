import { CardBack } from './Card';

interface DeckDiscardProps {
  deckCount: number;
  discardCount: number;
}

export function DeckDiscard({ deckCount, discardCount }: DeckDiscardProps) {
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
          <div className="flex items-center gap-2">
            <div className="w-24 h-[132px] rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center">
              <span className="text-gray-600 text-sm">{discardCount}</span>
            </div>
            <span className="text-lg font-bold text-gray-300">{discardCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
