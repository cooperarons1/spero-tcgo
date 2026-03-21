import { useState, useEffect } from 'react';
import { loadDecks, getSelectedDeckId, setSelectedDeckId, type DeckList } from '../utils/deckStorage';
import { getCardImagePath } from '../utils/cardImages';
import { getCardDef } from '../utils/stackHelpers';

interface DeckSelectorProps {
  uid: string;
  onSelectDeck: (deckCards: string[] | null) => void;
}

/** Find the first CHARACTER card image in a deck's card list */
function getDeckThumbnail(cards: string[]): string | null {
  for (const code of cards) {
    const def = getCardDef(code);
    if (def && def.typeA === 'CHARACTER') return getCardImagePath(code);
  }
  // Fallback to first card if no character found
  return cards.length > 0 ? getCardImagePath(cards[0]) : null;
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
      const savedDeck = savedId ? d.find(dk => dk.id === savedId) : null;
      if (savedDeck) {
        setSelectedId(savedDeck.id);
        onSelectDeck(savedDeck.cards);
      } else {
        // Auto-select first starter deck, or first valid 60-card deck
        const autoSelect = d.find(dk => dk.isStarterDeck && dk.cards.length === 60)
          || d.find(dk => dk.cards.length === 60);
        if (autoSelect) {
          setSelectedId(autoSelect.id);
          setSelectedDeckId(autoSelect.id);
          onSelectDeck(autoSelect.cards);
        }
      }
    });
  }, [uid]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setSelectedDeckId(id);
    const deck = decks.find(d => d.id === id);
    onSelectDeck(deck?.cards ?? null);
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

      {sorted.map(d => {
        const isValid = d.cards.length === 60;
        const thumb = getDeckThumbnail(d.cards);
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
              <span className="truncate flex items-center gap-2">
                {thumb && (
                  <img src={thumb} alt="" className="w-6 h-9 object-cover rounded-sm flex-shrink-0" />
                )}
                <span className="flex items-center gap-1">
                  {d.isStarterDeck && <span className="text-spero-yellow text-xs">&#9733;</span>}
                  {d.name}
                </span>
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
