import { useState, useEffect, useRef, useMemo } from 'react';
import { socket } from '../socket';
import { Card, CardBack } from './Card';
import { FEATURE_FLAGS } from '../utils/featureFlags';
import { soundManager } from '../utils/soundManager';

interface PackCard {
  cardCode: string;
  rarity: string;
  isNew: boolean;
}

interface PackOpeningProps {
  onBack: () => void;
  gold: number;
}

const CARDS_PER_PACK = 5;
const REVEAL_STAGGER_MS = 220;

const RARITY_GLOW: Record<string, string> = {
  COMMON: 'shadow-gray-400/40',
  RARE: 'shadow-blue-500/60',
  EPIC: 'shadow-purple-500/70',
  LEGENDARY: 'shadow-yellow-400/80',
};

const RARITY_RING: Record<string, string> = {
  COMMON: 'ring-gray-500/50',
  RARE: 'ring-blue-400',
  EPIC: 'ring-purple-500',
  LEGENDARY: 'ring-yellow-400 animate-pulse',
};

const RARITY_LABEL_COLOR: Record<string, string> = {
  COMMON: 'text-gray-300',
  RARE: 'text-blue-300',
  EPIC: 'text-purple-300',
  LEGENDARY: 'text-yellow-300',
};

const DUST_VALUES: Record<string, number> = {
  COMMON: 5, RARE: 20, EPIC: 100, LEGENDARY: 400,
};

// Bundle costs mirror the server's PACK_BUNDLE_COSTS table.
const BUNDLE_COSTS: Record<number, number> = { 1: 100, 5: 450, 10: 800 };

export function PackOpening({ onBack, gold }: PackOpeningProps) {
  const [opening, setOpening] = useState(false);
  const [cards, setCards] = useState<PackCard[] | null>(null);
  const [packIndex, setPackIndex] = useState(0);        // which pack of the bundle we're on
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [dustGained, setDustGained] = useState(0);
  const [currentGold, setCurrentGold] = useState(gold);
  const [currentDust, setCurrentDust] = useState(0);
  const [error, setError] = useState('');
  const staggerTimersRef = useRef<number[]>([]);

  // Cards for the currently displayed pack (slice of the bundle's total).
  const currentPackCards = useMemo(() => {
    if (!cards) return [];
    return cards.slice(packIndex * CARDS_PER_PACK, (packIndex + 1) * CARDS_PER_PACK);
  }, [cards, packIndex]);
  const currentPackStart = packIndex * CARDS_PER_PACK;
  const totalPacks = cards ? Math.max(1, Math.ceil(cards.length / CARDS_PER_PACK)) : 1;
  const isLastPack = packIndex + 1 >= totalPacks;

  // Fetch real gold balance on mount + listen for updates.
  useEffect(() => {
    socket.emit('get-inventory');
    const onInventory = (data: { gold: number; dust: number }) => {
      setCurrentGold(data.gold);
      setCurrentDust(data.dust);
    };
    socket.on('inventory-update', onInventory);
    return () => { socket.off('inventory-update', onInventory); };
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 3500);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    const onPackOpened = (data: { cards: PackCard[]; dustGained: number; newGold: number; newDust: number }) => {
      setCards(data.cards);
      setPackIndex(0);
      setDustGained(data.dustGained);
      setCurrentGold(data.newGold);
      setCurrentDust(data.newDust);
      setRevealed(new Array(data.cards.length).fill(false));
      setOpening(false);
    };
    const onPackError = (msg: string) => {
      setError(msg);
      setOpening(false);
    };
    socket.on('pack-opened', onPackOpened);
    socket.on('pack-error', onPackError);
    return () => {
      socket.off('pack-opened', onPackOpened);
      socket.off('pack-error', onPackError);
    };
  }, []);

  // Cancel any pending stagger timers on pack change / unmount.
  useEffect(() => {
    return () => {
      staggerTimersRef.current.forEach(t => clearTimeout(t));
      staggerTimersRef.current = [];
    };
  }, []);

  // Auto-stagger reveal: when a pack group appears, flip cards in 220ms
  // apart. The user can still click individual cards to reveal them
  // earlier, and "Reveal All" still works. Legendary plays a louder
  // flourish sound.
  useEffect(() => {
    if (!cards || currentPackCards.length === 0) return;
    // Clear any prior timers
    staggerTimersRef.current.forEach(t => clearTimeout(t));
    staggerTimersRef.current = [];
    for (let i = 0; i < currentPackCards.length; i++) {
      const absIdx = currentPackStart + i;
      const card = currentPackCards[i];
      const t = window.setTimeout(() => {
        setRevealed(prev => {
          if (prev[absIdx]) return prev;   // already revealed by click
          const next = [...prev];
          next[absIdx] = true;
          return next;
        });
        soundManager.play(card.rarity === 'LEGENDARY' ? 'RANK_UP' : 'CARD_DRAW');
      }, (i + 1) * REVEAL_STAGGER_MS);
      staggerTimersRef.current.push(t);
    }
    return () => {
      staggerTimersRef.current.forEach(t => clearTimeout(t));
      staggerTimersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, packIndex]);

  const handleOpenPack = (count: number = 1) => {
    const cost = BUNDLE_COSTS[count] ?? 100;
    if (currentGold < cost) {
      setError(`Not enough gold (need ${cost})`);
      return;
    }
    setOpening(true);
    setError('');
    setCards(null);
    setRevealed([]);
    setPackIndex(0);
    soundManager.play('CARD_PLAY');
    socket.emit('open-pack', { count });
  };

  const revealCard = (absIdx: number) => {
    setRevealed(prev => {
      if (prev[absIdx]) return prev;
      const next = [...prev];
      next[absIdx] = true;
      return next;
    });
    const card = cards?.[absIdx];
    if (card) {
      soundManager.play(card.rarity === 'LEGENDARY' ? 'RANK_UP' : 'CARD_DRAW');
    }
  };

  const revealAllInPack = () => {
    setRevealed(prev => {
      const next = [...prev];
      for (let i = currentPackStart; i < currentPackStart + currentPackCards.length; i++) {
        next[i] = true;
      }
      return next;
    });
  };

  const allInPackRevealed = currentPackCards.every((_, i) => revealed[currentPackStart + i]);
  const allRevealed = cards?.every((_, i) => revealed[i]) ?? false;

  const nextPack = () => {
    staggerTimersRef.current.forEach(t => clearTimeout(t));
    staggerTimersRef.current = [];
    setPackIndex(i => i + 1);
  };

  const resetPack = () => {
    staggerTimersRef.current.forEach(t => clearTimeout(t));
    staggerTimersRef.current = [];
    setCards(null);
    setRevealed([]);
    setDustGained(0);
    setPackIndex(0);
  };

  // Rarity breakdown across the whole bundle — shown in the final summary.
  const rarityBreakdown = useMemo(() => {
    const b: Record<string, number> = { COMMON: 0, RARE: 0, EPIC: 0, LEGENDARY: 0 };
    cards?.forEach(c => { b[c.rarity] = (b[c.rarity] ?? 0) + 1; });
    return b;
  }, [cards]);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-amber-800/30 bg-stone-900/50 shrink-0">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm cursor-pointer">
          &larr; Back
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-lg font-bold text-amber-100 tracking-wide">OPEN PACKS</h1>
          {cards && totalPacks > 1 && (
            <span className="text-[10px] text-amber-400/70 font-bold tracking-wider mt-0.5">
              PACK {packIndex + 1} OF {totalPacks}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-yellow-400 font-bold text-sm">{currentGold} Gold</span>
          {FEATURE_FLAGS.DUST && <span className="text-blue-400 font-bold text-sm">{currentDust} Dust</span>}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto">
        {!cards ? (
          // ── Pack selection screen ────────────────────────────────
          <div className="text-center">
            <div
              className={`w-48 h-64 mx-auto mb-6 rounded-xl border-4 border-amber-600 bg-gradient-to-b from-amber-800 via-amber-900 to-stone-900 shadow-2xl shadow-amber-600/30 flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-transform ${opening ? 'animate-pack-tear' : ''}`}
              onClick={!opening ? () => handleOpenPack(1) : undefined}
            >
              <div className="text-4xl mb-2">✨</div>
              <div className="text-amber-200 font-extrabold text-lg">MIRO</div>
              <div className="text-amber-400/60 text-xs font-bold tracking-wider">CARD PACK</div>
              <div className="mt-4 text-amber-300/80 text-xs">5 Cards</div>
            </div>

            {!opening ? (
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={() => handleOpenPack(1)}
                  disabled={currentGold < 100}
                  className="bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold py-3 px-6 rounded-xl text-base hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-amber-500/50"
                >
                  Open 1 — 100 Gold
                </button>
                <button
                  onClick={() => handleOpenPack(5)}
                  disabled={currentGold < 450}
                  className="bg-gradient-to-r from-amber-700 to-amber-800 text-white font-bold py-3 px-6 rounded-xl text-base hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-amber-500/50 relative"
                >
                  <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">-10%</span>
                  Open 5 — 450 Gold
                </button>
                <button
                  onClick={() => handleOpenPack(10)}
                  disabled={currentGold < 800}
                  className="bg-gradient-to-r from-purple-700 to-purple-900 text-white font-bold py-3 px-6 rounded-xl text-base hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-purple-500/50 relative"
                >
                  <span className="absolute -top-2 -right-2 bg-purple-400 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">-20%</span>
                  Open 10 — 800 Gold
                </button>
              </div>
            ) : (
              <div className="text-amber-300 animate-pulse font-bold text-lg">Ripping pack...</div>
            )}

            {error && <p className="text-red-400 text-sm mt-4 font-bold animate-pulse">{error}</p>}
          </div>
        ) : (
          // ── Card reveal screen ───────────────────────────────────
          <div className="text-center w-full max-w-5xl">
            <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
              {currentPackCards.map((card, i) => {
                const absIdx = currentPackStart + i;
                const isRevealed = revealed[absIdx];
                return (
                  <div
                    key={absIdx}
                    className="relative cursor-pointer"
                    onClick={() => !isRevealed && revealCard(absIdx)}
                  >
                    {isRevealed ? (
                      <div className="relative animate-card-flip-in">
                        {card.rarity === 'LEGENDARY' && (
                          <div
                            className="pointer-events-none absolute top-1/2 left-1/2 w-[220px] h-[220px] rounded-full animate-legendary-burst"
                            style={{
                              transform: 'translate(-50%, -50%)',
                              background: 'radial-gradient(circle, rgba(253,224,71,0.85) 0%, rgba(253,224,71,0.4) 30%, rgba(253,224,71,0) 70%)',
                            }}
                          />
                        )}
                        <div className={`rounded-lg ring-2 ${RARITY_RING[card.rarity]} shadow-xl ${RARITY_GLOW[card.rarity]}`}>
                          <Card cardCode={card.cardCode} className="!w-[140px] !h-[200px]" />
                        </div>
                        {card.isNew ? (
                          <div className="absolute -top-2 -right-2 bg-green-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-md z-10 tracking-wider">
                            NEW!
                          </div>
                        ) : (
                          <div className="absolute -top-2 -right-2 bg-stone-700 border border-blue-400/60 text-blue-300 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow-md z-10">
                            +{DUST_VALUES[card.rarity] ?? 5}💎
                          </div>
                        )}
                        <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-black tracking-widest ${RARITY_LABEL_COLOR[card.rarity]} drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]`}>
                          {card.rarity}
                        </div>
                      </div>
                    ) : (
                      // Unrevealed — use the real CardBack component with a
                      // subtle rarity-tinted outer ring as a foreshadow.
                      <div className={`rounded-lg ring-2 ${RARITY_RING[card.rarity]} shadow-xl ${RARITY_GLOW[card.rarity]} transition-all hover:scale-105`}>
                        <CardBack size="md" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {!allInPackRevealed && (
                <button
                  onClick={revealAllInPack}
                  className="bg-stone-700 text-gray-300 font-bold py-2 px-5 rounded-xl text-sm hover:bg-stone-600 active:scale-95 transition-all cursor-pointer"
                >
                  Reveal All
                </button>
              )}
              {allInPackRevealed && !isLastPack && (
                <button
                  onClick={nextPack}
                  className="bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold py-2 px-6 rounded-xl text-base hover:brightness-110 active:scale-95 transition-all cursor-pointer border border-amber-500/50 shadow-lg"
                >
                  Next Pack &rarr;
                </button>
              )}
              {allRevealed && (
                <>
                  {/* Bundle summary */}
                  <div className="w-full mt-4 mb-2 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-4 text-sm flex-wrap justify-center">
                      {(['LEGENDARY','EPIC','RARE','COMMON'] as const).map(r => (
                        rarityBreakdown[r] > 0 && (
                          <span key={r} className={`${RARITY_LABEL_COLOR[r]} font-bold`}>
                            {rarityBreakdown[r]} {r.charAt(0) + r.slice(1).toLowerCase()}
                          </span>
                        )
                      ))}
                    </div>
                    {FEATURE_FLAGS.DUST && dustGained > 0 && (
                      <span className="text-blue-400 text-sm font-bold">+{dustGained}💎 Dust (from extras)</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleOpenPack(1)}
                    disabled={currentGold < 100}
                    className="bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold py-2 px-5 rounded-xl text-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-amber-500/50"
                  >
                    Open Another — 100 Gold
                  </button>
                  {currentGold >= 450 && (
                    <button
                      onClick={() => handleOpenPack(5)}
                      className="bg-gradient-to-r from-amber-700 to-amber-800 text-white font-bold py-2 px-5 rounded-xl text-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer border border-amber-500/50"
                    >
                      Open 5 — 450 Gold
                    </button>
                  )}
                  <button
                    onClick={onBack}
                    className="bg-stone-700 text-gray-300 font-bold py-2 px-5 rounded-xl text-sm hover:bg-stone-600 active:scale-95 transition-all cursor-pointer"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
