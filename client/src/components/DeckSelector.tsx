import { useState, useEffect } from 'react';
import { loadDecks, getSelectedDeckId, setSelectedDeckId, type DeckList } from '../utils/deckStorage';

interface DeckSelectorProps {
  uid: string;
  onSelectDeck: (deckCards: string[] | null) => void;
}

export function DeckSelector({ uid, onSelectDeck }: DeckSelectorProps) {
  const [decks, setDecks] = useState<DeckList[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDecks(uid).then(d => {
      setDecks(d);
      setLoading(false);
      const savedId = getSelectedDeckId();
      if (savedId && d.find(dk => dk.id === savedId)) {
        setSelectedId(savedId);
        const deck = d.find(dk => dk.id === savedId);
        onSelectDeck(deck?.cards ?? null);
      }
    });
  }, [uid]);

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

  // Sort: starter decks first
  const sorted = [...decks].sort((a, b) => {
    if (a.isStarterDeck && !b.isStarterDeck) return -1;
    if (!a.isStarterDeck && b.isStarterDeck) return 1;
    return 0;
  });

  if (loading) {
    return <div className="text-xs text-gray-500 py-2">Loading decks...</div>;
  }

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

      {sorted.map(d => {
        const isValid = d.cards.length === 60;
        return (
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
              <span className="truncate flex items-center gap-1">
                {d.isStarterDeck && <span className="text-spero-yellow text-xs">&#9733;</span>}
                {d.name}
              </span>
              <span className="flex items-center gap-1.5">
                {isValid ? (
                  <span className="text-spero-green text-xs">&#10003;</span>
                ) : (
                  <span className="text-spero-red text-xs">&#10007;</span>
                )}
                <span className="text-[10px] text-gray-500">{d.cards.length} cards</span>
              </span>
            </div>
          </button>
        );
      })}

      {decks.length === 0 && (
        <p className="text-[10px] text-gray-600">Build a deck in My Decks!</p>
      )}
    </div>
  );
}
