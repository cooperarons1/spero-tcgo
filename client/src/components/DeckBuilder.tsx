import { useState, useMemo, useEffect } from 'react';
import cardData from '../../../data/cards.json';
import { validateDeck, DECK_SIZE, MAX_COPIES_PER_CARD } from '../../../shared/deckRules';
import { saveDeck, generateId, type DeckList } from '../utils/deckStorage';
import { getCardDef } from '../utils/stackHelpers';
import { Card } from './Card';
import { DeckStats } from './DeckStats';
import { DeckCardGhost } from './DeckCardGhost';
import { useDeckBuilderDrag } from '../hooks/useDeckBuilderDrag';

interface DeckBuilderProps {
  deck: DeckList | null;
  uid: string;
  onBack: () => void;
}

const COLORS = ['red', 'blue', 'green', 'yellow', 'black', 'none'] as const;
const TYPES = ['CHARACTER', 'EQUIPMENT', 'ACTION', 'COMBAT TRICK'] as const;

const COLOR_LABELS: Record<string, string> = {
  red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow', black: 'Black', none: 'Colorless',
};

export function DeckBuilder({ deck: initialDeck, uid, onBack }: DeckBuilderProps) {
  const [deckName, setDeckName] = useState(initialDeck?.name ?? 'New Deck');
  const [deckCards, setDeckCards] = useState<string[]>(initialDeck?.cards ?? []);
  const [deckId] = useState(initialDeck?.id ?? generateId());
  const [createdAt] = useState(initialDeck?.createdAt ?? Date.now());
  const [isStarter] = useState(initialDeck?.isStarterDeck ?? false);
  const [saving, setSaving] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Filters
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');

  const drag = useDeckBuilderDrag();

  const allCards = useMemo(() => cardData as any[], []);

  const filteredCards = useMemo(() => {
    return allCards.filter(c => {
      if (filterColor && c.color !== filterColor) return false;
      if (filterType && c.typeA !== filterType) return false;
      if (filterSearch && !c.name.toLowerCase().includes(filterSearch.toLowerCase())) return false;
      return true;
    }).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  }, [allCards, filterColor, filterType, filterSearch]);

  const deckCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const code of deckCards) {
      counts.set(code, (counts.get(code) || 0) + 1);
    }
    return counts;
  }, [deckCards]);

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

  const handleSave = async () => {
    setSaving(true);
    const deck: DeckList = {
      id: deckId,
      name: deckName.trim() || 'Unnamed Deck',
      cards: deckCards,
      createdAt,
      updatedAt: Date.now(),
      isStarterDeck: isStarter,
    };
    try {
      await saveDeck(uid, deck);
      onBack();
    } catch (err: any) {
      setImportError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const code = btoa(JSON.stringify(deckCards));
    navigator.clipboard.writeText(code);
    setImportError('Deck code copied to clipboard!');
    setTimeout(() => setImportError(null), 2000);
  };

  const handleImport = () => {
    const code = prompt('Paste deck code:');
    if (!code) return;
    try {
      const cards = JSON.parse(atob(code));
      if (!Array.isArray(cards) || cards.some((c: any) => typeof c !== 'string')) {
        setImportError('Invalid deck code format');
        return;
      }
      // Validate cards exist
      for (const c of cards) {
        if (!getCardDef(c)) {
          setImportError(`Unknown card: ${c}`);
          return;
        }
      }
      setDeckCards(cards);
      setImportError(null);
    } catch {
      setImportError('Failed to decode deck code');
    }
  };

  // Drag & drop handlers
  useEffect(() => {
    if (!drag.isDragging && !drag.state) return;

    const onMove = (e: PointerEvent) => drag.updateDrag(e);
    const onUp = (e: PointerEvent) => {
      const result = drag.endDrag();
      if (!result) return;

      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      for (const el of elements) {
        const zone = (el as HTMLElement).dataset?.dropZone;
        if (zone === 'deck' && result.source === 'collection') {
          addCard(result.cardCode);
          return;
        }
        if (zone === 'collection' && result.source === 'deck') {
          removeCard(result.cardCode);
          return;
        }
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  });

  const colorDot: Record<string, string> = {
    red: 'bg-spero-red', blue: 'bg-spero-blue', green: 'bg-spero-green',
    yellow: 'bg-spero-yellow', black: 'bg-spero-black', none: 'bg-gray-500',
  };

  // Group deck by type for display
  const typeGroups = useMemo(() => {
    const groups: Record<string, typeof deckGrouped> = {};
    for (const card of deckGrouped) {
      if (!groups[card.typeA]) groups[card.typeA] = [];
      groups[card.typeA].push(card);
    }
    return groups;
  }, [deckGrouped]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-board-accent bg-board-surface/50 shrink-0">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm cursor-pointer">
          &larr; Back
        </button>
        <h1 className="text-lg font-bold text-white">Deck Builder</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            className="text-gray-400 hover:text-white text-xs px-2 py-1 border border-gray-600 rounded-lg cursor-pointer"
          >
            Import
          </button>
          <button
            onClick={handleExport}
            className="text-gray-400 hover:text-white text-xs px-2 py-1 border border-gray-600 rounded-lg cursor-pointer"
          >
            Export
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !validation.valid}
            className="bg-spero-green text-white font-bold px-4 py-1.5 rounded-lg text-sm hover:brightness-110 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {importError && (
        <div className="px-4 py-2 text-center text-sm text-spero-yellow bg-spero-yellow/10 shrink-0">
          {importError}
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Collection (left 55%) */}
        <div className="w-[55%] flex flex-col border-r border-board-accent/30" data-drop-zone="collection">
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
            <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
              {filteredCards.map((c: any) => {
                const count = deckCounts.get(c.cardCode) || 0;
                const maxed = count >= MAX_COPIES_PER_CARD || deckCards.length >= DECK_SIZE;
                return (
                  <div
                    key={c.cardCode}
                    className={`relative cursor-pointer transition-all select-none ${maxed ? 'opacity-40' : 'hover:scale-105'}`}
                    style={{ touchAction: 'none' }}
                    onClick={() => !maxed && addCard(c.cardCode)}
                    onPointerDown={(e) => {
                      if (!maxed) {
                        drag.startDrag(c.cardCode, 'collection', e.nativeEvent);
                      }
                    }}
                  >
                    <Card
                      card={{ instanceId: c.cardCode, cardCode: c.cardCode, faceUp: true }}
                      size="sm"
                    />
                    {count > 0 && (
                      <span className={`absolute -top-1 -right-1 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                        count >= MAX_COPIES_PER_CARD ? 'bg-gray-500 text-white' : 'bg-spero-yellow text-black'
                      }`}>
                        {count}/{MAX_COPIES_PER_CARD}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Deck panel (right 45%) */}
        <div className="w-[45%] flex flex-col" data-drop-zone="deck">
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

          {/* Deck cards as images */}
          <div className="flex-1 overflow-y-auto p-3">
            {deckGrouped.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">Drag or click cards to add</p>
            ) : (
              <div className="space-y-3">
                {['CHARACTER', 'EQUIPMENT', 'ACTION', 'COMBAT TRICK'].map(type => {
                  const cards = typeGroups[type];
                  if (!cards || cards.length === 0) return null;
                  const typeCount = cards.reduce((s, c) => s + c.count, 0);
                  return (
                    <div key={type}>
                      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{type} ({typeCount})</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {cards.map(card => (
                          <div
                            key={card.code}
                            className="relative cursor-pointer hover:scale-105 transition-all select-none"
                            style={{ touchAction: 'none' }}
                            onClick={() => removeCard(card.code)}
                            onPointerDown={(e) => {
                              drag.startDrag(card.code, 'deck', e.nativeEvent);
                            }}
                          >
                            <Card
                              card={{ instanceId: card.code, cardCode: card.code, faceUp: true }}
                              size="sm"
                            />
                            {card.count > 1 && (
                              <span className="absolute -top-1 -right-1 bg-spero-yellow text-black text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                x{card.count}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Deck Stats */}
          <div className="p-3 border-t border-board-accent/30 shrink-0">
            <DeckStats deckCards={deckCards} />
          </div>
        </div>
      </div>

      {/* Drag ghost */}
      {drag.state && (
        <DeckCardGhost
          cardCode={drag.state.cardCode}
          cursorX={drag.state.cursorX}
          cursorY={drag.state.cursorY}
        />
      )}
    </div>
  );
}
