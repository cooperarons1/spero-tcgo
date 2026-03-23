import { useState, useMemo, useEffect, useCallback } from 'react';
import cardData from '../../../data/cards.json';
import { DECK_SIZE, MAX_COPIES_PER_CARD, MAX_COPIES_LEGENDARY } from '../../../shared/deckRules';
import { validateDeck } from '../../../shared/deckRules';
import { loadDecks, saveDeck, deleteDeck, generateId, type DeckList } from '../utils/deckStorage';
import { Card } from './Card';
import type { HeroClass, CardDef } from '../../../shared/types';

interface CollectionProps {
  uid: string;
  onBack: () => void;
}

const HERO_CLASSES: { id: HeroClass; label: string; color: string; border: string }[] = [
  { id: 'JIMMY', label: 'Jimmy', color: 'bg-red-600', border: 'border-red-500' },
  { id: 'TALA', label: 'Tala', color: 'bg-green-600', border: 'border-green-500' },
  { id: 'DEREK', label: 'Derek', color: 'bg-yellow-500', border: 'border-yellow-400' },
  { id: 'ANDERS', label: 'Anders', color: 'bg-blue-600', border: 'border-blue-500' },
  { id: 'DES', label: 'Des', color: 'bg-purple-600', border: 'border-purple-500' },
  { id: 'ASTRID', label: 'Astrid', color: 'bg-yellow-500', border: 'border-yellow-400' },
  { id: 'AVA', label: 'Ava', color: 'bg-pink-600', border: 'border-pink-500' },
  { id: 'LUCAS', label: 'Lucas', color: 'bg-teal-600', border: 'border-teal-500' },
  { id: 'IZZY', label: 'Izzy', color: 'bg-orange-600', border: 'border-orange-500' },
];

const HERO_COLOR_MAP: Record<string, string> = {
  JIMMY: 'border-l-red-500',
  TALA: 'border-l-green-500',
  DEREK: 'border-l-yellow-400',
  ANDERS: 'border-l-blue-500',
  DES: 'border-l-purple-500',
  ASTRID: 'border-l-yellow-400',
  AVA: 'border-l-pink-500',
  LUCAS: 'border-l-teal-500',
  IZZY: 'border-l-orange-500',
  NEUTRAL: 'border-l-gray-500',
};

const HERO_BG_MAP: Record<string, string> = {
  JIMMY: 'bg-red-500/10',
  TALA: 'bg-green-500/10',
  DEREK: 'bg-yellow-500/10',
  ANDERS: 'bg-blue-500/10',
  DES: 'bg-purple-500/10',
  ASTRID: 'bg-yellow-500/10',
  AVA: 'bg-pink-500/10',
  LUCAS: 'bg-teal-500/10',
  IZZY: 'bg-orange-500/10',
};

const allCards = cardData as CardDef[];
const cardsByCode = new Map(allCards.map(c => [c.cardCode, c]));

function getCardDef(code: string): CardDef | undefined {
  return cardsByCode.get(code);
}

const MANA_FILTERS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export function Collection({ uid, onBack }: CollectionProps) {
  const [decks, setDecks] = useState<DeckList[]>([]);
  const [loading, setLoading] = useState(true);

  // Editing state
  const [editingDeck, setEditingDeck] = useState<DeckList | null>(null);
  const [editingCards, setEditingCards] = useState<string[]>([]);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);

  // Hero class picker modal
  const [showHeroPicker, setShowHeroPicker] = useState(false);

  // Filters
  const [filterClass, setFilterClass] = useState<HeroClass | 'ALL'>('ALL');
  const [filterMana, setFilterMana] = useState<number | null>(null);
  const [filterSearch, setFilterSearch] = useState('');

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const d = await loadDecks(uid);
    setDecks(d);
    setLoading(false);
  }, [uid]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-filter to editing deck's class + neutral
  useEffect(() => {
    if (editingDeck) {
      setFilterClass(editingDeck.heroClass);
    }
  }, [editingDeck?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredCards = useMemo(() => {
    return allCards.filter(c => {
      // Hide tokens and Coin from collection
      if (c.cardCode === 'COIN') return false;
      if (c.heroClass === 'NEUTRAL' && c.rarity === 'COMMON' && c.cardCode.startsWith('TOK')) return false;

      if (filterClass !== 'ALL') {
        if (c.heroClass !== filterClass && c.heroClass !== 'NEUTRAL') return false;
      }
      if (filterMana !== null) {
        if (filterMana === 7) {
          if (c.manaCost < 7) return false;
        } else {
          if (c.manaCost !== filterMana) return false;
        }
      }
      if (filterSearch && !c.name.toLowerCase().includes(filterSearch.toLowerCase())) return false;
      return true;
    }).sort((a, b) => a.manaCost - b.manaCost || a.name.localeCompare(b.name));
  }, [filterClass, filterMana, filterSearch]);

  const editingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const code of editingCards) {
      counts.set(code, (counts.get(code) || 0) + 1);
    }
    return counts;
  }, [editingCards]);

  const editingGrouped = useMemo(() => {
    if (!editingDeck) return [];
    const seen = new Map<string, { code: string; def: CardDef; count: number }>();
    for (const code of editingCards) {
      if (seen.has(code)) {
        seen.get(code)!.count++;
      } else {
        const def = getCardDef(code);
        if (def) seen.set(code, { code, def, count: 1 });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.def.manaCost - b.def.manaCost || a.def.name.localeCompare(b.def.name));
  }, [editingCards, editingDeck]);

  const manaCurve = useMemo(() => {
    const curve: Record<number, number> = {};
    for (const code of editingCards) {
      const def = getCardDef(code);
      if (def) {
        const bucket = Math.min(def.manaCost, 7);
        curve[bucket] = (curve[bucket] || 0) + 1;
      }
    }
    return curve;
  }, [editingCards]);

  const maxCurveValue = Math.max(1, ...Object.values(manaCurve));

  const addCard = (code: string) => {
    if (!editingDeck) return;
    const def = getCardDef(code);
    if (!def) return;
    // Class restriction
    if (def.heroClass !== 'NEUTRAL' && def.heroClass !== editingDeck.heroClass) return;
    const current = editingCounts.get(code) || 0;
    const max = def.rarity === 'LEGENDARY' ? MAX_COPIES_LEGENDARY : MAX_COPIES_PER_CARD;
    if (current >= max) return;
    if (editingCards.length >= DECK_SIZE) return;
    setEditingCards([...editingCards, code]);
  };

  const removeCard = (code: string) => {
    const idx = editingCards.lastIndexOf(code);
    if (idx >= 0) {
      const next = [...editingCards];
      next.splice(idx, 1);
      setEditingCards(next);
    }
  };

  const startEditing = (deck: DeckList) => {
    setEditingDeck(deck);
    setEditingCards([...deck.cards]);
    setEditingName(deck.name);
  };

  const startNewDeck = (heroClass: HeroClass) => {
    setShowHeroPicker(false);
    const newDeck: DeckList = {
      id: generateId(),
      name: `New ${HERO_CLASSES.find(h => h.id === heroClass)?.label} Deck`,
      heroClass,
      cards: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    startEditing(newDeck);
  };

  const handleSave = async () => {
    if (!editingDeck) return;
    setSaving(true);
    try {
      const deck: DeckList = {
        ...editingDeck,
        name: editingName.trim() || 'Unnamed Deck',
        cards: editingCards,
        updatedAt: Date.now(),
      };
      await saveDeck(uid, deck);
      setEditingDeck(null);
      refresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteDeck(uid, id);
    setDeleteConfirm(null);
    refresh();
  };

  const validation = useMemo(() => {
    if (!editingDeck) return null;
    return validateDeck(editingCards, editingDeck.heroClass, getCardDef as any);
  }, [editingCards, editingDeck]);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-950 to-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-board-accent bg-board-surface/50 shrink-0">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm cursor-pointer">
          &larr; Back
        </button>
        <h1 className="text-lg font-bold text-white tracking-wide">MY COLLECTION</h1>
        <div className="w-16" />
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left sidebar — My Decks */}
        <div className="w-[200px] flex flex-col border-r border-board-accent/30 bg-board-surface/30 shrink-0">
          <div className="p-3 border-b border-board-accent/30">
            <h2 className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">My Decks</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {loading ? (
              <p className="text-gray-600 text-xs text-center py-4">Loading...</p>
            ) : (
              <>
                {decks.map(deck => {
                  const isEditing = editingDeck?.id === deck.id;
                  const isComplete = deck.cards.length === DECK_SIZE;
                  const deckBg = HERO_BG_MAP[deck.heroClass] || 'bg-gray-500/10';
                  const deckBorder = HERO_COLOR_MAP[deck.heroClass] || 'border-l-gray-600';
                  return (
                    <div key={deck.id} className="relative">
                      <button
                        onClick={() => editingDeck ? undefined : startEditing(deck)}
                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-all border-l-[3px]
                          ${deckBorder}
                          ${isEditing
                            ? `${deckBg} border border-white/30 text-white font-bold`
                            : `${deckBg} text-gray-300 hover:brightness-125`
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate flex items-center gap-1">
                            {deck.isStarterDeck && <span className="text-yellow-400 text-[10px]">&#9733;</span>}
                            {deck.name}
                          </span>
                          <span className={`text-[9px] ${isComplete ? 'text-green-400' : 'text-red-400'}`}>
                            {deck.cards.length}/{DECK_SIZE}
                          </span>
                        </div>
                      </button>
                      {!editingDeck && (
                        <button
                          onClick={() => setDeleteConfirm(deck.id)}
                          className="absolute top-1 right-1 text-gray-600 hover:text-red-400 text-[10px] cursor-pointer"
                          title="Delete deck"
                        >
                          &#10005;
                        </button>
                      )}
                      {deleteConfirm === deck.id && (
                        <div className="absolute inset-0 bg-board-accent/95 rounded-lg flex items-center justify-center gap-2 z-10">
                          <span className="text-[10px] text-white">Delete?</span>
                          <button onClick={() => handleDelete(deck.id)} className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded cursor-pointer">Yes</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-[10px] bg-gray-700 text-white px-2 py-0.5 rounded cursor-pointer">No</button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={() => editingDeck ? undefined : setShowHeroPicker(true)}
                  disabled={!!editingDeck || decks.length >= 30}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-all
                    bg-board-accent/30 text-gray-500 hover:bg-board-accent/50 hover:text-gray-300
                    border border-dashed border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  + New Deck
                </button>
              </>
            )}
          </div>
        </div>

        {/* Center — Card Collection */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Filter bar */}
          <div className="p-3 space-y-2 border-b border-board-accent/30 shrink-0">
            {/* Class tabs */}
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setFilterClass('ALL')}
                className={`text-xs px-2.5 py-1 rounded-full cursor-pointer transition-all ${
                  filterClass === 'ALL' ? 'bg-white text-black font-bold' : 'bg-board-accent text-gray-400 hover:bg-board-accent/80'
                }`}
              >
                All
              </button>
              {HERO_CLASSES.map(h => (
                <button
                  key={h.id}
                  onClick={() => setFilterClass(filterClass === h.id ? 'ALL' : h.id)}
                  className={`text-xs px-2.5 py-1 rounded-full cursor-pointer transition-all flex items-center gap-1 ${
                    filterClass === h.id ? `${h.color} text-white font-bold` : 'bg-board-accent text-gray-400 hover:bg-board-accent/80'
                  }`}
                >
                  {h.label}
                </button>
              ))}
              <button
                onClick={() => setFilterClass(filterClass === 'NEUTRAL' as any ? 'ALL' : 'NEUTRAL' as any)}
                className={`text-xs px-2.5 py-1 rounded-full cursor-pointer transition-all ${
                  filterClass === 'NEUTRAL' ? 'bg-gray-500 text-white font-bold' : 'bg-board-accent text-gray-400 hover:bg-board-accent/80'
                }`}
              >
                Neutral
              </button>
            </div>
            {/* Mana + search */}
            <div className="flex gap-2 items-center">
              <div className="flex gap-0.5">
                {MANA_FILTERS.map(m => (
                  <button
                    key={m}
                    onClick={() => setFilterMana(filterMana === m ? null : m)}
                    className={`w-6 h-6 text-[10px] font-bold rounded-full cursor-pointer transition-all flex items-center justify-center ${
                      filterMana === m
                        ? 'bg-blue-500 text-white'
                        : 'bg-board-accent text-gray-500 hover:bg-board-accent/80'
                    }`}
                  >
                    {m === 7 ? '7+' : m}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="Search cards..."
                className="flex-1 text-xs bg-board-accent text-white rounded-lg px-3 py-1.5 border border-gray-700 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Card grid */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {filteredCards.map(c => {
                const count = editingCounts.get(c.cardCode) || 0;
                const max = c.rarity === 'LEGENDARY' ? MAX_COPIES_LEGENDARY : MAX_COPIES_PER_CARD;
                const isMaxed = editingDeck ? count >= max : false;
                const isWrongClass = editingDeck
                  ? c.heroClass !== 'NEUTRAL' && c.heroClass !== editingDeck.heroClass
                  : false;
                const greyed = isMaxed || isWrongClass;
                return (
                  <div
                    key={c.cardCode}
                    className={`relative transition-all select-none ${
                      editingDeck && !greyed ? 'cursor-pointer hover:scale-105' : greyed ? 'cursor-not-allowed' : ''
                    }`}
                    onClick={() => editingDeck && !greyed && addCard(c.cardCode)}
                  >
                    <Card
                      cardCode={c.cardCode}
                      small
                      greyed={greyed}
                    />
                    {editingDeck && count > 0 && (
                      <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center z-10">
                        {count}/{max}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {filteredCards.length === 0 && (
              <p className="text-gray-600 text-sm text-center py-12">No cards match your filters</p>
            )}
          </div>
        </div>

        {/* Right panel — Deck Editor (visible when editing) */}
        {editingDeck && (
          <div className="w-[260px] flex flex-col border-l border-board-accent/30 bg-board-surface/30 shrink-0">
            {/* Deck header */}
            <div className={`p-3 border-b border-board-accent/30 ${HERO_BG_MAP[editingDeck.heroClass] || ''}`}>
              <input
                type="text"
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                maxLength={30}
                className="w-full bg-black/30 text-white font-bold rounded-lg px-2.5 py-1.5 text-sm border border-gray-700 focus:border-blue-500 focus:outline-none"
              />
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs font-bold ${editingCards.length === DECK_SIZE ? 'text-green-400' : 'text-yellow-400'}`}>
                  {editingCards.length}/{DECK_SIZE} cards
                </span>
                <span className="text-[10px] text-gray-500">
                  {HERO_CLASSES.find(h => h.id === editingDeck.heroClass)?.label}
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-1 bg-gray-800 rounded-full mt-1.5">
                <div
                  className={`h-1 rounded-full transition-all ${editingCards.length === DECK_SIZE ? 'bg-green-500' : 'bg-yellow-500'}`}
                  style={{ width: `${(editingCards.length / DECK_SIZE) * 100}%` }}
                />
              </div>
            </div>

            {/* Mana curve */}
            <div className="px-3 py-2 border-b border-board-accent/30">
              <div className="flex items-end gap-0.5 h-8">
                {MANA_FILTERS.map(m => (
                  <div key={m} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-blue-500/50 rounded-t-sm transition-all"
                      style={{ height: `${((manaCurve[m] || 0) / maxCurveValue) * 28}px` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-0.5">
                {MANA_FILTERS.map(m => (
                  <div key={m} className="flex-1 text-center text-[8px] text-gray-600">
                    {m === 7 ? '7+' : m}
                  </div>
                ))}
              </div>
            </div>

            {/* Card list */}
            <div className="flex-1 overflow-y-auto">
              {editingGrouped.length === 0 ? (
                <p className="text-gray-600 text-xs text-center py-8">Click cards to add them</p>
              ) : (
                <div className="py-1">
                  {editingGrouped.map(({ code, def, count }) => (
                    <button
                      key={code}
                      onClick={() => removeCard(code)}
                      className="w-full flex items-center gap-2 px-3 py-1 hover:bg-red-500/10 transition-colors cursor-pointer text-left group"
                    >
                      <span className="w-4 h-4 rounded bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                        {def.manaCost}
                      </span>
                      <span className="text-xs text-gray-300 truncate flex-1 group-hover:text-red-300">
                        {def.name}
                      </span>
                      {count > 1 && (
                        <span className="text-[10px] text-yellow-400 font-bold shrink-0">x{count}</span>
                      )}
                      <span className="text-[10px] text-gray-700 group-hover:text-red-400 shrink-0">&#10005;</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Validation + save */}
            <div className="p-3 border-t border-board-accent/30 space-y-2">
              {validation && validation.errors.length > 0 && (
                <div className="max-h-16 overflow-y-auto">
                  {validation.errors.slice(0, 3).map((e, i) => (
                    <p key={i} className="text-[10px] text-red-400">{e}</p>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-green-600 text-white font-bold py-2 rounded-lg text-xs hover:brightness-110 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Done'}
                </button>
                <button
                  onClick={() => setEditingDeck(null)}
                  className="px-3 bg-board-accent text-gray-400 py-2 rounded-lg text-xs hover:bg-board-accent/80 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hero Class Picker Modal */}
      {showHeroPicker && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <div className="bg-board-surface rounded-2xl p-6 border border-board-accent max-w-md w-full mx-4">
            <h2 className="text-white font-bold text-lg text-center mb-1">Choose a Hero</h2>
            <p className="text-gray-500 text-xs text-center mb-5">Select a class for your new deck</p>
            <div className="grid grid-cols-2 gap-3">
              {HERO_CLASSES.map(h => (
                <button
                  key={h.id}
                  onClick={() => startNewDeck(h.id)}
                  className={`${h.color} text-white font-bold py-4 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-lg`}
                >
                  {h.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowHeroPicker(false)}
              className="w-full mt-4 text-gray-500 text-sm cursor-pointer hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
