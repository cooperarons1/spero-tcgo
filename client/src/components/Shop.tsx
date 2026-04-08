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

// Bundle pricing — must match server/index.ts PACK_BUNDLE_COSTS table.
// Single source-of-truth lives on the server; this is just for the UI
// disabled states / labels.
const BUNDLE_COSTS: Record<number, number> = { 1: 100, 5: 450, 10: 800 };

// Premium gem tiers — must match server GEM_PURCHASE_TIERS.
const GEM_TIERS = [
  { id: 'starter', gems: 100,  usd: 0.99 },
  { id: 'bundle',  gems: 550,  usd: 4.99, bonus: '+10%' },
  { id: 'big',     gems: 1200, usd: 9.99, bonus: '+20%' },
  { id: 'mega',    gems: 2750, usd: 19.99, bonus: '+37%' },
];

// Premium gem-priced shop items — must match server GEM_SHOP_ITEMS.
const GEM_ITEMS = [
  { id: 'premium_pack',     gems: 100, label: 'Premium Pack',           desc: 'Guaranteed Legendary' },
  { id: 'cardback_gold',    gems: 500, label: 'Gold Foil Card Back',    desc: 'Exclusive cosmetic' },
  { id: 'cardback_dragon',  gems: 800, label: 'Dragonscale Card Back',  desc: 'Exclusive cosmetic' },
];

export function Shop({ onBack, onOpenPacks }: ShopProps) {
  const [gold, setGold] = useState(0);
  const [dust, setDust] = useState(0);
  const [gems, setGems] = useState(0);
  const [purchaseMsg, setPurchaseMsg] = useState<string | null>(null);

  useEffect(() => {
    socket.emit('get-inventory');
    const onInventory = (data: { gold: number; dust: number; gems?: number }) => {
      setGold(data.gold);
      setDust(data.dust);
      setGems(data.gems ?? 0);
    };
    const onGemsPurchased = (data: { gemsAdded: number; newGems: number; usdCharged: number }) => {
      setGems(data.newGems);
      setPurchaseMsg(`+${data.gemsAdded} gems ($${data.usdCharged.toFixed(2)})`);
      setTimeout(() => setPurchaseMsg(null), 2500);
    };
    const onGemsSpent = (data: { itemId: string; gemsSpent: number; newGems: number }) => {
      setGems(data.newGems);
      setPurchaseMsg(`Spent ${data.gemsSpent} gems`);
      setTimeout(() => setPurchaseMsg(null), 2500);
    };
    const onGemsError = (msg: string) => {
      setPurchaseMsg(`Error: ${msg}`);
      setTimeout(() => setPurchaseMsg(null), 2500);
    };
    socket.on('inventory-update', onInventory);
    socket.on('gems-purchased', onGemsPurchased);
    socket.on('gems-spent', onGemsSpent);
    socket.on('gems-error', onGemsError);
    return () => {
      socket.off('inventory-update', onInventory);
      socket.off('gems-purchased', onGemsPurchased);
      socket.off('gems-spent', onGemsSpent);
      socket.off('gems-error', onGemsError);
    };
  }, []);

  // Generic bundle handler — server validates the count and total cost
  // against PACK_BUNDLE_COSTS, so the client can't send count=1000.
  const handleBuyBundle = (count: number) => {
    const cost = BUNDLE_COSTS[count];
    if (cost == null || gold < cost) return;
    socket.emit('open-pack', { count });
    onOpenPacks();
  };
  const handleBuyPack = () => handleBuyBundle(1);

  const handleBuyGems = (tierId: string) => {
    // STUB: no real Stripe integration yet. Server is in dev-stub mode
    // and will credit gems immediately. The user-visible label still
    // shows the USD price so the future flow looks the same.
    socket.emit('purchase-gems', { tierId });
  };

  const handleSpendGems = (itemId: string) => {
    socket.emit('spend-gems', { itemId });
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
          <span className="text-pink-400 font-bold text-sm flex items-center gap-1"><span>💎</span>{gems} Gems</span>
        </div>
      </div>

      {/* Purchase toast */}
      {purchaseMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-pink-600/90 text-white font-bold px-5 py-2 rounded-full shadow-2xl animate-fade-in">
          {purchaseMsg}
        </div>
      )}

      {/* Shop content — animate-slide-up gives the whole panel a single
          coherent entrance instead of all sections snapping in. */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-8 animate-slide-up">

          {/* ═══ Premium: Spend Gems ═══ */}
          {/* Gems-priced items go ABOVE gold packs because they're the
              monetization driver. Each tile shows the gem cost on a
              pink-purple gradient to keep the premium currency
              visually distinct from the amber gold tiles below. */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-pink-300/80 font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <span>💎</span> Premium Items
              </h2>
              <span className="text-pink-400/60 text-[10px] uppercase tracking-wider">Spend Gems</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {GEM_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleSpendGems(item.id)}
                  disabled={gems < item.gems}
                  className="bg-gradient-to-br from-purple-900/60 via-pink-900/40 to-stone-900/80 border-2 border-pink-500/40 rounded-2xl p-5 text-center hover:border-pink-400 hover:brightness-110 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group"
                >
                  <div className="text-3xl mb-2 group-hover:scale-110 transition-transform inline-block">💎</div>
                  <div className="text-white font-bold text-sm">{item.label}</div>
                  <div className="text-pink-200/60 text-[10px] mt-1">{item.desc}</div>
                  <div className="mt-3 bg-pink-600/80 text-white font-bold py-2 px-4 rounded-lg text-sm flex items-center justify-center gap-1">
                    <span>💎</span> {item.gems}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ═══ Buy Gems with USD ═══ */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-pink-300/80 font-bold text-sm uppercase tracking-wider">Buy Gems</h2>
              <span className="text-pink-400/60 text-[10px] uppercase tracking-wider">Real Money</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {GEM_TIERS.map(tier => (
                <button
                  key={tier.id}
                  onClick={() => handleBuyGems(tier.id)}
                  className="bg-gradient-to-br from-pink-800/60 to-purple-900/80 border border-pink-500/30 rounded-xl p-4 text-center hover:border-pink-400/60 hover:brightness-110 active:scale-95 transition-all cursor-pointer relative"
                >
                  {tier.bonus && (
                    <div className="absolute -top-2 -right-2 bg-amber-500 text-stone-900 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full">
                      {tier.bonus}
                    </div>
                  )}
                  <div className="text-2xl mb-1">💎</div>
                  <div className="text-white font-bold text-sm">{tier.gems}</div>
                  <div className="text-pink-300/70 text-[10px] mt-1">${tier.usd.toFixed(2)}</div>
                </button>
              ))}
            </div>
          </div>

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
                onClick={() => handleBuyBundle(5)}
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
                onClick={() => handleBuyBundle(10)}
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
