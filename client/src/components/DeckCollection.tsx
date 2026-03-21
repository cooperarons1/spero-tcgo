import { useState, useEffect } from 'react';
import { loadDecks, deleteDeck, saveDeck, generateId, type DeckList } from '../utils/deckStorage';

interface DeckCollectionProps {
  uid: string;
  onEditDeck: (deck: DeckList) => void;
  onNewDeck: () => void;
  onBack: () => void;
}

const MAX_DECKS = 30;

const colorBorder: Record<string, string> = {
  red: 'border-l-spero-red', blue: 'border-l-spero-blue', green: 'border-l-spero-green',
  yellow: 'border-l-spero-yellow', black: 'border-l-spero-black', none: 'border-l-gray-500',
};

function getPrimaryColor(cards: string[]): string {
  const counts: Record<string, number> = {};
  for (const code of cards) {
    const prefix = code.startsWith('R') ? 'red'
      : code.startsWith('GR') ? 'green'
      : code.startsWith('U') ? 'blue'
      : code.startsWith('Y') ? 'yellow'
      : code.startsWith('BL') ? 'black'
      : 'none';
    counts[prefix] = (counts[prefix] || 0) + 1;
  }
  let max = 'none';
  let maxCount = 0;
  for (const [color, count] of Object.entries(counts)) {
    if (color !== 'none' && count > maxCount) {
      max = color;
      maxCount = count;
    }
  }
  return max;
}

export function DeckCollection({ uid, onEditDeck, onNewDeck, onBack }: DeckCollectionProps) {
  const [decks, setDecks] = useState<DeckList[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const refresh = async () => {
    const d = await loadDecks(uid);
    setDecks(d);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [uid]);

  const handleDelete = async (id: string) => {
    await deleteDeck(uid, id);
    setDeleteConfirm(null);
    refresh();
  };

  const handleDuplicate = async (deck: DeckList) => {
    const newDeck: DeckList = {
      id: generateId(),
      name: `${deck.name} (Copy)`,
      cards: [...deck.cards],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveDeck(uid, newDeck);
    refresh();
  };

  // Sort: starter decks first, then by updatedAt desc
  const sorted = [...decks].sort((a, b) => {
    if (a.isStarterDeck && !b.isStarterDeck) return -1;
    if (!a.isStarterDeck && b.isStarterDeck) return 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  return (
    <div className="flex flex-col items-center min-h-screen p-4">
      <div className="bg-board-surface rounded-2xl p-6 shadow-xl max-w-2xl w-full border border-board-accent">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">My Decks</h2>
            <span className="text-xs text-gray-500">{decks.length}/{MAX_DECKS} decks</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onNewDeck}
              disabled={decks.length >= MAX_DECKS}
              className="bg-spero-green text-white font-bold px-4 py-2 rounded-xl text-sm hover:brightness-110 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title={decks.length >= MAX_DECKS ? `Deck limit reached (${MAX_DECKS})` : ''}
            >
              New Deck
            </button>
            <button onClick={onBack} className="text-gray-400 hover:text-white text-sm underline cursor-pointer">Back</button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500 text-center py-8">Loading...</p>
        ) : sorted.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No decks yet. Create one to get started!</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sorted.map(deck => {
              const primary = getPrimaryColor(deck.cards);
              const isValid = deck.cards.length === 60;
              return (
                <div
                  key={deck.id}
                  className={`bg-board-accent rounded-xl p-4 border-l-4 ${colorBorder[primary] || 'border-l-gray-600'} relative`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {deck.isStarterDeck && (
                        <span className="text-spero-yellow text-sm shrink-0" title="Starter Deck">&#9733;</span>
                      )}
                      <h3 className="text-white font-bold truncate">{deck.name}</h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${isValid ? 'bg-spero-green/20 text-spero-green' : 'bg-spero-red/20 text-spero-red'}`}>
                        {deck.cards.length}/60
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => onEditDeck(deck)}
                      className="text-xs bg-spero-blue text-white px-3 py-1.5 rounded-lg hover:brightness-110 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDuplicate(deck)}
                      disabled={decks.length >= MAX_DECKS}
                      className="text-xs bg-board-surface text-gray-300 px-3 py-1.5 rounded-lg hover:bg-board-surface/80 cursor-pointer disabled:opacity-50"
                    >
                      Duplicate
                    </button>
                    {!deck.isStarterDeck && (
                      <button
                        onClick={() => setDeleteConfirm(deck.id)}
                        className="text-xs bg-spero-red/20 text-spero-red px-3 py-1.5 rounded-lg hover:bg-spero-red/30 cursor-pointer ml-auto"
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  {/* Delete confirmation */}
                  {deleteConfirm === deck.id && (
                    <div className="absolute inset-0 bg-board-accent/95 rounded-xl flex items-center justify-center gap-3 z-10">
                      <span className="text-sm text-white">Delete this deck?</span>
                      <button
                        onClick={() => handleDelete(deck.id)}
                        className="text-xs bg-spero-red text-white px-3 py-1.5 rounded-lg cursor-pointer"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-xs bg-board-surface text-gray-300 px-3 py-1.5 rounded-lg cursor-pointer"
                      >
                        No
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
