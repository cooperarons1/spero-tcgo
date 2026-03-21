import { useState, useEffect } from 'react';
import { loadDecks, getSelectedDeckId, setSelectedDeckId, type DeckList } from '../utils/deckStorage';

interface DeckSelectorProps {
  onSelectDeck: (deckCards: string[] | null) => void;
}

export function DeckSelector({ onSelectDeck }: DeckSelectorProps) {
  const [decks, setDecks] = useState<DeckList[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setDecks(loadDecks());
    setSelectedId(getSelectedDeckId());
  }, []);

  const handleSelect = (id: string | null) => {
    setSelectedId(id);
    setSelectedDeckId(id);
    if (id) {
      const deck = decks.find(d => d.id === id);
      onSelectDeck(deck?.cards ?? null);
    } else {
      onSelectDeck(null);
    }
  };

  const colorDot: Record<string, string> = {
    red: 'bg-spero-red', blue: 'bg-spero-blue', green: 'bg-spero-green',
    yellow: 'bg-spero-yellow', black: 'bg-spero-black', none: 'bg-gray-500',
  };

  const getPrimaryColor = (deck: DeckList): string => {
    const counts = new Map<string, number>();
    // We'd need card defs to figure out color, but for display just show card count
    return 'none';
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xs uppercase tracking-wider text-gray-500 font-bold">Deck</h3>

      <button
        onClick={() => handleSelect(null)}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm cursor-pointer transition-all ${
          selectedId === null
            ? 'bg-spero-green/20 border border-spero-green text-white font-bold'
            : 'bg-board-accent text-gray-400 hover:bg-board-accent/80'
        }`}
      >
        Starter Deck (default)
      </button>

      {decks.map(d => (
        <button
          key={d.id}
          onClick={() => handleSelect(d.id)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm cursor-pointer transition-all ${
            selectedId === d.id
              ? 'bg-spero-green/20 border border-spero-green text-white font-bold'
              : 'bg-board-accent text-gray-400 hover:bg-board-accent/80'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="truncate">{d.name}</span>
            <span className="text-[10px] text-gray-500">{d.cards.length} cards</span>
          </div>
        </button>
      ))}

      {decks.length === 0 && (
        <p className="text-[10px] text-gray-600">Build a deck in the Deck Builder!</p>
      )}
    </div>
  );
}
