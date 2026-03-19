import { CardBack } from './Card';

interface DeckDiscardProps {
  deckCount: number;
  discardCount: number;
}

export function DeckDiscard({ deckCount, discardCount }: DeckDiscardProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <CardBack size="sm" />
        <span className="text-[10px] text-gray-500 font-bold">Deck: {deckCount}</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="w-16 h-22 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center">
          <span className="text-gray-600 text-xs">{discardCount}</span>
        </div>
        <span className="text-[10px] text-gray-500 font-bold">Discard</span>
      </div>
    </div>
  );
}
