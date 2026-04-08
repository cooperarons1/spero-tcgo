import { useState, useEffect } from 'react';
import type { LobbyState } from '../../../shared/types';
import type { User } from 'firebase/auth';
import { socket } from '../socket';

interface LobbyProps {
  lobby: LobbyState | null;
  user: User;
  onCollection: () => void;
  onMatchHistory: () => void;
  onFriends: () => void;
  onProfile: () => void;
  onPlayCasual: () => void;
  onPlayRanked: () => void;
  onPlayAI: () => void;
  onPacks: () => void;
  onBattlePass: () => void;
  onShop: () => void;
  onSignOut: () => void;
}

const RANK_COLORS: Record<string, string> = {
  BRONZE: 'text-amber-600',
  SILVER: 'text-gray-300',
  GOLD: 'text-yellow-400',
  DIAMOND: 'text-cyan-400',
  LEGEND: 'text-purple-400',
};

const RANK_BG: Record<string, string> = {
  BRONZE: 'bg-amber-900/40',
  SILVER: 'bg-gray-600/40',
  GOLD: 'bg-yellow-900/40',
  DIAMOND: 'bg-cyan-900/40',
  LEGEND: 'bg-purple-900/40',
};

const RANK_ICONS: Record<string, string> = {
  BRONZE: '🥉',
  SILVER: '🥈',
  GOLD: '🥇',
  DIAMOND: '💎',
  LEGEND: '👑',
};

interface SeasonInfo {
  id: string;
  name: string;
  number: number;
  daysLeft: number;
  peakRankTier: string;
  peakElo: number;
}

interface UnclaimedRewards {
  seasonId: string;
  seasonName: string;
  peakRankTier: string;
  rewards: { goldReward: number; dustReward: number; packReward: number; cardBack?: string };
}

export function Lobby({ lobby, user, onCollection, onMatchHistory, onFriends, onProfile, onPlayCasual, onPlayRanked, onPlayAI, onPacks, onBattlePass, onShop, onSignOut }: LobbyProps) {
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'join'>('menu');
  const [rank, setRank] = useState<{ elo: number; rankTier: string; season?: SeasonInfo; unclaimedSeasonRewards?: UnclaimedRewards | null } | null>(null);
  const [quests, setQuests] = useState<{ quests: any[]; gold: number; xp: number; level: number } | null>(null);
  const [dailyLogin, setDailyLogin] = useState<{ show: boolean; streak: number; reward: string; day: number } | null>(null);
  const [showSeasonRewards, setShowSeasonRewards] = useState(false);
  const [claimingRewards, setClaimingRewards] = useState(false);
  const [rewardsClaimed, setRewardsClaimed] = useState<{ goldReward: number; dustReward: number; packReward: number; cardBack: string | null; newRankTier: string } | null>(null);

  useEffect(() => {
    socket.emit('get-rank');
    socket.emit('get-quests');
    socket.emit('claim-daily-login');

    const onRank = (data: any) => {
      setRank(data);
      if (data.unclaimedSeasonRewards) {
        setShowSeasonRewards(true);
      }
    };
    const onQuests = (data: any) => setQuests(data);
    const onDailyLogin = (data: any) => {
      if (!data.alreadyClaimed) {
        setDailyLogin({ show: true, streak: data.streak, reward: data.reward, day: data.day });
      }
    };
    const onSeasonResult = (data: any) => {
      setClaimingRewards(false);
      if (data.success) {
        setRewardsClaimed(data);
        socket.emit('get-rank');
        socket.emit('get-quests');
      }
    };

    socket.on('rank-update', onRank);
    socket.on('quests-update', onQuests);
    socket.on('daily-login-result', onDailyLogin);
    socket.on('season-rewards-result', onSeasonResult);
    return () => {
      socket.off('rank-update', onRank);
      socket.off('quests-update', onQuests);
      socket.off('daily-login-result', onDailyLogin);
      socket.off('season-rewards-result', onSeasonResult);
    };
  }, []);

  const displayName = user.displayName || 'Player';

  const handleCreate = () => {
    socket.emit('create-room', displayName);
  };

  const handleJoin = () => {
    if (!joinCode.trim()) return;
    socket.emit('join-room', { code: joinCode.trim().toUpperCase(), name: displayName });
  };

  const handleStart = () => {
    socket.emit('start-game');
  };

  const handleClaimSeasonRewards = () => {
    setClaimingRewards(true);
    socket.emit('claim-season-rewards');
  };

  // Room view
  if (lobby) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950">
        <div className="bg-stone-800/90 rounded-2xl p-8 shadow-2xl max-w-md w-full text-center border border-amber-700/30 animate-slide-up">
          <h2 className="text-2xl font-bold text-amber-100 mb-2">Room Code</h2>
          <div className="text-5xl font-bold tracking-[0.3em] text-amber-400 mb-6 font-mono animate-bounce-in" style={{ animationDelay: '120ms', animationFillMode: 'both' }}>
            {lobby.code}
          </div>
          <p className="text-gray-400 mb-4">Share this code with your opponent!</p>

          <div className="space-y-2 mb-6">
            <h3 className="font-bold text-gray-300">Players ({lobby.players.length}/2)</h3>
            {lobby.players.map((p) => (
              <div key={p.id} className="bg-stone-700/60 rounded-lg py-2 px-4 flex items-center justify-between">
                <span className="font-medium text-white">{p.name}</span>
                {p.isHost && (
                  <span className="text-xs bg-amber-500 text-black px-2 py-0.5 rounded-full font-bold">Host</span>
                )}
              </div>
            ))}
          </div>

          {lobby.isHost ? (
            <button
              onClick={handleStart}
              disabled={lobby.players.length < 2}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white font-bold py-3 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:scale-100 cursor-pointer disabled:cursor-not-allowed border border-green-500/50"
            >
              {lobby.players.length < 2 ? 'Waiting for opponent...' : 'Start Game!'}
            </button>
          ) : (
            <p className="text-gray-400 italic">Waiting for host to start...</p>
          )}

          <button
            onClick={() => { socket.emit('leave-room'); }}
            className="mt-4 text-gray-500 text-sm hover:text-gray-300 cursor-pointer transition-colors"
          >
            &larr; Leave Room
          </button>
        </div>
      </div>
    );
  }

  const season = rank?.season;
  const unclaimed = rank?.unclaimedSeasonRewards;
  const tier = rank?.rankTier ?? 'BRONZE';

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 overflow-hidden">
      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-2 relative min-h-0">
        {/* Title block — bouncy entrance, subtitle fades in slightly behind */}
        <div className="text-center mb-6">
          <h1 className="text-7xl font-extrabold text-amber-100 drop-shadow-[0_2px_12px_rgba(217,169,56,0.3)] tracking-wider leading-none animate-bounce-in">MIRO</h1>
          <p className="text-amber-500/80 font-bold text-xs mt-1 tracking-[0.4em] uppercase animate-fade-in" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>Trading Card Game</p>
        </div>

        {/* Season + Rank bar */}
        {season && (
          <div className="flex items-center gap-4 mb-5 bg-stone-800/50 border border-stone-700/50 rounded-full px-5 py-2 animate-fade-in" style={{ animationDelay: '180ms', animationFillMode: 'both' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs text-amber-200/90 font-semibold">{season.name}</span>
            </div>
            <div className="w-px h-4 bg-stone-600" />
            <span className="text-xs text-gray-400">{season.daysLeft}d left</span>
            <div className="w-px h-4 bg-stone-600" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500 uppercase">Peak</span>
              <span className={`text-xs font-bold ${RANK_COLORS[season.peakRankTier] ?? 'text-gray-400'}`}>
                {RANK_ICONS[season.peakRankTier] ?? ''} {season.peakRankTier}
              </span>
            </div>
          </div>
        )}

        {mode === 'menu' && (
          <div className="w-full max-w-md space-y-5 animate-slide-up" style={{ animationDelay: '250ms', animationFillMode: 'both' }}>
            {/* Play buttons */}
            <div className="bg-stone-800/70 border border-amber-800/30 rounded-2xl p-6 shadow-2xl shadow-black/40 space-y-4">
              <button
                onClick={onPlayAI}
                className="w-full bg-gradient-to-r from-amber-600 via-amber-600 to-amber-700 text-white font-bold py-4 px-6 rounded-xl text-lg hover:brightness-110 active:scale-[0.97] transition-all shadow-lg cursor-pointer border border-amber-500/40"
              >
                Play vs AI
              </button>
              <div className="flex gap-3">
                <button
                  onClick={onPlayCasual}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-4 px-4 rounded-xl text-base hover:brightness-110 active:scale-[0.97] transition-all shadow-lg cursor-pointer border border-blue-500/40"
                >
                  Casual
                </button>
                <button
                  onClick={onPlayRanked}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-bold py-4 px-4 rounded-xl text-base hover:brightness-110 active:scale-[0.97] transition-all shadow-lg cursor-pointer border border-purple-500/40"
                >
                  Ranked
                </button>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleCreate}
                  className="flex-1 bg-stone-700/80 text-gray-300 font-semibold py-3 px-4 rounded-xl text-sm hover:bg-stone-600 active:scale-95 transition-all cursor-pointer border border-stone-600/40"
                >
                  Create Room
                </button>
                <button
                  onClick={() => setMode('join')}
                  className="flex-1 bg-stone-700/80 text-gray-300 font-semibold py-3 px-4 rounded-xl text-sm hover:bg-stone-600 active:scale-95 transition-all cursor-pointer border border-stone-600/40"
                >
                  Join Room
                </button>
              </div>
              <button
                onClick={onFriends}
                className="w-full bg-stone-700/40 text-gray-400 font-semibold py-2.5 px-6 rounded-xl text-sm hover:bg-stone-600/60 active:scale-95 transition-all cursor-pointer"
              >
                Friends
              </button>
            </div>

            {/* Daily Quests — bumped padding + text size for readability */}
            {quests && quests.quests.length > 0 && (
              <div className="bg-stone-800/50 border border-stone-700/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-xs text-amber-200/70 uppercase tracking-wider">Daily Quests</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400 text-xs font-bold">{quests.gold}g</span>
                    <span className="text-gray-600 text-[11px]">Lvl {quests.level}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {quests.quests.map((q: any) => (
                    <div key={q.id} className={`bg-stone-900/50 rounded-lg p-2.5 ${q.completed ? 'opacity-30' : ''}`}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-300">{q.description}</span>
                        <span className="text-yellow-400/80 font-bold ml-2 shrink-0">{q.reward}g</span>
                      </div>
                      <div className="mt-1.5 bg-stone-950 rounded-full h-1 overflow-hidden">
                        <div
                          className="h-full bg-amber-500/80 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'join' && (
          <div className="bg-stone-800/70 border border-amber-800/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-black/40 space-y-4">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={6}
              className="w-full bg-stone-900 border border-stone-600/50 rounded-xl py-3 px-4 text-center text-2xl tracking-[0.3em] font-mono text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none uppercase"
            />
            <button
              onClick={handleJoin}
              disabled={joinCode.length !== 6}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white font-bold py-3 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed border border-green-500/40"
            >
              Join
            </button>
            <button
              onClick={() => setMode('menu')}
              className="w-full text-gray-500 text-sm hover:text-gray-300 cursor-pointer transition-colors"
            >
              Back
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom bar ── */}
      <div className="shrink-0 bg-stone-900/90 border-t border-amber-900/30 px-3 py-2.5">
        <div className="max-w-3xl mx-auto flex items-center gap-2 overflow-x-auto">
          {/* Profile chip */}
          <button
            onClick={onProfile}
            className={`flex items-center gap-2 ${RANK_BG[tier]} border border-stone-600/50 rounded-lg px-3 py-2 hover:brightness-125 transition-all cursor-pointer shrink-0`}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-xs font-bold text-white shadow-inner">
              {displayName[0]?.toUpperCase()}
            </div>
            <div className="text-left">
              <div className="text-xs text-white font-semibold leading-tight">{displayName}</div>
              <div className={`text-[10px] font-bold leading-tight ${RANK_COLORS[tier]}`}>
                {RANK_ICONS[tier]} {tier} <span className="text-gray-500 font-normal">{rank?.elo ?? 1000}</span>
              </div>
            </div>
          </button>

          {/* Spacer */}
          <div className="flex-1 min-w-0" />

          {/* Nav buttons */}
          <button
            onClick={onShop}
            className="bg-amber-800/50 border border-amber-700/40 text-amber-200 font-bold py-2 px-3.5 rounded-lg text-xs hover:bg-amber-700/60 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            Shop
          </button>
          <button
            onClick={onPacks}
            className="bg-stone-800 border border-amber-700/30 text-amber-300 font-bold py-2 px-3.5 rounded-lg text-xs hover:bg-stone-700 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            Packs
          </button>
          <button
            onClick={onBattlePass}
            className="bg-stone-800 border border-purple-700/30 text-purple-300 font-bold py-2 px-3.5 rounded-lg text-xs hover:bg-stone-700 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            Pass
          </button>
          <button
            onClick={onMatchHistory}
            className="bg-stone-800 border border-stone-700/50 text-gray-400 font-bold py-2 px-3.5 rounded-lg text-xs hover:bg-stone-700 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            History
          </button>
          <button
            onClick={onCollection}
            className="bg-gradient-to-r from-amber-700 to-amber-800 border border-amber-600/50 text-amber-100 font-bold py-2 px-4 rounded-lg text-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-md shrink-0"
          >
            Collection
          </button>

          {/* Gold */}
          {quests && (
            <div className="flex items-center gap-1 bg-stone-800/60 border border-yellow-700/20 rounded-lg px-3 py-2 shrink-0">
              <span className="text-yellow-400 font-bold text-sm">{quests.gold}</span>
              <span className="text-yellow-600/70 text-[10px] font-semibold">G</span>
            </div>
          )}

          {/* Sign out */}
          <button onClick={onSignOut} className="text-gray-600 text-[10px] hover:text-gray-400 cursor-pointer shrink-0 px-1">
            Out
          </button>
        </div>
      </div>

      {/* ── Season Rewards Claim Popup ── */}
      {showSeasonRewards && unclaimed && !rewardsClaimed && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-stone-800 rounded-2xl p-8 border border-amber-600/40 text-center shadow-2xl max-w-md mx-4">
            <div className="text-4xl mb-3">{RANK_ICONS[unclaimed.peakRankTier] ?? '🏆'}</div>
            <h2 className="text-amber-100 font-bold text-xl mb-1">Season Complete!</h2>
            <p className="text-gray-400 text-sm mb-1">{unclaimed.seasonName}</p>
            <p className="text-sm mb-5">
              Peak Rank: <span className={`font-bold ${RANK_COLORS[unclaimed.peakRankTier] ?? 'text-white'}`}>{unclaimed.peakRankTier}</span>
            </p>

            <div className="bg-stone-900/60 rounded-xl p-4 mb-5 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Gold</span>
                <span className="text-yellow-400 font-bold">+{unclaimed.rewards.goldReward}</span>
              </div>
              {unclaimed.rewards.dustReward > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Dust</span>
                  <span className="text-blue-300 font-bold">+{unclaimed.rewards.dustReward}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Packs</span>
                <span className="text-amber-300 font-bold">+{unclaimed.rewards.packReward}</span>
              </div>
              {unclaimed.rewards.cardBack && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Card Back</span>
                  <span className="text-purple-300 font-bold">Legend Card Back</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-gray-500 mb-4">Your rank will be soft-reset for the new season.</p>

            <button
              onClick={handleClaimSeasonRewards}
              disabled={claimingRewards}
              className="bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold py-3 px-10 rounded-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer border border-amber-500/50 disabled:opacity-50"
            >
              {claimingRewards ? 'Claiming...' : 'Claim Rewards!'}
            </button>
          </div>
        </div>
      )}

      {/* ── Season Rewards Claimed Confirmation ── */}
      {rewardsClaimed && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-stone-800 rounded-2xl p-8 border border-green-600/40 text-center shadow-2xl max-w-md mx-4">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="text-green-300 font-bold text-xl mb-3">Rewards Claimed!</h2>
            <div className="bg-stone-900/60 rounded-xl p-4 mb-4 space-y-2 text-sm">
              <div className="text-yellow-400 font-bold">+{rewardsClaimed.goldReward} Gold</div>
              {rewardsClaimed.dustReward > 0 && <div className="text-blue-300 font-bold">+{rewardsClaimed.dustReward} Dust</div>}
              <div className="text-amber-300 font-bold">+{rewardsClaimed.packReward} Packs ({rewardsClaimed.packReward * 100}g)</div>
              {rewardsClaimed.cardBack && <div className="text-purple-300 font-bold">New Card Back!</div>}
            </div>
            <p className="text-xs text-gray-400 mb-4">New rank: <span className={`font-bold ${RANK_COLORS[rewardsClaimed.newRankTier] ?? 'text-white'}`}>{rewardsClaimed.newRankTier}</span></p>
            <button
              onClick={() => { setRewardsClaimed(null); setShowSeasonRewards(false); }}
              className="bg-gradient-to-r from-green-600 to-green-700 text-white font-bold py-2.5 px-8 rounded-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ── Daily Login Bonus Popup ── */}
      {dailyLogin?.show && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-stone-800 rounded-2xl p-8 border border-amber-600/40 text-center shadow-2xl max-w-sm mx-4">
            <div className="text-3xl mb-2">🎁</div>
            <h2 className="text-amber-100 font-bold text-xl mb-1">Daily Login Bonus!</h2>
            <p className="text-gray-400 text-sm mb-4">Day {dailyLogin.day} — {dailyLogin.streak} day streak</p>
            <div className="flex justify-center gap-1.5 mb-4">
              {[1,2,3,4,5,6,7].map(d => (
                <div key={d} className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  d < dailyLogin.day ? 'bg-amber-600/30 text-amber-400' :
                  d === dailyLogin.day ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/50 scale-110' :
                  'bg-stone-700 text-gray-600'
                }`}>
                  {d}
                </div>
              ))}
            </div>
            <div className="bg-amber-700/20 border border-amber-600/30 rounded-xl p-3 mb-4">
              <span className="text-yellow-400 font-bold text-lg">{dailyLogin.reward}</span>
            </div>
            <button
              onClick={() => setDailyLogin(null)}
              className="bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold py-2.5 px-8 rounded-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer border border-amber-500/50"
            >
              Collect!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
