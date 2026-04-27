import { useState, useEffect, useMemo } from 'react';
import { loadDecks, getSelectedDeckId, setSelectedDeckId, type DeckList } from '../utils/deckStorage';
import { loadHeroLevels, type HeroLevelsMap } from '../utils/heroLevels';
import { DECK_SIZE } from '../../../shared/deckRules';
import { socket } from '../socket';
import type { CardDef, HeroClass } from '../../../shared/types';
import cardData from '../../../data/cards.json';
import { assetUrl } from '../config';

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
  JIMMY:  '/heroes/JIMMY.webp',
  TALA:   '/heroes/TALA.webp',
  DEREK:  '/heroes/DEREK.webp',
  ANDERS: '/heroes/ANDERS.webp',
  DES:    '/heroes/DES.webp',
  ASTRID: '/heroes/ASTRID.webp',
  AVA:    '/heroes/AVA.webp',
  LUCAS:  '/heroes/LUCAS.webp',
  IZZY:   '/heroes/IZZY.webp',
};

const MANA_BUCKETS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export function DeckPicker({ mode, queueMode = 'casual', uid, onBack }: DeckPickerProps) {
  const [decks, setDecks] = useState<DeckList[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [matchmaking, setMatchmaking] = useState(false);
  const [queueStartTime, setQueueStartTime] = useState<number | null>(null);
  const [queueElapsed, setQueueElapsed] = useState(0);
  const [heroLevels, setHeroLevels] = useState<HeroLevelsMap>({});

  useEffect(() => {
    loadHeroLevels(uid).then(setHeroLevels);
  }, [uid]);

  // Queue elapsed timer
  useEffect(() => {
    if (!matchmaking || !queueStartTime) {
      setQueueElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setQueueElapsed(Math.floor((Date.now() - queueStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [matchmaking, queueStartTime]);

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
        }
      }
    });
  }, [uid]);

  // Persist selectedId to localStorage in a dedicated effect so the write
  // happens reliably even if the component unmounts before setState batches.
  useEffect(() => {
    if (selectedId) setSelectedDeckId(selectedId);
  }, [selectedId]);

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
    // setSelectedDeckId is driven by the selectedId effect above to avoid
    // duplicate writes / race with unmount.
    setSelectedId(id);
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
      setQueueStartTime(Date.now());
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
    setQueueStartTime(null);
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
          <div className="bg-stone-800 rounded-2xl p-8 border border-amber-700/30 text-center shadow-2xl max-w-sm w-full mx-4">
            <div className="w-14 h-14 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-amber-100 font-bold text-lg mb-1">Searching for Opponent...</p>

            {/* Elapsed timer */}
            <p className="text-amber-400/80 font-mono text-sm mb-3">
              {Math.floor(queueElapsed / 60)}:{String(queueElapsed % 60).padStart(2, '0')}
            </p>

            {/* ELO range status */}
            <div className="mb-5 space-y-1">
              {queueElapsed < 30 && (
                <p className="text-gray-400 text-sm">Matching similar skill level</p>
              )}
              {queueElapsed >= 30 && queueElapsed < 60 && (
                <p className="text-amber-300/80 text-sm font-medium">Expanding search range...</p>
              )}
              {queueElapsed >= 60 && (
                <p className="text-amber-200 text-sm font-medium">Searching all ranks...</p>
              )}

              {/* Visual range indicator */}
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className="flex gap-0.5">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className={`h-1.5 w-6 rounded-full transition-all duration-700 ${
                        i === 0 ? 'bg-amber-500'
                        : i === 1 && queueElapsed >= 30 ? 'bg-amber-500'
                        : i === 2 && queueElapsed >= 60 ? 'bg-amber-500'
                        : 'bg-stone-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleCancelQueue}
              className="bg-stone-700 text-gray-300 font-bold py-2.5 px-8 rounded-xl hover:bg-stone-600 cursor-pointer transition-all border border-stone-600/40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* ═══ Left: Deck Grid ═══ */}
        {/* Slides up on mount; the right hero panel slides up with a small
            delay so the two halves of the screen feel intentionally
            choreographed instead of both pop-arriving at the same instant. */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 animate-slide-up">
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
          <div className="flex-1 flex flex-col px-6 pt-5 pb-4 min-h-0 overflow-y-auto">
            <h2 className="text-sm text-amber-200/60 font-bold uppercase tracking-wider mb-4 animate-fade-in" style={{ animationDelay: '120ms', animationFillMode: 'both' }}>Choose Your Deck</h2>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-500">Loading decks...</p>
              </div>
            ) : sortedDecks.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-500">No decks yet. Visit Collection to create one!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 w-full">
                {sortedDecks.map(deck => {
                  const isValid = deck.cards.length === DECK_SIZE;
                  const isSelected = selectedId === deck.id;
                  const accent = HERO_ACCENT[deck.heroClass] ?? '#666';
                  const portrait = HERO_PORTRAIT_IMGS[deck.heroClass];
                  return (
                    <button
                      key={deck.id}
                      onClick={() => isValid && handleSelect(deck.id)}
                      disabled={!isValid}
                      className={`relative rounded-lg overflow-hidden transition-all cursor-pointer group
                        ${isSelected
                          ? 'scale-[1.03] z-10'
                          : isValid
                            ? 'hover:brightness-110 hover:scale-[1.01]'
                            : 'opacity-30 cursor-not-allowed'
                        }
                      `}
                      style={{
                        border: isSelected ? `3px solid ${accent}` : '2px solid rgba(80,60,40,0.5)',
                        boxShadow: isSelected ? `0 0 20px ${accent}55` : '0 2px 6px rgba(0,0,0,0.4)',
                      }}
                    >
                      {/* Hero portrait fills entire tile background.
                           Mobile gets a taller aspect (1.4:1) so the
                           single-column tile shows a sizeable portrait
                           instead of a wide+short letterbox. Tablet+
                           keeps the original 2.2:1 banner shape that
                           reads well in a 3-up grid. */}
                      <div className="relative w-full aspect-[1.4/1] sm:aspect-[2/1] md:aspect-[2.2/1]">
                        {portrait ? (
                          <img src={assetUrl(portrait)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50 group-hover:opacity-70 transition-opacity" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: accent + '20' }}>
                            <span className="text-4xl font-extrabold" style={{ color: accent + '60' }}>{HERO_LABELS[deck.heroClass]?.[0]}</span>
                          </div>
                        )}
                        {/* Dark overlay for text readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
                        {/* Class color bar at top */}
                        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: accent }} />

                        {/* Content overlay */}
                        <div className="absolute inset-0 flex flex-col justify-end p-3">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                {deck.isStarterDeck && <span className="text-amber-400 text-xs">&#9733;</span>}
                                <span className="text-white font-bold text-sm truncate">{deck.name}</span>
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 shrink-0 ${
                              isValid ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'
                            }`}>
                              {deck.cards.length}/{DECK_SIZE}
                            </span>
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

        {/* ═══ Right: Hero Preview Panel — Hearthstone style on tablet+;
             stacks below the deck grid on phone with a max-h cap so it
             doesn't push the grid offscreen. ═══ */}
        <div className="w-full md:w-[320px] flex flex-col border-t md:border-t-0 md:border-l border-amber-900/20 bg-stone-900/50 shrink-0 max-h-72 md:max-h-none overflow-y-auto md:overflow-visible animate-slide-up" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
          {selectedDeck ? (() => {
            const hl = heroLevels[selectedDeck.heroClass as HeroClass];
            const heroLevel = hl?.level ?? 1;
            const heroWins = hl?.wins ?? 0;
            const heroPortrait = HERO_PORTRAIT_IMGS[selectedDeck.heroClass];
            const isGolden = heroWins >= 500;
            const accent = HERO_ACCENT[selectedDeck.heroClass] ?? '#666';
            return (
            <>
              {/* Mode badge at top */}
              <div className="flex items-center justify-center gap-3 pt-4 pb-2">
                <div className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                  mode === 'ai' ? 'bg-amber-700/40 text-amber-200 border border-amber-600/30'
                  : queueMode === 'ranked' ? 'bg-purple-700/40 text-purple-200 border border-purple-600/30'
                  : 'bg-blue-700/40 text-blue-200 border border-blue-600/30'
                }`}>
                  {mode === 'ai' ? 'vs AI' : queueMode === 'ranked' ? 'Ranked' : 'Casual'}
                </div>
              </div>

              {/* Large hero portrait — Hearthstone arch frame */}
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                <div className="relative mb-4">
                  {/* Ornate arch frame */}
                  <div className={`w-40 h-48 rounded-t-full rounded-b-lg border-4 overflow-hidden shadow-2xl ${isGolden ? 'shadow-yellow-400/40' : ''}`}
                    style={{ borderColor: isGolden ? '#fbbf24' : accent }}>
                    {heroPortrait ? (
                      <img src={assetUrl(heroPortrait)} alt="" className={`w-full h-full object-cover ${isGolden ? 'saturate-125 brightness-110' : ''}`} />
                    ) : (
                      <div className="w-full h-full bg-stone-800 flex items-center justify-center">
                        <span className="text-5xl font-extrabold" style={{ color: accent + '50' }}>
                          {HERO_LABELS[selectedDeck.heroClass]?.[0]}
                        </span>
                      </div>
                    )}
                    {/* Bottom gradient for text */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  </div>
                  {/* Level badge */}
                  <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 border-2 rounded-full w-10 h-10 flex items-center justify-center shadow-lg ${
                    isGolden ? 'bg-yellow-500 border-yellow-300' : 'bg-stone-700 border-stone-500'
                  }`}>
                    <span className="text-white font-extrabold text-base">{heroLevel}</span>
                  </div>
                  {isGolden && (
                    <div className="absolute -top-1 -right-2 bg-yellow-400 text-yellow-900 text-[8px] font-extrabold px-2 py-0.5 rounded-full shadow-md">
                      GOLDEN
                    </div>
                  )}
                </div>

                {/* Deck name */}
                <h2 className="text-white font-bold text-lg text-center mt-2">{selectedDeck.name}</h2>

                {/* Wins counter */}
                <span className={`text-xs font-bold mt-1 ${isGolden ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {isGolden ? 'Golden Hero!' : `Wins: ${heroWins}/500`}
                </span>
                {!isGolden && (
                  <div className="mt-1 w-32 bg-stone-800 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (heroWins / 500) * 100)}%`, backgroundColor: accent }} />
                  </div>
                )}
              </div>
            </>
          );
          })() : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-600 text-sm">Select a deck</p>
            </div>
          )}

          {/* Play button — large centered like Hearthstone */}
          <div className="flex flex-col items-center gap-3 p-6">
            <button
              onClick={handleStart}
              disabled={!isValidDeck || starting || matchmaking}
              className="w-36 h-36 rounded-full bg-gradient-to-br from-green-500 to-green-700 text-white font-extrabold text-2xl hover:brightness-110 hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(34,197,94,0.4)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:scale-100 border-4 border-green-400/60 flex items-center justify-center"
            >
              {starting ? '...' : matchmaking ? 'Finding…' : 'Play'}
            </button>
            <button
              onClick={onBack}
              className="text-gray-500 text-sm hover:text-gray-300 cursor-pointer transition-colors bg-stone-800/60 border border-stone-700/50 rounded-lg px-6 py-1.5"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
