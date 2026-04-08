import { useState, useEffect } from 'react';
import { socket } from '../socket';
import { BATTLE_PASS_TIERS, SEASON_NAME, MAX_TIER, getTierFromXP, getTierProgress } from '../../../shared/battlePass';

interface BattlePassProps {
  onBack: () => void;
}

interface PlayerBP {
  seasonId: string;
  xp: number;
  tier: number;
  isPremium: boolean;
  claimedFree: number[];
  claimedPremium: number[];
}

const REWARD_ICONS: Record<string, string> = {
  GOLD: '🪙',
  DUST: '💎',
  PACK: '📦',
  CARD_BACK: '🎴',
  HERO_SKIN: '👤',
  NONE: '',
};

const REWARD_COLORS: Record<string, string> = {
  GOLD: 'bg-yellow-600/30 border-yellow-500/40',
  DUST: 'bg-blue-600/30 border-blue-500/40',
  PACK: 'bg-amber-600/30 border-amber-500/40',
  CARD_BACK: 'bg-purple-600/30 border-purple-500/40',
  HERO_SKIN: 'bg-pink-600/30 border-pink-500/40',
  NONE: 'bg-stone-700/30 border-stone-600/40',
};

export function BattlePass({ onBack }: BattlePassProps) {
  const [bp, setBp] = useState<PlayerBP | null>(null);
  const [claimMsg, setClaimMsg] = useState('');

  useEffect(() => {
    socket.emit('get-battlepass');
    const onUpdate = (data: PlayerBP) => setBp(data);
    const onReward = (data: { reward: string }) => {
      setClaimMsg(`Claimed: ${data.reward}`);
      setTimeout(() => setClaimMsg(''), 2000);
    };
    socket.on('battlepass-update', onUpdate);
    socket.on('battlepass-reward-claimed', onReward);
    return () => {
      socket.off('battlepass-update', onUpdate);
      socket.off('battlepass-reward-claimed', onReward);
    };
  }, []);

  if (!bp) {
    return (
      <div className="flex items-center justify-center h-screen bg-stone-950">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const currentTier = getTierFromXP(bp.xp);
  const progress = getTierProgress(bp.xp);

  const handleClaim = (tier: number, track: 'free' | 'premium') => {
    socket.emit('claim-battlepass-reward', { tier, track });
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-amber-800/30 bg-stone-900/50 shrink-0">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm cursor-pointer">
          &larr; Back
        </button>
        <div className="text-center">
          <h1 className="text-lg font-bold text-amber-100 tracking-wide">BATTLE PASS</h1>
          <p className="text-[10px] text-amber-400/60">{SEASON_NAME}</p>
        </div>
        <div className="text-right">
          <div className="text-amber-200 font-bold text-sm">Tier {currentTier}/{MAX_TIER}</div>
          <div className="text-[10px] text-gray-500">{bp.xp} XP</div>
        </div>
      </div>

      {/* Progress bar — animates from 0 to progress on mount via the
          transition-all + a useEffect-set width is overkill for a header
          bar; instead use a CSS transition-width with a 700ms duration so
          the fill always grows in from 0 (the starting render is empty
          because the bp data arrives asynchronously). */}
      <div className="px-6 py-3 bg-stone-900/30 border-b border-stone-700/30">
        <div className="flex items-center gap-3">
          <span className="text-amber-300 font-bold text-sm w-8">{currentTier}</span>
          <div className="flex-1 bg-stone-800 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="text-gray-500 font-bold text-sm w-8">{Math.min(currentTier + 1, MAX_TIER)}</span>
        </div>
        {!bp.isPremium && (
          <p className="text-[10px] text-gray-500 mt-1 text-center">Free Track — Premium rewards locked</p>
        )}
      </div>

      {claimMsg && (
        <div className="bg-green-600/20 border-b border-green-500/30 px-6 py-2 text-center">
          <span className="text-green-400 text-sm font-bold">{claimMsg}</span>
        </div>
      )}

      {/* Tier list — horizontal scroll, tiers stagger in left→right */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <div className="flex gap-2 min-w-max h-full">
          {BATTLE_PASS_TIERS.map((tier, i) => {
            const reached = currentTier >= tier.tier;
            const freeClaimed = (bp.claimedFree ?? []).includes(tier.tier);
            const premiumClaimed = (bp.claimedPremium ?? []).includes(tier.tier);
            const canClaimFree = reached && !freeClaimed;
            const canClaimPremium = reached && !premiumClaimed && bp.isPremium;
            // Stagger entrance so the row cascades in left-to-right.
            // 25ms per tile is barely-perceptible per-tile but reads as
            // a satisfying wave across the full row.
            const tileDelay = `${Math.min(i, 30) * 25}ms`;

            return (
              <div
                key={tier.tier}
                className={`flex flex-col w-24 shrink-0 rounded-xl border animate-slide-up ${reached ? 'border-amber-600/40 bg-stone-800/60' : 'border-stone-700/30 bg-stone-900/40 opacity-50'}`}
                style={{ animationDelay: tileDelay, animationFillMode: 'both' }}
              >
                {/* Tier number */}
                <div className={`text-center py-1.5 rounded-t-xl text-xs font-bold ${reached ? 'bg-amber-700/30 text-amber-300' : 'bg-stone-800 text-gray-600'}`}>
                  {tier.tier}
                </div>

                {/* Premium reward */}
                <button
                  onClick={() => canClaimPremium && handleClaim(tier.tier, 'premium')}
                  disabled={!canClaimPremium}
                  className={`flex-1 flex flex-col items-center justify-center p-2 border-b border-stone-700/30 ${REWARD_COLORS[tier.premiumReward.type]} ${canClaimPremium ? 'cursor-pointer hover:brightness-125 animate-pulse' : ''} ${premiumClaimed ? 'opacity-30' : ''} ${!bp.isPremium ? 'opacity-20' : ''}`}
                >
                  <span className="text-lg">{REWARD_ICONS[tier.premiumReward.type]}</span>
                  <span className="text-[8px] text-gray-300 mt-0.5 text-center leading-tight">{tier.premiumReward.label}</span>
                  {premiumClaimed && <span className="text-[8px] text-green-400 font-bold">Claimed</span>}
                </button>

                {/* Free reward */}
                <button
                  onClick={() => canClaimFree && handleClaim(tier.tier, 'free')}
                  disabled={!canClaimFree}
                  className={`flex-1 flex flex-col items-center justify-center p-2 rounded-b-xl ${REWARD_COLORS[tier.freeReward.type]} ${canClaimFree ? 'cursor-pointer hover:brightness-125 animate-pulse' : ''} ${freeClaimed ? 'opacity-30' : ''}`}
                >
                  <span className="text-lg">{REWARD_ICONS[tier.freeReward.type]}</span>
                  <span className="text-[8px] text-gray-300 mt-0.5 text-center leading-tight">{tier.freeReward.label}</span>
                  {freeClaimed && <span className="text-[8px] text-green-400 font-bold">Claimed</span>}
                  {!freeClaimed && !reached && <span className="text-[8px] text-gray-600">Locked</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
