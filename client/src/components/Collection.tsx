import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import cardData from '../../../data/cards.json';
import { DECK_SIZE, MAX_COPIES_PER_CARD, MAX_COPIES_LEGENDARY } from '../../../shared/deckRules';
import { validateDeck } from '../../../shared/deckRules';
import { loadDecks, saveDeck, deleteDeck, generateId, type DeckList } from '../utils/deckStorage';
import { Card } from './Card';
import { socket } from '../socket';
import type { HeroClass, CardDef } from '../../../shared/types';
import { CARD_BACKS } from '../../../shared/seasons';
import { COINS } from '../../../shared/cosmetics';
import { FEATURE_FLAGS } from '../utils/featureFlags';

const CRAFT_COSTS: Record<string, number> = { COMMON: 40, RARE: 100, EPIC: 400, LEGENDARY: 1600 };
const DUST_VALUES: Record<string, number> = { COMMON: 5, RARE: 20, EPIC: 100, LEGENDARY: 400 };

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

const KEYWORD_DESCRIPTIONS: Record<string, string> = {
  TAUNT: 'Enemies must attack this minion first.',
  CHARGE: 'Can attack immediately when played.',
  DIVINE_SHIELD: 'The first damage this minion takes is ignored.',
  BATTLECRY: 'Does something when you play it from your hand.',
  DEATHRATTLE: 'Does something when this minion dies.',
  FREEZE: 'Frozen characters lose their next attack.',
  WINDFURY: 'Can attack twice each turn.',
  STEALTH: 'Cannot be targeted until it attacks.',
  SECRET: 'Hidden until a specific action triggers it.',
  COMBO: 'A bonus if you already played a card this turn.',
  BOND: 'Gets a bonus when its partner is on the board.',
  ORRA_CHARGE: 'Gains a charge each turn. Triggers at max charges.',
  END_OF_TURN: 'Triggers at the end of your turn.',
};

// Hero portrait images (PNG for heroes that have them, fallback to colored circle)
const HERO_PORTRAIT_IMGS: Partial<Record<string, string>> = {
  JIMMY: '/heroes/JIMMY.png',
  TALA: '/heroes/TALA.png',
  DEREK: '/heroes/DEREK.png',
};

const HERO_ACCENT: Record<string, string> = {
  JIMMY: '#dc2626', TALA: '#16a34a', DEREK: '#ca8a04', ANDERS: '#2563eb',
  DES: '#7c3aed', ASTRID: '#eab308', AVA: '#db2777', LUCAS: '#0d9488',
  IZZY: '#ea580c', NEUTRAL: '#6b7280',
};

function getCardDef(code: string): CardDef | undefined {
  return cardsByCode.get(code);
}

const MANA_FILTERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function Collection({ uid, onBack }: CollectionProps) {
  const [decks, setDecks] = useState<DeckList[]>([]);
  // Long-press / hover preview of a deck (shows card list + mana curve).
  // Desktop: hover to open, leave to close.
  // Mobile: touch-and-hold 400ms to open, tap away to close.
  const [deckPreview, setDeckPreview] = useState<DeckList | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [filterRarity, setFilterRarity] = useState<'ALL' | 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'>('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'MINION' | 'SPELL' | 'WEAPON' | 'LOCATION'>('ALL');

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Card hover preview
  const [hoveredCard, setHoveredCard] = useState<{ code: string; x: number; y: number } | null>(null);

  // Pagination
  const [page, setPage] = useState(0);
  const [pageDir, setPageDir] = useState<'left' | 'right' | null>(null);
  const [animating, setAnimating] = useState(false);
  const CARDS_PER_PAGE = 20; // 5 cols × 4 rows — fills the viewport better than 15

  // Crafting state
  const [craftingCard, setCraftingCard] = useState<string | null>(null);
  const [dust, setDust] = useState(0);
  const [ownedCards, setOwnedCards] = useState<Record<string, number>>({});
  const [ownedGolden, setOwnedGolden] = useState<Record<string, number>>({});
  const [craftError, setCraftError] = useState<string | null>(null);
  // Cosmetics picker (card backs).
  const [showCosmetics, setShowCosmetics] = useState(false);
  const [ownedCardBacks, setOwnedCardBacks] = useState<string[]>(['default']);
  const [selectedCardBack, setSelectedCardBack] = useState<string>('default');
  const [ownedCoins, setOwnedCoins] = useState<string[]>(['default']);
  const [selectedCoin, setSelectedCoin] = useState<string>('default');

  // Load inventory on mount
  useEffect(() => {
    socket.emit('get-inventory');
    const onInventory = (data: { dust: number; ownedCards: Record<string, number>; ownedGolden?: Record<string, number> }) => {
      setDust(data.dust);
      setOwnedCards(data.ownedCards);
      setOwnedGolden(data.ownedGolden ?? {});
    };
    const onCraftSuccess = (data: { cardCode: string; newDust: number; newCount: number }) => {
      setDust(data.newDust);
      setOwnedCards(prev => ({ ...prev, [data.cardCode]: data.newCount }));
      setCraftingCard(null);
      setCraftError(null);
    };
    const onDisenchantSuccess = (data: { cardCode: string; newDust: number; newCount: number }) => {
      setDust(data.newDust);
      setOwnedCards(prev => ({ ...prev, [data.cardCode]: data.newCount }));
      setCraftingCard(null);
      setCraftError(null);
    };
    const onCraftError = (data: { message?: string } | string) => {
      const msg = typeof data === 'string' ? data : (data?.message ?? 'Craft failed');
      setCraftError(msg);
      // Auto-clear after 4s so the toast doesn't linger
      setTimeout(() => setCraftError(null), 4000);
    };
    const onCardBacks = (data: { owned: string[]; selected: string }) => {
      setOwnedCardBacks(data.owned ?? ['default']);
      setSelectedCardBack(data.selected ?? 'default');
    };
    const onCoins = (data: { owned: string[]; selected: string }) => {
      setOwnedCoins(data.owned ?? ['default']);
      setSelectedCoin(data.selected ?? 'default');
    };
    socket.on('inventory-update', onInventory);
    socket.on('craft-success', onCraftSuccess);
    socket.on('disenchant-success', onDisenchantSuccess);
    socket.on('craft-error', onCraftError);
    socket.on('disenchant-error', onCraftError);
    socket.on('card-backs-update', onCardBacks);
    socket.on('coins-update', onCoins);
    socket.emit('get-card-backs');
    socket.emit('get-coins');
    return () => {
      socket.off('inventory-update', onInventory);
      socket.off('craft-success', onCraftSuccess);
      socket.off('disenchant-success', onDisenchantSuccess);
      socket.off('card-backs-update', onCardBacks);
      socket.off('coins-update', onCoins);
      socket.off('craft-error', onCraftError);
      socket.off('disenchant-error', onCraftError);
    };
  }, []);

  // Clear stale error when user closes the craft modal
  useEffect(() => {
    if (!craftingCard) setCraftError(null);
  }, [craftingCard]);

  const refresh = useCallback(async () => {
    const d = await loadDecks(uid);
    setDecks(d);
    setLoading(false);
  }, [uid]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-filter to editing deck's class + neutral. Dep on the whole deck
  // object so switching decks with the same id (unlikely but possible
  // during quick-edit flows) still re-fires, and filterClass stays in
  // sync with the deck being edited.
  useEffect(() => {
    if (editingDeck) {
      setFilterClass(editingDeck.heroClass);
    }
  }, [editingDeck]);

  const filteredCards = useMemo(() => {
    return allCards.filter(c => {
      // Hide tokens and Coin from collection
      if (c.cardCode === 'COIN') return false;
      if (c.heroClass === 'NEUTRAL' && c.rarity === 'COMMON' && c.cardCode.startsWith('TOK')) return false;

      if (filterClass !== 'ALL') {
        // When filtering by a specific hero class, include NEUTRAL too
        // because decks can only legally hold class + neutral cards —
        // seeing other classes is never useful while editing a deck.
        // Explicit NEUTRAL filter still shows only neutrals.
        if (filterClass === 'NEUTRAL') {
          if (c.heroClass !== 'NEUTRAL') return false;
        } else if (c.heroClass !== filterClass && c.heroClass !== 'NEUTRAL') {
          return false;
        }
      }
      if (filterMana !== null) {
        if (filterMana === 10) {
          if (c.manaCost < 10) return false;
        } else {
          if (c.manaCost !== filterMana) return false;
        }
      }
      if (filterRarity !== 'ALL' && c.rarity !== filterRarity) return false;
      if (filterType !== 'ALL' && c.type !== filterType) return false;
      if (filterSearch && !c.name.toLowerCase().includes(filterSearch.toLowerCase())) return false;
      return true;
    }).sort((a, b) => a.manaCost - b.manaCost || a.name.localeCompare(b.name));
  }, [filterClass, filterMana, filterSearch, filterRarity, filterType]);

  // Reset page (and clear slide-direction) on filter change so the grid
  // doesn't animate with a stale direction from the last paginate click.
  useEffect(() => {
    setPage(0);
    setPageDir(null);
  }, [filterClass, filterMana, filterSearch, filterRarity, filterType]);

  // Expand each card into tiles. Golden pair is feature-flagged off
  // while the real per-card animation approach is being designed as
  // a side project; flip FEATURE_FLAGS.COLLECTION_GOLDEN_TILES back
  // to true once that lands.
  const expandedCards = useMemo(() => {
    const out: { def: CardDef; golden: boolean }[] = [];
    for (const c of filteredCards) {
      out.push({ def: c, golden: false });
      if (FEATURE_FLAGS.COLLECTION_GOLDEN_TILES) {
        out.push({ def: c, golden: true });
      }
    }
    return out;
  }, [filteredCards]);

  const totalPages = Math.max(1, Math.ceil(expandedCards.length / CARDS_PER_PAGE));
  const paginatedCards = expandedCards.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE);

  // Card counts per filter category (computed from class-filtered base, excluding tokens)
  const filterCounts = useMemo(() => {
    const base = allCards.filter(c => {
      if (c.cardCode === 'COIN') return false;
      if (c.heroClass === 'NEUTRAL' && c.rarity === 'COMMON' && c.cardCode.startsWith('TOK')) return false;
      if (filterClass !== 'ALL') {
        if (filterClass === 'NEUTRAL') {
          if (c.heroClass !== 'NEUTRAL') return false;
        } else if (c.heroClass !== filterClass && c.heroClass !== 'NEUTRAL') {
          return false;
        }
      }
      return true;
    });
    return {
      rarity: {
        ALL: base.length,
        COMMON: base.filter(c => c.rarity === 'COMMON').length,
        RARE: base.filter(c => c.rarity === 'RARE').length,
        EPIC: base.filter(c => c.rarity === 'EPIC').length,
        LEGENDARY: base.filter(c => c.rarity === 'LEGENDARY').length,
      },
      type: {
        ALL: base.length,
        MINION: base.filter(c => c.type === 'MINION').length,
        SPELL: base.filter(c => c.type === 'SPELL').length,
        WEAPON: base.filter(c => c.type === 'WEAPON').length,
        LOCATION: base.filter(c => c.type === 'LOCATION').length,
      },
    };
  }, [filterClass]);

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
        const bucket = Math.min(def.manaCost, 10);
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

  // Collection stats
  const collectionStats = useMemo(() => {
    const collectible = allCards.filter(c => c.cardCode !== 'COIN' && !c.cardCode.includes('_TOKEN_'));
    let totalOwned = 0;
    let totalPossible = 0;
    for (const c of collectible) {
      const max = c.rarity === 'LEGENDARY' ? 1 : 2;
      totalPossible += max;
      totalOwned += Math.min(ownedCards[c.cardCode] ?? 0, max);
    }
    const uniqueOwned = collectible.filter(c => (ownedCards[c.cardCode] ?? 0) > 0).length;
    return {
      uniqueOwned,
      totalCards: collectible.length,
      totalOwned,
      totalPossible,
      pct: totalPossible > 0 ? Math.round((totalOwned / totalPossible) * 100) : 0,
    };
  }, [ownedCards]);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50 shrink-0">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm cursor-pointer">
          &larr; Back
        </button>
        <div className="text-center">
          <h1 className="text-lg font-bold text-amber-100 tracking-wide">MY COLLECTION</h1>
          <div className="flex items-center gap-3 justify-center text-[10px] text-gray-500">
            <span>{collectionStats.uniqueOwned}/{collectionStats.totalCards} cards</span>
            <span>{collectionStats.pct}% complete</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCosmetics(true)}
            className="text-[10px] uppercase tracking-wider font-bold text-amber-300 hover:text-amber-200 border border-amber-700/50 rounded-full px-3 py-1 cursor-pointer hover:bg-amber-900/30"
            title="Card backs + coins"
          >
            🎨 Cosmetics
          </button>
          <span className="text-yellow-400 font-bold text-xs">{dust} Dust</span>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* My Decks sidebar — RIGHT side. Slides in slightly after the
            main card grid so the two sides of the screen feel
            choreographed instead of dual-snap-arriving. */}
        <div className="w-56 md:w-[240px] flex flex-col border-l border-amber-800/20 bg-stone-900/50 shrink-0 order-2 animate-slide-up" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
          <div className="p-3 border-b border-amber-800/30 bg-stone-900/50">
            <h2 className="text-sm uppercase tracking-wider text-amber-200/80 font-bold text-center">My Decks</h2>
            <p className="text-[9px] text-gray-500 text-center mt-0.5">{decks.length}/27</p>
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
                    <div
                      key={deck.id}
                      className="relative"
                      onMouseEnter={() => setDeckPreview(deck)}
                      onMouseLeave={() => setDeckPreview(p => (p?.id === deck.id ? null : p))}
                      onTouchStart={() => {
                        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = setTimeout(() => setDeckPreview(deck), 400);
                      }}
                      onTouchEnd={() => {
                        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                      }}
                      onTouchCancel={() => {
                        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                      }}
                    >
                      <button
                        onClick={() => editingDeck ? undefined : startEditing(deck)}
                        className={`w-full text-left rounded-lg text-xs cursor-pointer transition-all overflow-hidden
                          ${isEditing
                            ? 'border-2 border-white/40 shadow-lg'
                            : 'border border-gray-700/50 hover:brightness-125'
                          }
                        `}
                      >
                        {/* Hero portrait background with deck name overlay */}
                        <div className="relative h-12 flex items-end" style={{ backgroundColor: HERO_ACCENT[deck.heroClass] + '33' }}>
                          {HERO_PORTRAIT_IMGS[deck.heroClass] && (
                            <img
                              src={HERO_PORTRAIT_IMGS[deck.heroClass]}
                              alt=""
                              className="absolute right-0 top-0 h-full w-12 object-cover opacity-60"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-r from-stone-900/90 via-stone-900/60 to-transparent" />
                          <div className="relative px-2 pb-1 w-full">
                            <div className="flex items-center gap-1">
                              {deck.isStarterDeck && <span className="text-yellow-400 text-[10px]">&#9733;</span>}
                              <span className="text-white font-bold text-[11px] truncate">{deck.name}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400 text-[9px]">{HERO_CLASSES.find(h => h.id === deck.heroClass)?.label}</span>
                              <span className={`text-[9px] font-bold ${isComplete ? 'text-green-400' : 'text-yellow-400'}`}>
                                {deck.cards.length}/{DECK_SIZE}
                              </span>
                            </div>
                          </div>
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
                        <div className="absolute inset-0 bg-slate-700/95 rounded-lg flex items-center justify-center gap-2 z-10">
                          <span className="text-[10px] text-white">Delete?</span>
                          <button onClick={() => handleDelete(deck.id)} className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded cursor-pointer">Yes</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-[10px] bg-gray-700 text-white px-2 py-0.5 rounded cursor-pointer">No</button>
                        </div>
                      )}
                      {/* Hover / long-press preview — anchored to the
                           LEFT of the deck tile. Shows mana curve + card
                           list so the user can peek without opening the
                           deck for edit. */}
                      {deckPreview?.id === deck.id && !deleteConfirm && (
                        <div className="absolute right-full mr-3 top-0 z-40 bg-stone-900/98 border border-amber-700/40 rounded-lg shadow-2xl w-64 p-3 pointer-events-none">
                          <div className="flex items-center gap-1.5 mb-2">
                            {deck.isStarterDeck && <span className="text-yellow-400 text-[10px]">★</span>}
                            <span className="text-amber-200 font-bold text-xs truncate">{deck.name}</span>
                            <span className="ml-auto text-[9px] text-gray-500">{HERO_CLASSES.find(h => h.id === deck.heroClass)?.label}</span>
                          </div>
                          <div className="flex items-center justify-between mb-2 text-[10px]">
                            <span className="text-gray-400">Cards:</span>
                            <span className={`font-bold ${deck.cards.length === DECK_SIZE ? 'text-green-400' : 'text-yellow-400'}`}>
                              {deck.cards.length}/{DECK_SIZE}
                            </span>
                          </div>
                          {(() => {
                            const seen = new Map<string, { name: string; cost: number; count: number; rarity: string }>();
                            for (const code of deck.cards) {
                              const def = getCardDef(code);
                              if (!def) continue;
                              const prev = seen.get(code);
                              if (prev) prev.count++;
                              else seen.set(code, { name: def.name, cost: def.manaCost, count: 1, rarity: def.rarity });
                            }
                            const rows = [...seen.values()].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
                            return (
                              <div className="max-h-64 overflow-y-auto space-y-0.5">
                                {rows.map(r => (
                                  <div key={r.name} className="flex items-center gap-1.5 text-[10px] py-0.5">
                                    <span className="w-4 h-4 rounded bg-blue-600 text-white text-[8px] font-bold flex items-center justify-center shrink-0">{r.cost}</span>
                                    <span className="text-gray-200 truncate flex-1">{r.name}</span>
                                    {r.count > 1 && <span className="text-amber-300 font-bold shrink-0">×{r.count}</span>}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={() => editingDeck ? undefined : setShowHeroPicker(true)}
                  disabled={!!editingDeck || decks.length >= 27}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-all
                    bg-slate-700/30 text-gray-500 hover:bg-slate-700/50 hover:text-gray-300
                    border border-dashed border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  + New Deck
                </button>
              </>
            )}
          </div>
        </div>

        {/* Card Collection — main area */}
        <div className="flex-1 flex flex-col min-w-0 order-1 animate-slide-up">
          {/* ── Filter bar — compact Hearthstone-style ── */}
          <div className="border-b border-amber-800/30 bg-stone-900/40 shrink-0">
            {/* Row 1: Class tabs */}
            <div className="flex items-center border-b border-slate-700/20 px-2 py-1.5 gap-0.5 overflow-x-auto">
              <button
                onClick={() => setFilterClass('ALL')}
                className={`text-[11px] px-3 py-1 rounded cursor-pointer transition-all whitespace-nowrap ${
                  filterClass === 'ALL' ? 'bg-amber-600 text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                All
              </button>
              {HERO_CLASSES
                // When editing a deck, only show ALL + the deck's own
                // hero + NEUTRAL (the only cards the deck can legally
                // hold). Other hero buttons would just grey everything
                // they filter to, which confuses players.
                .filter(h => !editingDeck || h.id === editingDeck.heroClass)
                .map(h => (
                <button
                  key={h.id}
                  onClick={() => setFilterClass(filterClass === h.id ? 'ALL' : h.id)}
                  className={`text-[11px] px-3 py-1 rounded cursor-pointer transition-all whitespace-nowrap ${
                    filterClass === h.id ? `${h.color} text-white font-bold` : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {h.label}
                </button>
              ))}
              <button
                onClick={() => setFilterClass(filterClass === 'NEUTRAL' as any ? 'ALL' : 'NEUTRAL' as any)}
                className={`text-[11px] px-3 py-1 rounded cursor-pointer transition-all whitespace-nowrap ${
                  filterClass === 'NEUTRAL' ? 'bg-gray-600 text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                Neutral
              </button>
            </div>

            {/* Row 2: Mana curve + Type + Rarity + Search — all in one row */}
            <div className="flex items-center gap-3 px-2 py-1.5">
              {/* Mana filter */}
              <div className="flex gap-px">
                {MANA_FILTERS.map(m => (
                  <button
                    key={m}
                    onClick={() => setFilterMana(filterMana === m ? null : m)}
                    className={`w-5 h-5 text-[9px] font-bold rounded cursor-pointer transition-all flex items-center justify-center ${
                      filterMana === m
                        ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/50'
                        : 'bg-slate-800 text-gray-500 hover:bg-slate-700'
                    }`}
                  >
                    {m === 10 ? '+' : m}
                  </button>
                ))}
              </div>

              <div className="w-px h-4 bg-slate-700" />

              {/* Type filter */}
              <div className="flex gap-0.5">
                {(['ALL', 'MINION', 'SPELL', 'WEAPON', 'LOCATION'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterType(filterType === t ? 'ALL' : t)}
                    className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-all ${
                      filterType === t ? 'bg-slate-600 text-white font-bold' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>

              <div className="w-px h-4 bg-slate-700" />

              {/* Rarity filter */}
              <div className="flex gap-0.5">
                {(['ALL', 'COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const).map(r => {
                  const dotColor: Record<string, string> = { ALL: '', COMMON: 'bg-gray-400', RARE: 'bg-blue-400', EPIC: 'bg-purple-400', LEGENDARY: 'bg-yellow-400' };
                  return (
                    <button
                      key={r}
                      onClick={() => setFilterRarity(filterRarity === r ? 'ALL' : r)}
                      className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-all flex items-center gap-1 ${
                        filterRarity === r ? 'bg-slate-600 text-white font-bold' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {r !== 'ALL' && <span className={`w-1.5 h-1.5 rounded-full ${dotColor[r]}`} />}
                      {r === 'ALL' ? 'All' : r.charAt(0) + r.slice(1).toLowerCase()}
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              <input
                type="text"
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="Search..."
                className="ml-auto w-28 text-[11px] bg-slate-800 text-white rounded px-2 py-1 border border-slate-700 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Card grid — paginated with slide animation */}
          <div className="flex-1 flex flex-col bg-slate-900/80 overflow-hidden">
            <div className="flex-1 flex items-start justify-center p-3 pt-4 relative">
              <div
                key={`page-${page}`}
                className={`grid grid-cols-5 gap-2.5 w-full max-w-4xl ${
                  pageDir === 'left' ? 'animate-page-slide-in-left' : 'animate-page-slide-in-right'
                }`}
              >
                {paginatedCards.map(entry => {
                  const c = entry.def;
                  const tileKey = `${c.cardCode}${entry.golden ? '_G' : ''}`;
                  const count = editingCounts.get(c.cardCode) || 0;
                  const max = c.rarity === 'LEGENDARY' ? MAX_COPIES_LEGENDARY : MAX_COPIES_PER_CARD;
                  const isMaxed = editingDeck ? count >= max : false;
                  const isWrongClass = editingDeck
                    ? c.heroClass !== 'NEUTRAL' && c.heroClass !== editingDeck.heroClass
                    : false;
                  // Golden variants are not-yet-playable as deck slots
                  // (they use the same cardCode in-deck); the variant
                  // is purely cosmetic on owned copies. Don't allow
                  // clicking the gold tile to add cards in editing mode.
                  const greyed = isMaxed || isWrongClass || (!!editingDeck && entry.golden);
                  const ownedCount = entry.golden
                    ? (ownedGolden[c.cardCode] ?? 0)
                    : (ownedCards[c.cardCode] ?? 0);
                  return (
                    <div
                      key={tileKey}
                      className={`relative transition-all select-none ${
                        editingDeck && !greyed ? 'cursor-pointer hover:scale-105' : greyed ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-105'
                      }`}
                      onClick={() => editingDeck ? (!greyed && addCard(c.cardCode)) : setCraftingCard(c.cardCode)}
                      onMouseEnter={(e) => setHoveredCard({ code: c.cardCode, x: e.clientX, y: e.clientY })}
                      onMouseMove={(e) => hoveredCard && setHoveredCard({ code: c.cardCode, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      <Card
                        cardCode={c.cardCode}
                        greyed={greyed}
                        small
                        golden={entry.golden}
                      />
                      {/* The gold tint + shimmer on the card itself
                           already communicates 'this is the golden
                           variant' — removed the redundant GOLDEN text
                           ribbon per user feedback. */}
                      {editingDeck && count > 0 && !entry.golden && (
                        <div className={`absolute top-1 right-1 text-white text-[8px] font-bold px-1 py-0.5 rounded shadow z-10 leading-none ${
                          count >= max ? 'bg-amber-600' : 'bg-stone-900/80 border border-amber-600/60'
                        }`}>
                          ×{count}
                        </div>
                      )}
                      {!editingDeck && ownedCount > 0 && (
                        <div className={`absolute top-1 right-1 bg-stone-900/80 border text-[8px] font-bold px-1 py-0.5 rounded z-10 leading-none ${
                          entry.golden ? 'border-yellow-400/70 text-yellow-300' : 'border-green-500/60 text-green-300'
                        }`}>
                          ×{ownedCount}
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
            {paginatedCards.length === 0 && (
              <p className="text-gray-600 text-sm text-center py-12">No cards match your filters</p>
            )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-6 py-2.5 border-t border-stone-700/30 shrink-0">
                <button
                  onClick={() => { setPageDir('left'); setPage(p => Math.max(0, p - 1)); }}
                  disabled={page === 0}
                  className="text-gray-400 hover:text-amber-300 text-2xl font-bold px-4 py-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  &#9664;
                </button>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => { setPageDir(i > page ? 'right' : 'left'); setPage(i); }}
                      className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                        i === page ? 'bg-amber-400 scale-125' : 'bg-gray-600 hover:bg-gray-400'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => { setPageDir('right'); setPage(p => Math.min(totalPages - 1, p + 1)); }}
                  disabled={page >= totalPages - 1}
                  className="text-gray-400 hover:text-amber-300 text-2xl font-bold px-4 py-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  &#9654;
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Deck Editor panel — far right when editing */}
        {editingDeck && (
          <div className="hidden md:flex md:w-[260px] flex-col border-l border-slate-700/30 bg-slate-800/30 shrink-0 order-3">
            {/* Deck header */}
            <div className={`p-3 border-b border-slate-700/30 ${HERO_BG_MAP[editingDeck.heroClass] || ''}`}>
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
            <div className="px-3 py-2 border-b border-slate-700/30">
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
                    {m === 10 ? '10+' : m}
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
            <div className="p-3 border-t border-slate-700/30 space-y-2">
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
                  className="px-3 bg-slate-700 text-gray-400 py-2 rounded-lg text-xs hover:bg-slate-700/80 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card hover preview with keyword tooltips */}
      {hoveredCard && (() => {
        const def = getCardDef(hoveredCard.code);
        if (!def) return null;
        const px = hoveredCard.x > window.innerWidth / 2 ? hoveredCard.x - 240 : hoveredCard.x + 20;
        const py = Math.max(8, Math.min(hoveredCard.y - 60, window.innerHeight - 400));
        const keywords = (def.keywords || []).filter((k: string) => KEYWORD_DESCRIPTIONS[k]);
        return (
          // Use CSS scale instead of overriding w/h: the Card's internal
          // text + badges are sized for the base 140×200, so forcing a
          // larger w/h breaks proportions (text looks tiny). scale(1.5)
          // on the wrapper keeps everything in sync.
          <div className="fixed z-[60] pointer-events-none" style={{ left: px, top: py, transform: 'scale(1.5)', transformOrigin: 'top left' }}>
            <Card cardCode={hoveredCard.code} className="shadow-2xl" />
            {keywords.length > 0 && (
              <div className="mt-1.5 bg-stone-900/95 border border-amber-700/40 rounded-lg px-3 py-2 max-w-[200px] shadow-xl">
                {keywords.map((kw: string) => (
                  <div key={kw} className="mb-1 last:mb-0">
                    <span className="text-amber-300 font-bold text-[10px]">
                      {kw === 'DIVINE_SHIELD' ? 'Divine Shield' :
                       kw === 'END_OF_TURN' ? 'End of Turn' :
                       kw === 'ORRA_CHARGE' ? 'Orra Charge' :
                       kw.charAt(0) + kw.slice(1).toLowerCase()}
                    </span>
                    <span className="text-gray-400 text-[9px] ml-1">
                      {KEYWORD_DESCRIPTIONS[kw]}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {def.minionType && (
              <div className="mt-1 bg-stone-900/95 border border-amber-700/40 rounded-lg px-3 py-1 max-w-[200px] shadow-xl">
                <span className="text-amber-200 font-bold text-[10px]">Tribe: </span>
                <span className="text-gray-300 text-[10px]">{def.minionType}</span>
              </div>
            )}
            {def.flavor && (
              <div className="mt-1 bg-stone-900/95 border border-stone-700/40 rounded-lg px-3 py-1.5 max-w-[200px] shadow-xl">
                <p className="text-gray-500 text-[9px] italic leading-snug">{def.flavor}</p>
              </div>
            )}
          </div>
        );
      })()}

      {/* Cosmetics modal — card-back picker. */}
      {showCosmetics && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setShowCosmetics(false)}>
          <div className="bg-stone-900 border-2 border-amber-700/50 rounded-2xl p-6 max-w-3xl w-full mx-4 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-amber-100">Cosmetics</h2>
                <p className="text-xs text-gray-500 mt-0.5">Pick a favorite card back. More unlock via ranked, seasons, and battle pass.</p>
              </div>
              <button
                onClick={() => setShowCosmetics(false)}
                className="text-gray-500 hover:text-white text-2xl leading-none"
              >×</button>
            </div>

            <h3 className="text-xs uppercase tracking-wider font-bold text-amber-300/80 mb-2 flex items-center gap-2">
              Card Backs
              <span className="text-[9px] font-normal text-gray-500 normal-case tracking-normal">({ownedCardBacks.length} owned)</span>
            </h3>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {CARD_BACKS.map(cb => {
                const owned = ownedCardBacks.includes(cb.id);
                const selected = selectedCardBack === cb.id;
                const style = (cb as any).style;
                const bg = style?.type === 'image' && style?.value
                  ? { backgroundImage: `url('${style.value}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : style?.type === 'gradient' && style?.value
                  ? { background: style.value as string }
                  : { background: '#1f2937' };
                return (
                  <button
                    key={cb.id}
                    disabled={!owned}
                    onClick={() => {
                      socket.emit('select-card-back', { cardBackId: cb.id });
                    }}
                    className={`relative rounded-lg overflow-hidden aspect-[5/7] border-2 transition-all cursor-pointer group
                      ${selected ? 'border-green-400 shadow-[0_0_16px_rgba(74,222,128,0.6)] scale-105' : 'border-amber-700/40 hover:border-amber-400'}
                      ${!owned ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="absolute inset-0" style={bg} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-1 left-1 right-1 text-center">
                      <p className="text-white text-[10px] font-bold drop-shadow leading-tight truncate">{cb.name}</p>
                    </div>
                    {!owned && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <span className="text-white text-2xl">🔒</span>
                      </div>
                    )}
                    {selected && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold shadow">✓</div>
                    )}
                  </button>
                );
              })}
            </div>

            <h3 className="text-xs uppercase tracking-wider font-bold text-amber-300/80 mb-2 mt-6 flex items-center gap-2">
              Coins
              <span className="text-[9px] font-normal text-gray-500 normal-case tracking-normal">({ownedCoins.length} owned)</span>
            </h3>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {COINS.map(co => {
                const owned = ownedCoins.includes(co.id);
                const selected = selectedCoin === co.id;
                const unlockLabel = co.unlock.type === 'BASE' ? 'Free'
                  : co.unlock.type === 'BATTLEPASS' ? `BP T${(co.unlock as any).tier}`
                  : co.unlock.type === 'RANKED' ? `Rank ${(co.unlock as any).minRank}`
                  : co.unlock.type === 'SEASONAL' ? (co.unlock as any).season
                  : 'Unlock';
                return (
                  <button
                    key={co.id}
                    disabled={!owned}
                    onClick={() => socket.emit('select-coin', { coinId: co.id })}
                    className={`relative rounded-lg overflow-hidden aspect-square border-2 transition-all cursor-pointer group flex items-center justify-center
                      ${selected ? 'border-green-400 shadow-[0_0_16px_rgba(74,222,128,0.6)] scale-105' : 'border-amber-700/40 hover:border-amber-400'}
                      ${!owned ? 'opacity-40 cursor-not-allowed' : ''}`}
                    style={{ background: 'radial-gradient(circle at 50% 45%, #fcd34d 0%, #d97706 55%, #78350f 100%)' }}
                  >
                    <div className="w-10 h-10 rounded-full border-2 border-amber-200 bg-gradient-to-b from-yellow-300 to-amber-600 shadow-inner flex items-center justify-center text-stone-900 font-black text-sm">
                      {co.id === 'default' ? 'M' : co.name.slice(0, 1)}
                    </div>
                    <div className="absolute bottom-1 left-1 right-1 text-center">
                      <p className="text-white text-[9px] font-bold drop-shadow leading-tight truncate">{co.name}</p>
                      <p className="text-amber-100/70 text-[8px] leading-tight">{owned ? 'Owned' : unlockLabel}</p>
                    </div>
                    {!owned && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                        <span className="text-white text-xl">🔒</span>
                      </div>
                    )}
                    {selected && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold shadow">✓</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Crafting Modal */}
      {craftingCard && (() => {
        const def = getCardDef(craftingCard);
        if (!def) return null;
        const owned = ownedCards[craftingCard] ?? 0;
        const maxCopies = def.rarity === 'LEGENDARY' ? 1 : 2;
        const craftCost = CRAFT_COSTS[def.rarity] ?? 40;
        const dustValue = DUST_VALUES[def.rarity] ?? 5;
        const canCraft = owned < maxCopies && dust >= craftCost;
        const canDisenchant = owned > 0;
        return (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={() => setCraftingCard(null)}>
            <div className="bg-stone-800 rounded-2xl p-6 border border-amber-700/40 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-4">
                <Card cardCode={craftingCard} className="!w-[120px] !h-[171px] shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-lg">{def.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
                      backgroundColor: def.rarity === 'LEGENDARY' ? '#f59e0b' : def.rarity === 'EPIC' ? '#a855f7' : def.rarity === 'RARE' ? '#3b82f6' : '#9ca3af',
                      color: def.rarity === 'LEGENDARY' ? '#000' : '#fff',
                    }}>
                      {def.rarity}
                    </span>
                    <span className="text-gray-400 text-xs">{def.type}</span>
                    {def.minionType && <span className="text-amber-400/70 text-xs">{def.minionType}</span>}
                  </div>
                  <p className="text-gray-400 text-xs mt-2">{def.text || 'No text.'}</p>
                  <div className="mt-3 text-sm">
                    <span className="text-gray-500">Owned: </span>
                    <span className="text-white font-bold">{owned}/{maxCopies}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => socket.emit('craft-card', { cardCode: craftingCard })}
                  disabled={!canCraft}
                  className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Craft — {craftCost} Dust
                </button>
                <button
                  onClick={() => socket.emit('disenchant-card', { cardCode: craftingCard })}
                  disabled={!canDisenchant}
                  className="flex-1 bg-red-600/80 text-white font-bold py-2.5 rounded-xl text-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Disenchant — +{dustValue} Dust
                </button>
              </div>

              <div className="text-center mt-3">
                <span className="text-blue-400 text-xs font-bold">Your Dust: {dust}</span>
              </div>
              {craftError && (
                <div className="mt-3 rounded-lg bg-red-900/60 border border-red-500/50 px-3 py-2 text-center">
                  <span className="text-red-200 text-xs font-semibold">{craftError}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Hero Class Picker Modal */}
      {showHeroPicker && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
          onClick={() => setShowHeroPicker(false)}
        >
          <div
            className="bg-slate-800 rounded-2xl p-6 border border-slate-700 max-w-md w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
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
