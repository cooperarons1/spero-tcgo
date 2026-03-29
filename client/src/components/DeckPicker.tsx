import { useState, useEffect, useMemo } from 'react';
import { loadDecks, getSelectedDeckId, setSelectedDeckId, type DeckList } from '../utils/deckStorage';
import { loadHeroLevels, type HeroLevelsMap } from '../utils/heroLevels';
import { DECK_SIZE } from '../../../shared/deckRules';
import { socket } from '../socket';
import type { CardDef, HeroClass } from '../../../shared/types';
import cardData from '../../../data/cards.json';

interface DeckPickerProps {
  mode: 'online' | 'ai';
  queueMode?: 'casual' | 'ranked';
  uid: string;
  onBack: () => void;
}

const allCards = cardData as CardDef[];
const cardsByCode = new Map(allCards.map(c => [c.cardCode, c]));

const HERO_ACCENT: Record<string, string> = {
  JIMMY: '#dc2626', TALA: '#16a34a', DEREK: '#ca8a04', ANDERS: '#2563eb',
  DES: '#7c3aed', ASTRID: '#eab308', AVA: '#db2777', LUCAS: '#0d9488',
  IZZY: '#ea580c', NEUTRAL: '#6b7280',
};

const HERO_GRADIENT: Record<string, string> = {
  JIMMY: 'from-red-900/80 to-red-950/90',
  TALA: 'from-green-900/80 to-green-950/90',
  DEREK: 'from-yellow-900/80 to-yellow-950/90',
  ANDERS: 'from-blue-900/80 to-blue-950/90',
  DES: 'from-purple-900/80 to-purple-950/90',
  ASTRID: 'from-amber-900/80 to-amber-950/90',
  AVA: 'from-pink-900/80 to-pink-950/90',
  LUCAS: 'from-teal-900/80 to-teal-950/90',
  IZZY: 'from-orange-900/80 to-orange-950/90',
};

const HERO_LABELS: Record<string, string> = {
  JIMMY: 'Jimmy', TALA: 'Tala', DEREK: 'Derek', ANDERS: 'Anders',
  DES: 'Des', ASTRID: 'Astrid', AVA: 'Ava', LUCAS: 'Lucas', IZZY: 'Izzy',
};

const HERO_PORTRAIT_IMGS: Partial<Record<string, string>> = {
  JIMMY: '/heroes/JIMMY.png',
  TALA: '/heroes/TALA.png',
  DEREK: '/heroes/DEREK.png',
};

const MANA_BUCKETS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export function DeckPicker({ mode, queueMode = 'casual', uid, onBack }: DeckPickerProps) {
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
        mode: queueMode,
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
    <div className="flex flex-col h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950">
      {/* Matchmaking overlay */}
      {matchmaking && (
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm">
          <div className="bg-stone-800 rounded-2xl p-8 border border-amber-700/30 text-center shadow-2xl">
            <div className="w-14 h-14 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-amber-100 font-bold text-lg mb-2">Searching for Opponent...</p>
            <p className="text-gray-400 text-sm mb-6">This may take a moment</p>
            <button
              onClick={handleCancelQueue}
              className="bg-stone-700 text-gray-300 font-bold py-2 px-8 rounded-xl hover:bg-stone-600 cursor-pointer transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* ═══ Left: Deck Grid ═══ */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-amber-900/20 shrink-0">
            <button onClick={onBack} className="text-gray-400 hover:text-white text-sm cursor-pointer transition-colors">
              &larr; Back
            </button>
            <h1 className="text-base font-bold text-amber-100 tracking-wider uppercase">
              {mode === 'ai' ? 'Play vs AI' : queueMode === 'ranked' ? 'Ranked Match' : 'Casual Match'}
            </h1>
            <div className="w-14" />
          </div>

          {/* Deck grid area */}
          <div className="flex-1 flex flex-col p-6 min-h-0">
            <h2 className="text-sm text-amber-200/60 font-bold uppercase tracking-wider mb-4">Choose Your Deck</h2>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-500">Loading decks...</p>
              </div>
            ) : sortedDecks.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-500">No decks yet. Visit Collection to create one!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto pr-1">
                {sortedDecks.map(deck => {
                  const isValid = deck.cards.length === DECK_SIZE;
                  const isSelected = selectedId === deck.id;
                  const accent = HERO_ACCENT[deck.heroClass] ?? '#666';
                  const gradient = HERO_GRADIENT[deck.heroClass] ?? 'from-stone-800 to-stone-900';
                  const portrait = HERO_PORTRAIT_IMGS[deck.heroClass];
                  return (
                    <button
                      key={deck.id}
                      onClick={() => isValid && handleSelect(deck.id)}
                      disabled={!isValid}
                      className={`relative text-left rounded-xl overflow-hidden transition-all cursor-pointer group
                        ${isSelected
                          ? 'ring-2 shadow-lg scale-[1.02]'
                          : isValid
                            ? 'hover:brightness-125 hover:scale-[1.01]'
                            : 'opacity-30 cursor-not-allowed'
                        }
                      `}
                      style={{
                        ['--tw-ring-color' as any]: isSelected ? accent : undefined,
                        boxShadow: isSelected ? `0 0 20px ${accent}44, 0 0 0 2px ${accent}` : undefined,
                      }}
                    >
                      {/* Background with hero portrait */}
                      <div className={`relative h-[72px] bg-gradient-to-r ${gradient}`}>
                        {portrait && (
                          <img
                            src={portrait}
                            alt=""
                            className="absolute right-0 top-0 h-full w-20 object-cover opacity-40 group-hover:opacity-60 transition-opacity"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />

                        {/* Selected indicator bar */}
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r" style={{ backgroundColor: accent }} />
                        )}

                        {/* Content */}
                        <div className="relative h-full flex flex-col justify-between p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold" style={{ color: accent }}>
                              {HERO_LABELS[deck.heroClass]}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isValid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {deck.cards.length}/{DECK_SIZE}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {deck.isStarterDeck && <span className="text-amber-400 text-xs">&#9733;</span>}
                            <span className="text-white font-bold text-sm truncate">{deck.name}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ═══ Right: Deck Preview Panel ═══ */}
        <div className="w-[280px] md:w-[300px] flex flex-col border-l border-amber-900/20 bg-stone-900/50 shrink-0">
          {selectedDeck ? (() => {
            const hl = heroLevels[selectedDeck.heroClass as HeroClass];
            const heroLevel = hl?.level ?? 1;
            const heroWins = hl?.wins ?? 0;
            const heroPortrait = HERO_PORTRAIT_IMGS[selectedDeck.heroClass];
            const isGolden = heroWins >= 500;
            const accent = HERO_ACCENT[selectedDeck.heroClass] ?? '#666';
            return (
            <>
              {/* Hero portrait area */}
              <div className="flex flex-col items-center pt-6 pb-4 px-4 border-b border-stone-700/30"
                style={{ background: `linear-gradient(180deg, ${accent}15 0%, transparent 100%)` }}>
                {/* Hero portrait in ornate frame */}
                <div className="relative mb-3">
                  <div className={`w-28 h-28 rounded-full border-4 overflow-hidden shadow-xl ${isGolden ? 'shadow-yellow-400/40' : ''}`}
                    style={{ borderColor: isGolden ? '#fbbf24' : accent }}>
                    {heroPortrait ? (
                      <img src={heroPortrait} alt="" className={`w-full h-full object-cover ${isGolden ? 'saturate-125 brightness-110' : ''}`} />
                    ) : (
                      <div className="w-full h-full bg-stone-800 flex items-center justify-center">
                        <span className="text-4xl font-bold" style={{ color: accent + '40' }}>
                          {HERO_LABELS[selectedDeck.heroClass]?.[0]}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Level badge */}
                  <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 border-2 rounded-full w-9 h-9 flex items-center justify-center shadow-lg ${
                    isGolden ? 'bg-yellow-500 border-yellow-300' : 'bg-stone-700 border-stone-500'
                  }`}>
                    <span className="text-white font-extrabold text-sm">{heroLevel}</span>
                  </div>
                  {isGolden && (
                    <div className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-[7px] font-extrabold px-1.5 py-0.5 rounded-full shadow-md">
                      GOLDEN
                    </div>
                  )}
                </div>

                <h2 className="text-white font-bold text-base text-center mt-1">{selectedDeck.name}</h2>
                <span className="text-xs font-bold mt-0.5" style={{ color: accent }}>
                  {HERO_LABELS[selectedDeck.heroClass]}
                </span>

                {/* Wins progress */}
                <div className="mt-2 w-full max-w-[180px]">
                  <div className="text-center text-[10px] mb-0.5">
                    <span className={`font-bold ${isGolden ? 'text-yellow-400' : 'text-gray-500'}`}>
                      {isGolden ? 'Golden Hero!' : `Wins: ${heroWins}/500`}
                    </span>
                  </div>
                  {!isGolden && (
                    <div className="bg-stone-800 rounded-full h-1 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (heroWins / 500) * 100)}%`, backgroundColor: accent }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Orra Curve */}
              <div className="px-4 py-3 border-b border-stone-700/30">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Orra Curve</div>
                <div className="flex items-end gap-1 h-10">
                  {MANA_BUCKETS.map(m => (
                    <div key={m} className="flex-1 flex flex-col items-center">
                      {(manaCurve[m] || 0) > 0 && (
                        <div className="text-[8px] text-gray-500 mb-0.5">{manaCurve[m]}</div>
                      )}
                      <div
                        className="w-full rounded-t transition-all"
                        style={{
                          height: `${((manaCurve[m] || 0) / maxCurveValue) * 24}px`,
                          backgroundColor: accent + '80',
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-1 mt-0.5">
                  {MANA_BUCKETS.map(m => (
                    <div key={m} className="flex-1 text-center text-[8px] text-gray-600">
                      {m === 7 ? '7+' : m}
                    </div>
                  ))}
                </div>
              </div>

              {/* Card list */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {deckCardList.map(({ code, def, count }) => (
                  <div key={code} className="flex items-center gap-2 px-4 py-[3px] hover:bg-white/5 transition-colors">
                    <span className="w-5 h-5 rounded bg-blue-600/80 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {def.manaCost}
                    </span>
                    <span className="text-[12px] text-gray-300 truncate flex-1">{def.name}</span>
                    {count > 1 && (
                      <span className="text-[10px] text-amber-400 font-bold shrink-0">x{count}</span>
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

          {/* Play button */}
          <div className="p-4 border-t border-stone-700/30">
            <button
              onClick={handleStart}
              disabled={!isValidDeck || starting || matchmaking}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white font-bold py-3.5 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-green-900/40 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 border border-green-500/40"
            >
              {starting ? 'Starting...' : matchmaking ? 'Searching...' : mode === 'ai' ? 'Start Game' : 'Find Match'}
            </button>
            <button
              onClick={onBack}
              className="w-full mt-2 text-gray-500 text-xs hover:text-gray-300 cursor-pointer transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
