import { useState, useEffect } from 'react';
import { socket } from '../socket';

interface ShopProps {
  onBack: () => void;
  onOpenPacks: () => void;
}

interface DailyDeal {
  cardCode: string;
  name: string;
  rarity: string;
  originalCost: number;
  discountCost: number;
}

export function Shop({ onBack, onOpenPacks }: ShopProps) {
  const [gold, setGold] = useState(0);
  const [dust, setDust] = useState(0);

  useEffect(() => {
    socket.emit('get-inventory');
    const onInventory = (data: { gold: number; dust: number }) => {
      setGold(data.gold);
      setDust(data.dust);
    };
    socket.on('inventory-update', onInventory);
    return () => { socket.off('inventory-update', onInventory); };
  }, []);

  const handleBuyPack = () => {
    if (gold < 100) return;
    socket.emit('open-pack');
    // The pack opening screen handles the result
    onOpenPacks();
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-amber-800/30 bg-stone-900/50 shrink-0">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm cursor-pointer">
          &larr; Back
        </button>
        <h1 className="text-lg font-bold text-amber-100 tracking-wide">SHOP</h1>
        <div className="flex items-center gap-4">
          <span className="text-yellow-400 font-bold text-sm">{gold} Gold</span>
          <span className="text-blue-400 font-bold text-sm">{dust} Dust</span>
        </div>
      </div>

      {/* Shop content — animate-slide-up gives the whole panel a single
          coherent entrance instead of all sections snapping in. */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-8 animate-slide-up">

          {/* Featured: Miro Pack */}
          <div>
            <h2 className="text-amber-200/80 font-bold text-sm uppercase tracking-wider mb-4">Card Packs</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Single Pack */}
              <button
                onClick={handleBuyPack}
                disabled={gold < 100}
                className="bg-stone-800/80 border-2 border-amber-600/40 rounded-2xl p-6 text-center hover:border-amber-500 hover:bg-stone-800 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="w-20 h-28 mx-auto mb-3 rounded-xl border-2 border-amber-600 bg-gradient-to-b from-amber-800 via-amber-900 to-stone-900 shadow-lg shadow-amber-600/20 flex flex-col items-center justify-center group-hover:scale-105 transition-transform">
                  <div className="text-2xl mb-1">✨</div>
                  <div className="text-amber-200 font-bold text-[10px]">MIRO</div>
                  <div className="text-amber-400/60 text-[7px]">PACK</div>
                </div>
                <div className="text-white font-bold text-sm">Miro Pack</div>
                <div className="text-gray-400 text-xs mt-1">5 Cards</div>
                <div className="mt-3 bg-amber-600/80 text-white font-bold py-2 px-4 rounded-lg text-sm">
                  100 Gold
                </div>
              </button>

              {/* 5 Pack Bundle */}
              <button
                onClick={() => { /* TODO: buy 5 packs */ }}
                disabled={gold < 450}
                className="bg-stone-800/80 border-2 border-amber-600/40 rounded-2xl p-6 text-center hover:border-amber-500 hover:bg-stone-800 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group relative"
              >
                <div className="absolute -top-2 -right-2 bg-green-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">SAVE 10%</div>
                <div className="flex justify-center gap-1 mb-3">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="w-10 h-14 rounded-lg border border-amber-600/60 bg-gradient-to-b from-amber-800 to-stone-900 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform" style={{ transform: `rotate(${(i-3)*4}deg)` }}>
                      <span className="text-xs">✨</span>
                    </div>
                  ))}
                </div>
                <div className="text-white font-bold text-sm">5 Pack Bundle</div>
                <div className="text-gray-400 text-xs mt-1">25 Cards</div>
                <div className="mt-3 bg-amber-600/80 text-white font-bold py-2 px-4 rounded-lg text-sm">
                  450 Gold <span className="text-amber-300/60 line-through text-xs ml-1">500</span>
                </div>
              </button>

              {/* 10 Pack Bundle */}
              <button
                onClick={() => { /* TODO: buy 10 packs */ }}
                disabled={gold < 800}
                className="bg-stone-800/80 border-2 border-purple-600/40 rounded-2xl p-6 text-center hover:border-purple-500 hover:bg-stone-800 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group relative"
              >
                <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">BEST VALUE</div>
                <div className="flex justify-center gap-0.5 mb-3">
                  {[1,2,3,4,5,6,7,8,9,10].map(i => (
                    <div key={i} className="w-6 h-9 rounded border border-purple-600/60 bg-gradient-to-b from-purple-800 to-stone-900 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                      <span className="text-[7px]">✨</span>
                    </div>
                  ))}
                </div>
                <div className="text-white font-bold text-sm">10 Pack Bundle</div>
                <div className="text-gray-400 text-xs mt-1">50 Cards + Bonus Legendary</div>
                <div className="mt-3 bg-purple-600/80 text-white font-bold py-2 px-4 rounded-lg text-sm">
                  800 Gold <span className="text-purple-300/60 line-through text-xs ml-1">1000</span>
                </div>
              </button>
            </div>
          </div>

          {/* Gold Bundles */}
          <div>
            <h2 className="text-amber-200/80 font-bold text-sm uppercase tracking-wider mb-4">Gold (Coming Soon)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { amount: 500, label: '500 Gold' },
                { amount: 1000, label: '1,000 Gold' },
                { amount: 2500, label: '2,500 Gold' },
                { amount: 5000, label: '5,000 Gold' },
              ].map(bundle => (
                <div
                  key={bundle.amount}
                  className="bg-stone-800/60 border border-stone-700/40 rounded-xl p-4 text-center opacity-50"
                >
                  <div className="text-2xl mb-2">🪙</div>
                  <div className="text-white font-bold text-sm">{bundle.label}</div>
                  <div className="text-gray-500 text-xs mt-2">Coming Soon</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
