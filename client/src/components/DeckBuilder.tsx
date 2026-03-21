import { useState, useMemo } from 'react';
import cardData from '../../../data/cards.json';
import { validateDeck, DECK_SIZE, MAX_COPIES_PER_CARD } from '../../../shared/deckRules';
import { type DeckList, saveDeck, generateId } from '../utils/deckStorage';
import { getCardDef } from '../utils/stackHelpers';
import { Card } from './Card';

interface DeckBuilderProps {
  deck: DeckList | null;
  onBack: () => void;
}

const COLORS = ['red', 'blue', 'green', 'yellow', 'black', 'none'] as const;
const TYPES = ['CHARACTER', 'EQUIPMENT', 'ACTION', 'COMBAT TRICK'] as const;

const COLOR_LABELS: Record<string, string> = {
  red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow', black: 'Black', none: 'Colorless',
};

export function DeckBuilder({ deck: initialDeck, onBack }: DeckBuilderProps) {
  const [deckName, setDeckName] = useState(initialDeck?.name ?? 'New Deck');
  const [deckCards, setDeckCards] = useState<string[]>(initialDeck?.cards ?? []);
  const [deckId] = useState(initialDeck?.id ?? generateId());
  const [createdAt] = useState(initialDeck?.createdAt ?? Date.now());

  // Filters
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');

  const allCards = useMemo(() => cardData as any[], []);

  const filteredCards = useMemo(() => {
    return allCards.filter(c => {
      if (filterColor && c.color !== filterColor) return false;
      if (filterType && c.typeA !== filterType) return false;
      if (filterSearch && !c.name.toLowerCase().includes(filterSearch.toLowerCase())) return false;
      return true;
    }).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  }, [allCards, filterColor, filterType, filterSearch]);

  // Count per card in deck
  const deckCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const code of deckCards) {
      counts.set(code, (counts.get(code) || 0) + 1);
    }
    return counts;
  }, [deckCards]);

  // Grouped deck cards for display
  const deckGrouped = useMemo(() => {
    const groups: { code: string; name: string; typeA: string; color: string; cost: number; count: number }[] = [];
    const seen = new Set<string>();
    for (const code of deckCards) {
      if (seen.has(code)) continue;
      seen.add(code);
      const def = getCardDef(code);
      if (def) {
        groups.push({
          code,
          name: def.name,
          typeA: def.typeA,
          color: def.color,
          cost: def.cost,
          count: deckCounts.get(code) || 0,
        });
      }
    }
    return groups.sort((a, b) => {
      const typeOrder = ['CHARACTER', 'EQUIPMENT', 'ACTION', 'COMBAT TRICK'];
      const ta = typeOrder.indexOf(a.typeA);
      const tb = typeOrder.indexOf(b.typeA);
      if (ta !== tb) return ta - tb;
      return a.cost - b.cost || a.name.localeCompare(b.name);
    });
  }, [deckCards, deckCounts]);

  const validation = useMemo(
    () => validateDeck(deckCards, getCardDef as any),
    [deckCards]
  );

  const addCard = (code: string) => {
    const current = deckCounts.get(code) || 0;
    if (current >= MAX_COPIES_PER_CARD) return;
    if (deckCards.length >= DECK_SIZE) return;
    setDeckCards([...deckCards, code]);
  };

  const removeCard = (code: string) => {
    const idx = deckCards.lastIndexOf(code);
    if (idx >= 0) {
      const next = [...deckCards];
      next.splice(idx, 1);
      setDeckCards(next);
    }
  };

  const handleSave = () => {
    const deck: DeckList = {
      id: deckId,
      name: deckName.trim() || 'Unnamed Deck',
      cards: deckCards,
      createdAt,
      updatedAt: Date.now(),
    };
    saveDeck(deck);
    onBack();
  };

  const colorDot: Record<string, string> = {
    red: 'bg-spero-red', blue: 'bg-spero-blue', green: 'bg-spero-green',
    yellow: 'bg-spero-yellow', black: 'bg-spero-black', none: 'bg-gray-500',
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-board-accent bg-board-surface/50 shrink-0">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm cursor-pointer">
          &larr; Back
        </button>
        <h1 className="text-lg font-bold text-white">Deck Builder</h1>
        <button
          onClick={handleSave}
          className="bg-spero-green text-white font-bold px-4 py-1.5 rounded-lg text-sm hover:brightness-110 active:scale-95 cursor-pointer"
        >
          Save
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Collection (left 60%) */}
        <div className="w-[60%] flex flex-col border-r border-board-accent/30">
          {/* Filters */}
          <div className="p-3 space-y-2 border-b border-board-accent/30 shrink-0">
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setFilterColor(null)}
                className={`text-xs px-2 py-1 rounded-full cursor-pointer ${!filterColor ? 'bg-white text-black font-bold' : 'bg-board-accent text-gray-400'}`}
              >
                All
              </button>
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setFilterColor(filterColor === c ? null : c)}
                  className={`text-xs px-2 py-1 rounded-full cursor-pointer flex items-center gap-1 ${filterColor === c ? 'bg-white text-black font-bold' : 'bg-board-accent text-gray-400'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${colorDot[c]}`} />
                  {COLOR_LABELS[c]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <select
                value={filterType ?? ''}
                onChange={e => setFilterType(e.target.value || null)}
                className="text-xs bg-board-accent text-gray-300 rounded px-2 py-1 border-none"
              >
                <option value="">All Types</option>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                type="text"
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="Search by name..."
                className="flex-1 text-xs bg-board-accent text-white rounded px-2 py-1 border border-gray-700 focus:border-spero-yellow focus:outline-none"
              />
            </div>
          </div>

          {/* Card grid */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
              {filteredCards.map((c: any) => {
                const count = deckCounts.get(c.cardCode) || 0;
                const maxed = count >= MAX_COPIES_PER_CARD || deckCards.length >= DECK_SIZE;
                return (
                  <div
                    key={c.cardCode}
                    className={`relative cursor-pointer transition-all ${maxed ? 'opacity-40' : 'hover:scale-105'}`}
                    onClick={() => !maxed && addCard(c.cardCode)}
                  >
                    <Card
                      card={{ instanceId: c.cardCode, cardCode: c.cardCode, faceUp: true }}
                      size="sm"
                    />
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1 bg-spero-yellow text-black text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Deck panel (right 40%) */}
        <div className="w-[40%] flex flex-col">
          <div className="p-3 border-b border-board-accent/30 shrink-0">
            <input
              type="text"
              value={deckName}
              onChange={e => setDeckName(e.target.value)}
              maxLength={30}
              className="w-full bg-board-accent text-white font-bold rounded-lg px-3 py-2 text-sm border border-gray-700 focus:border-spero-yellow focus:outline-none"
            />
            <div className="flex justify-between mt-2 text-xs">
              <span className={`font-bold ${deckCards.length === DECK_SIZE ? 'text-spero-green' : 'text-spero-yellow'}`}>
                {deckCards.length}/{DECK_SIZE} cards
              </span>
              <div className="flex gap-2">
                {Object.entries(validation.colorBreakdown).map(([color, count]) => (
                  <span key={color} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${colorDot[color] || 'bg-gray-500'}`} />
                    <span className="text-gray-400">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Validation errors */}
          {validation.errors.length > 0 && (
            <div className="px-3 py-2 shrink-0">
              {validation.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-400">{e}</p>
              ))}
            </div>
          )}

          {/* Deck list */}
          <div className="flex-1 overflow-y-auto p-3">
            {deckGrouped.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">Click cards to add them</p>
            ) : (
              <div className="space-y-1">
                {deckGrouped.map(card => (
                  <div
                    key={card.code}
                    className="flex items-center justify-between bg-board-accent rounded-lg px-3 py-1.5 cursor-pointer hover:bg-board-accent/80"
                    onClick={() => removeCard(card.code)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${colorDot[card.color] || 'bg-gray-500'}`} />
                      <span className="text-xs text-white truncate">{card.name}</span>
                      <span className="text-[10px] text-gray-500">{card.cost}</span>
                    </div>
                    <span className="text-xs text-spero-yellow font-bold ml-2">x{card.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
