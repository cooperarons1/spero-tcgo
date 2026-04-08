import { useState, useEffect } from 'react';
import { socket } from '../socket';
import { Card } from './Card';

interface PackCard {
  cardCode: string;
  rarity: string;
  isNew: boolean;
}

interface PackOpeningProps {
  onBack: () => void;
  gold: number;
}

const RARITY_GLOW: Record<string, string> = {
  COMMON: 'shadow-gray-400/50',
  RARE: 'shadow-blue-500/60',
  EPIC: 'shadow-purple-500/60',
  LEGENDARY: 'shadow-yellow-400/70',
};

const RARITY_BORDER: Record<string, string> = {
  COMMON: 'border-gray-400',
  RARE: 'border-blue-400',
  EPIC: 'border-purple-500',
  LEGENDARY: 'border-yellow-400',
};

export function PackOpening({ onBack, gold }: PackOpeningProps) {
  const [opening, setOpening] = useState(false);
  const [cards, setCards] = useState<PackCard[] | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [dustGained, setDustGained] = useState(0);
  const [currentGold, setCurrentGold] = useState(gold);
  const [currentDust, setCurrentDust] = useState(0);
  const [error, setError] = useState('');

  // Fetch real gold balance on mount
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
    const onPackOpened = (data: { cards: PackCard[]; dustGained: number; newGold: number; newDust: number }) => {
      setCards(data.cards);
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

  const handleOpenPack = () => {
    if (currentGold < 100) {
      setError('Not enough gold (need 100)');
      return;
    }
    setOpening(true);
    setError('');
    setCards(null);
    socket.emit('open-pack');
  };

  const revealCard = (index: number) => {
    setRevealed(prev => {
      const next = [...prev];
      next[index] = true;
      return next;
    });
  };

  const revealAll = () => {
    setRevealed(prev => prev.map(() => true));
  };

  const allRevealed = cards && revealed.every(r => r);

  const resetPack = () => {
    setCards(null);
    setRevealed([]);
    setDustGained(0);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-amber-800/30 bg-stone-900/50 shrink-0">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm cursor-pointer">
          &larr; Back
        </button>
        <h1 className="text-lg font-bold text-amber-100 tracking-wide">OPEN PACKS</h1>
        <div className="flex items-center gap-3">
          <span className="text-yellow-400 font-bold text-sm">{currentGold} Gold</span>
          <span className="text-blue-400 font-bold text-sm">{currentDust} Dust</span>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {!cards ? (
          // Pack selection screen
          <div className="text-center">
            {/* Pack visual — tears back-and-forth when opening (felt
                more "ripping" than the generic Tailwind animate-pulse) */}
            <div
              className={`w-48 h-64 mx-auto mb-6 rounded-xl border-4 border-amber-600 bg-gradient-to-b from-amber-800 via-amber-900 to-stone-900 shadow-2xl shadow-amber-600/30 flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-transform ${opening ? 'animate-pack-tear' : ''}`}
              onClick={!opening ? handleOpenPack : undefined}
            >
              <div className="text-4xl mb-2">✨</div>
              <div className="text-amber-200 font-extrabold text-lg">MIRO</div>
              <div className="text-amber-400/60 text-xs font-bold tracking-wider">CARD PACK</div>
              <div className="mt-4 text-amber-300/80 text-xs">5 Cards</div>
            </div>

            {!opening ? (
              <button
                onClick={handleOpenPack}
                disabled={currentGold < 100}
                className="bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold py-3 px-8 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-amber-500/50"
              >
                Open Pack — 100 Gold
              </button>
            ) : (
              <div className="text-amber-300 animate-pulse font-bold">Opening...</div>
            )}

            {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          </div>
        ) : (
          // Card reveal screen
          <div className="text-center w-full max-w-3xl">
            <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
              {cards.map((card, i) => (
                <div
                  key={i}
                  className="relative cursor-pointer"
                  onClick={() => !revealed[i] && revealCard(i)}
                >
                  {revealed[i] ? (
                    // Revealed card — flips in via the new card-flip-in
                    // keyframe (was a dead animate-[flipIn_...] reference
                    // before today). Legendary reveals get a golden burst
                    // flare layered behind the card.
                    <div className="relative animate-card-flip-in">
                      {card.rarity === 'LEGENDARY' && (
                        <div
                          className="pointer-events-none absolute top-1/2 left-1/2 w-[200px] h-[200px] rounded-full animate-legendary-burst"
                          style={{
                            background: 'radial-gradient(circle, rgba(253,224,71,0.85) 0%, rgba(253,224,71,0.4) 30%, rgba(253,224,71,0) 70%)',
                          }}
                        />
                      )}
                      <Card cardCode={card.cardCode} className={`!w-[140px] !h-[200px] shadow-xl ${RARITY_GLOW[card.rarity]}`} />
                      {card.isNew && (
                        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-10">
                          NEW
                        </div>
                      )}
                      {!card.isNew && (
                        <div className="absolute -top-2 -right-2 bg-gray-600 text-gray-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-10">
                          EXTRA
                        </div>
                      )}
                    </div>
                  ) : (
                    // Unrevealed — card back with glow hint
                    <div className={`w-[140px] h-[200px] rounded-lg border-2 ${RARITY_BORDER[card.rarity]} bg-gradient-to-b from-amber-800 via-amber-900 to-stone-900 shadow-xl ${RARITY_GLOW[card.rarity]} hover:scale-105 transition-all flex items-center justify-center`}>
                      <div className="text-amber-400/60 text-3xl">?</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              {!allRevealed && (
                <button
                  onClick={revealAll}
                  className="bg-stone-700 text-gray-300 font-bold py-2 px-6 rounded-xl text-sm hover:bg-stone-600 active:scale-95 transition-all cursor-pointer"
                >
                  Reveal All
                </button>
              )}
              {allRevealed && (
                <>
                  {dustGained > 0 && (
                    <span className="text-blue-400 text-sm font-bold">+{dustGained} Dust (from extras)</span>
                  )}
                  <button
                    onClick={resetPack}
                    disabled={currentGold < 100}
                    className="bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold py-2 px-6 rounded-xl text-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-amber-500/50"
                  >
                    Open Another — 100 Gold
                  </button>
                  <button
                    onClick={onBack}
                    className="bg-stone-700 text-gray-300 font-bold py-2 px-6 rounded-xl text-sm hover:bg-stone-600 active:scale-95 transition-all cursor-pointer"
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
