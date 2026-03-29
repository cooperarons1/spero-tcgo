import { useState, useEffect, useMemo } from 'react';
import { loadDecks, getSelectedDeckId, setSelectedDeckId, type DeckList } from '../utils/deckStorage';
import { loadHeroLevels, type HeroLevelsMap } from '../utils/heroLevels';
import { DECK_SIZE } from '../../../shared/deckRules';
import { socket } from '../socket';
import type { CardDef, HeroClass } from '../../../shared/types';
import cardData from '../../../data/cards.json';
import { Card } from './Card';

interface DeckPickerProps {
  mode: 'online' | 'ai';
  uid: string;
  onBack: () => void;
}

const allCards = cardData as CardDef[];
const cardsByCode = new Map(allCards.map(c => [c.cardCode, c]));

const HERO_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  JIMMY: { bg: 'bg-red-600/20', border: 'border-red-500', text: 'text-red-400' },
  TALA: { bg: 'bg-green-600/20', border: 'border-green-500', text: 'text-green-400' },
  DEREK: { bg: 'bg-yellow-500/20', border: 'border-yellow-400', text: 'text-yellow-400' },
  ANDERS: { bg: 'bg-blue-600/20', border: 'border-blue-500', text: 'text-blue-400' },
  DES: { bg: 'bg-purple-600/20', border: 'border-purple-500', text: 'text-purple-400' },
  ASTRID: { bg: 'bg-yellow-500/20', border: 'border-yellow-400', text: 'text-yellow-300' },
  AVA: { bg: 'bg-pink-600/20', border: 'border-pink-500', text: 'text-pink-400' },
  LUCAS: { bg: 'bg-teal-600/20', border: 'border-teal-500', text: 'text-teal-400' },
  IZZY: { bg: 'bg-orange-600/20', border: 'border-orange-500', text: 'text-orange-400' },
};

const HERO_LABELS: Record<string, string> = {
  JIMMY: 'Jimmy', TALA: 'Tala', DEREK: 'Derek', ANDERS: 'Anders',
  DES: 'Des', ASTRID: 'Astrid', AVA: 'Ava', LUCAS: 'Lucas', IZZY: 'Izzy',
};

const MANA_BUCKETS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export function DeckPicker({ mode, uid, onBack }: DeckPickerProps) {
  const [decks, setDecks] = useState<DeckList[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [matchmaking, setMatchmaking] = useState(false);
  const [heroLevels, setHeroLevels] = useState<HeroLevelsMap>({});

  useEffect(() => {
    loadHeroLevels(uid).then(setHeroLevels);
  }, [uid]);

  useEffect(() => {
    loadDecks(uid).then(d => {
      setDecks(d);
      setLoading(false);
      const savedId = getSelectedDeckId();
      const savedDeck = savedId ? d.find(dk => dk.id === savedId) : null;
      if (savedDeck && savedDeck.cards.length === DECK_SIZE) {
        setSelectedId(savedDeck.id);
      } else {
        const autoSelect = d.find(dk => dk.cards.length === DECK_SIZE);
        if (autoSelect) {
          setSelectedId(autoSelect.id);
          setSelectedDeckId(autoSelect.id);
        }
      }
    });
  }, [uid]);

  const selectedDeck = decks.find(d => d.id === selectedId) ?? null;
  const isValidDeck = selectedDeck && selectedDeck.cards.length === DECK_SIZE;

  const deckCardList = useMemo(() => {
    if (!selectedDeck) return [];
    const seen = new Map<string, { code: string; def: CardDef; count: number }>();
    for (const code of selectedDeck.cards) {
      if (seen.has(code)) {
        seen.get(code)!.count++;
      } else {
        const def = cardsByCode.get(code);
        if (def) seen.set(code, { code, def, count: 1 });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.def.manaCost - b.def.manaCost || a.def.name.localeCompare(b.def.name));
  }, [selectedDeck]);

  const manaCurve = useMemo(() => {
    if (!selectedDeck) return {};
    const curve: Record<number, number> = {};
    for (const code of selectedDeck.cards) {
      const def = cardsByCode.get(code);
      if (def) {
        const bucket = Math.min(def.manaCost, 7);
        curve[bucket] = (curve[bucket] || 0) + 1;
      }
    }
    return curve;
  }, [selectedDeck]);

  const maxCurveValue = Math.max(1, ...Object.values(manaCurve));

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setSelectedDeckId(id);
  };

  const handleStart = () => {
    if (!selectedDeck || !isValidDeck) return;

    if (mode === 'ai') {
      setStarting(true);
      socket.emit('start-ai-game', {
        heroClass: selectedDeck.heroClass,
        deckCards: selectedDeck.cards,
      });
    } else {
      setMatchmaking(true);
      socket.emit('join-queue', {
        heroClass: selectedDeck.heroClass,
        deckCards: selectedDeck.cards,
      });

      const onMatch = () => {
        setMatchmaking(false);
        socket.off('match-found', onMatch);
        socket.off('queue-timeout', onTimeout);
      };
      const onTimeout = () => {
        setMatchmaking(false);
        socket.off('match-found', onMatch);
        socket.off('queue-timeout', onTimeout);
      };
      socket.on('match-found', onMatch);
      socket.on('queue-timeout', onTimeout);
    }
  };

  const handleCancelQueue = () => {
    setMatchmaking(false);
    socket.emit('leave-queue');
  };

  // Sort: valid decks first, then starter decks first
  const sortedDecks = [...decks].sort((a, b) => {
    const aValid = a.cards.length === DECK_SIZE ? 0 : 1;
    const bValid = b.cards.length === DECK_SIZE ? 0 : 1;
    if (aValid !== bValid) return aValid - bValid;
    if (a.isStarterDeck && !b.isStarterDeck) return -1;
    if (!a.isStarterDeck && b.isStarterDeck) return 1;
    return 0;
  });

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-950 to-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50 shrink-0">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm cursor-pointer">
          &larr; Back
        </button>
        <h1 className="text-lg font-bold text-white tracking-wide">
          {mode === 'ai' ? 'PLAY VS AI' : 'FIND MATCH'}
        </h1>
        <div className="w-16" />
      </div>

      {/* Matchmaking overlay */}
      {matchmaking && (
        <div className="fixed inset-0 z-50 bg-black/60 flex flex-col items-center justify-center">
          <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 text-center">
            <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-bold text-lg mb-2">Searching for an Opponent...</p>
            <p className="text-gray-400 text-sm mb-6">This may take a moment</p>
            <button
              onClick={handleCancelQueue}
              className="bg-slate-700 text-gray-300 font-bold py-2 px-6 rounded-xl hover:bg-slate-700/80 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Left — Deck list (70%) */}
        <div className="flex-[7] flex flex-col p-4 md:p-6">
          <h2 className="text-sm uppercase tracking-wider text-gray-500 font-bold mb-4">Choose a Deck</h2>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500">Loading decks...</p>
            </div>
          ) : sortedDecks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500">No decks yet. Visit Collection to create one!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto">
              {sortedDecks.map(deck => {
                const isValid = deck.cards.length === DECK_SIZE;
                const isSelected = selectedId === deck.id;
                const colors = HERO_COLORS[deck.heroClass] ?? HERO_COLORS.JIMMY;
                return (
                  <button
                    key={deck.id}
                    onClick={() => isValid && handleSelect(deck.id)}
                    disabled={!isValid}
                    className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer
                      ${isSelected
                        ? `${colors.bg} ${colors.border} shadow-lg`
                        : isValid
                          ? 'bg-slate-700/50 border-transparent hover:border-gray-600'
                          : 'bg-slate-700/20 border-transparent opacity-40 cursor-not-allowed'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold ${colors.text}`}>
                        {HERO_LABELS[deck.heroClass] || deck.heroClass}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        isValid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {deck.cards.length}/{DECK_SIZE}
                      </span>
                    </div>
                    <h3 className="text-white font-bold text-sm truncate">
                      {deck.isStarterDeck && <span className="text-yellow-400 mr-1">&#9733;</span>}
                      {deck.name}
                    </h3>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right — Selected deck preview (30%) */}
        <div className="flex-[3] flex flex-col border-t md:border-t-0 md:border-l border-slate-700/30 bg-slate-800/30">
          {selectedDeck ? (() => {
            const hl = heroLevels[selectedDeck.heroClass as HeroClass];
            const heroLevel = hl?.level ?? 1;
            const heroWins = hl?.wins ?? 0;
            const heroPortrait = ({ JIMMY: '/heroes/JIMMY.png', TALA: '/heroes/TALA.png', DEREK: '/heroes/DEREK.png' } as Record<string, string>)[selectedDeck.heroClass];
            const isGolden = heroWins >= 500;
            return (
            <>
              {/* Hero portrait + level */}
              <div className={`p-4 border-b border-slate-700/30 ${HERO_COLORS[selectedDeck.heroClass]?.bg ?? ''} flex flex-col items-center`}>
                {/* Hero portrait circle with level badge */}
                <div className="relative mb-2">
                  <div className={`w-24 h-24 rounded-full border-4 overflow-hidden ${isGolden ? 'shadow-lg shadow-yellow-400/50' : ''}`}
                    style={{ borderColor: isGolden ? '#fbbf24' : (HERO_COLORS[selectedDeck.heroClass]?.border.replace('border-', '') || '#666') }}>
                    {heroPortrait ? (
                      <img src={heroPortrait} alt="" className={`w-full h-full object-cover ${isGolden ? 'saturate-150 brightness-110' : ''}`} />
                    ) : (
                      <div className={`w-full h-full ${HERO_COLORS[selectedDeck.heroClass]?.bg ?? 'bg-slate-700'} flex items-center justify-center`}>
                        <span className="text-3xl font-bold text-white/30">{HERO_LABELS[selectedDeck.heroClass]?.[0]}</span>
                      </div>
                    )}
                  </div>
                  {/* Level badge */}
                  <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 ${isGolden ? 'bg-yellow-500 border-yellow-300' : 'bg-amber-600 border-amber-400'} border-2 rounded-full w-8 h-8 flex items-center justify-center shadow-lg`}>
                    <span className="text-white font-extrabold text-xs">{heroLevel}</span>
                  </div>
                  {isGolden && (
                    <div className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-[7px] font-extrabold px-1.5 py-0.5 rounded-full shadow-md">
                      GOLDEN
                    </div>
                  )}
                </div>
                <h2 className="text-white font-bold text-base text-center">{selectedDeck.name}</h2>
                <span className={`text-xs font-bold ${HERO_COLORS[selectedDeck.heroClass]?.text ?? 'text-gray-400'}`}>
                  {HERO_LABELS[selectedDeck.heroClass]}
                </span>
                {/* Wins progress toward golden */}
                <div className="mt-1 w-full max-w-[160px]">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={`font-bold ${isGolden ? 'text-yellow-400' : 'text-gray-500'}`}>
                      {isGolden ? 'Golden Hero!' : `Wins: ${heroWins}/500`}
                    </span>
                  </div>
                  {!isGolden && (
                    <div className="mt-0.5 bg-stone-900 rounded-full h-1 overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (heroWins / 500) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Mana curve */}
              <div className="px-4 py-3 border-b border-slate-700/30">
                <div className="text-[10px] text-gray-600 mb-1">Orra Curve</div>
                <div className="flex items-end gap-0.5 h-10">
                  {MANA_BUCKETS.map(m => (
                    <div key={m} className="flex-1 flex flex-col items-center">
                      <div className="text-[8px] text-gray-600 mb-0.5">{manaCurve[m] || 0}</div>
                      <div
                        className="w-full bg-blue-500/50 rounded-t-sm transition-all"
                        style={{ height: `${((manaCurve[m] || 0) / maxCurveValue) * 24}px` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-0.5">
                  {MANA_BUCKETS.map(m => (
                    <div key={m} className="flex-1 text-center text-[8px] text-gray-600">
                      {m === 7 ? '7+' : m}
                    </div>
                  ))}
                </div>
              </div>

              {/* Card list */}
              <div className="flex-1 overflow-y-auto">
                {deckCardList.map(({ code, def, count }) => (
                  <div key={code} className="flex items-center gap-2 px-4 py-0.5">
                    <span className="w-4 h-4 rounded bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                      {def.manaCost}
                    </span>
                    <span className="text-xs text-gray-300 truncate flex-1">{def.name}</span>
                    {count > 1 && (
                      <span className="text-[10px] text-yellow-400 font-bold">x{count}</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          );
          })() : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-600 text-sm">Select a deck</p>
            </div>
          )}

          {/* Start button */}
          <div className="p-4 border-t border-slate-700/30">
            <button
              onClick={handleStart}
              disabled={!isValidDeck || starting || matchmaking}
              className="w-full bg-green-600 text-white font-bold py-3 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
            >
              {starting ? 'Starting...' : matchmaking ? 'Searching...' : mode === 'ai' ? 'Start Game' : 'Find Match'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
