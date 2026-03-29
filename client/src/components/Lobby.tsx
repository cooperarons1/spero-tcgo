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
  onPlayOnline: () => void;
  onPlayAI: () => void;
  onPacks: () => void;
  onBattlePass: () => void;
  onSignOut: () => void;
}

const RANK_COLORS: Record<string, string> = {
  BRONZE: 'text-amber-600',
  SILVER: 'text-gray-300',
  GOLD: 'text-yellow-400',
  DIAMOND: 'text-cyan-400',
  LEGEND: 'text-purple-400',
};

export function Lobby({ lobby, user, onCollection, onMatchHistory, onFriends, onProfile, onPlayOnline, onPlayAI, onPacks, onBattlePass, onSignOut }: LobbyProps) {
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'join'>('menu');
  const [rank, setRank] = useState<{ elo: number; rankTier: string } | null>(null);
  const [quests, setQuests] = useState<{ quests: any[]; gold: number; xp: number; level: number } | null>(null);

  useEffect(() => {
    socket.emit('get-rank');
    socket.emit('get-quests');

    const onRank = (data: any) => setRank(data);
    const onQuests = (data: any) => setQuests(data);
    socket.on('rank-update', onRank);
    socket.on('quests-update', onQuests);
    return () => {
      socket.off('rank-update', onRank);
      socket.off('quests-update', onQuests);
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

  if (lobby) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-slate-800 rounded-2xl p-8 shadow-xl max-w-md w-full text-center border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-2">Room Code</h2>
          <div className="text-5xl font-bold tracking-[0.3em] text-spero-yellow mb-6 font-mono">
            {lobby.code}
          </div>
          <p className="text-gray-400 mb-4">Share this code with your opponent!</p>

          <div className="space-y-2 mb-6">
            <h3 className="font-bold text-gray-300">Players ({lobby.players.length}/2)</h3>
            {lobby.players.map((p) => (
              <div
                key={p.id}
                className="bg-slate-700 rounded-lg py-2 px-4 flex items-center justify-between"
              >
                <span className="font-medium text-white">{p.name}</span>
                {p.isHost && (
                  <span className="text-xs bg-spero-yellow text-black px-2 py-0.5 rounded-full font-bold">Host</span>
                )}
              </div>
            ))}
          </div>

          {lobby.isHost ? (
            <button
              onClick={handleStart}
              disabled={lobby.players.length < 2}
              className="w-full bg-spero-green text-white font-bold py-3 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:scale-100 cursor-pointer disabled:cursor-not-allowed"
            >
              {lobby.players.length < 2 ? 'Waiting for opponent...' : 'Start Game!'}
            </button>
          ) : (
            <p className="text-gray-400 italic">Waiting for host to start...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950">
      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
        {/* Title */}
        <h1 className="text-6xl font-extrabold text-amber-100 mb-0 drop-shadow-lg tracking-wide">MIRO</h1>
        <p className="text-amber-400 font-bold text-sm mb-8 tracking-[0.3em] uppercase">Trading Card Game</p>

        {mode === 'menu' && (
          <>
            {/* Center: Mode selector — like Hearthstone's box */}
            <div className="bg-stone-800/80 border-2 border-amber-700/40 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <div className="space-y-3">
                <button
                  onClick={onPlayAI}
                  className="w-full bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold py-3.5 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer border border-amber-500/50"
                >
                  Play vs AI
                </button>
                <button
                  onClick={onPlayOnline}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-3.5 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer border border-blue-500/50"
                >
                  Play Online
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreate}
                    className="flex-1 bg-stone-700 text-gray-300 font-bold py-2.5 px-4 rounded-xl text-sm hover:bg-stone-600 active:scale-95 transition-all cursor-pointer"
                  >
                    Create Room
                  </button>
                  <button
                    onClick={() => setMode('join')}
                    className="flex-1 bg-stone-700 text-gray-300 font-bold py-2.5 px-4 rounded-xl text-sm hover:bg-stone-600 active:scale-95 transition-all cursor-pointer"
                  >
                    Join Room
                  </button>
                </div>
                <button
                  onClick={onFriends}
                  className="w-full bg-stone-700/60 text-gray-400 font-bold py-2.5 px-6 rounded-xl text-sm hover:bg-stone-600 active:scale-95 transition-all cursor-pointer"
                >
                  Friends
                </button>
              </div>
            </div>

            {/* Daily Quests — below the mode box */}
            {quests && quests.quests.length > 0 && (
              <div className="mt-4 bg-stone-800/60 border border-amber-700/20 rounded-xl p-4 w-full max-w-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-xs text-amber-200/80 uppercase tracking-wider">Daily Quests</h3>
                  <span className="text-[10px] text-yellow-400 font-bold">{quests.gold}g | Lvl {quests.level}</span>
                </div>
                <div className="space-y-1.5">
                  {quests.quests.map((q: any) => (
                    <div key={q.id} className={`bg-stone-900/60 rounded-lg p-2 ${q.completed ? 'opacity-40' : ''}`}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-300">{q.description}</span>
                        <span className="text-yellow-400 font-bold">{q.reward}g</span>
                      </div>
                      <div className="mt-1 bg-stone-950 rounded-full h-1 overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%` }}
                        />
                      </div>
                      <div className="text-right text-[9px] text-gray-600 mt-0.5">
                        {q.completed ? 'Complete!' : `${q.progress}/${q.target}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {mode === 'join' && (
          <div className="bg-stone-800/80 border-2 border-amber-700/40 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={6}
              className="w-full bg-stone-900 border border-amber-700/40 rounded-xl py-3 px-4 text-center text-2xl tracking-[0.3em] font-mono text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none uppercase"
            />
            <button
              onClick={handleJoin}
              disabled={joinCode.length !== 6}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white font-bold py-3 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:scale-100 cursor-pointer disabled:cursor-not-allowed"
            >
              Join
            </button>
            <button
              onClick={() => setMode('menu')}
              className="text-gray-500 text-sm underline cursor-pointer"
            >
              Back
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom bar — like Hearthstone ── */}
      <div className="shrink-0 bg-stone-900/80 border-t border-amber-800/30 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {/* Left: Profile + Sign out */}
          <div className="flex items-center gap-3">
            <button
              onClick={onProfile}
              className="flex items-center gap-2 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 hover:bg-stone-700 transition-all cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-amber-600 flex items-center justify-center text-xs font-bold text-white">
                {displayName[0]?.toUpperCase()}
              </div>
              <span className="text-sm text-gray-300 font-medium">{displayName}</span>
              {rank && (
                <span className={`text-[10px] font-bold ${RANK_COLORS[rank.rankTier] || 'text-gray-500'}`}>
                  {rank.rankTier}
                </span>
              )}
            </button>
            <button onClick={onSignOut} className="text-gray-600 text-[10px] hover:text-gray-400 cursor-pointer">
              Sign Out
            </button>
          </div>

          {/* Center: Open Packs + Collection */}
          <div className="flex items-center gap-2">
            <button
              onClick={onMatchHistory}
              className="bg-stone-800 border border-stone-700 text-gray-400 font-bold py-2 px-4 rounded-lg text-xs hover:bg-stone-700 active:scale-95 transition-all cursor-pointer"
            >
              History
            </button>
            <button
              onClick={onPacks}
              className="bg-stone-800 border border-amber-700/50 text-amber-300 font-bold py-2 px-4 rounded-lg text-xs hover:bg-stone-700 active:scale-95 transition-all cursor-pointer"
            >
              Open Packs
            </button>
            <button
              onClick={onBattlePass}
              className="bg-stone-800 border border-purple-700/50 text-purple-300 font-bold py-2 px-4 rounded-lg text-xs hover:bg-stone-700 active:scale-95 transition-all cursor-pointer"
            >
              Battle Pass
            </button>
            <button
              onClick={onCollection}
              className="bg-amber-700/80 border border-amber-600/50 text-amber-100 font-bold py-2 px-5 rounded-lg text-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-md"
            >
              My Collection
            </button>
          </div>

          {/* Right: Gold display */}
          {quests && (
            <div className="flex items-center gap-3">
              <span className="text-yellow-400 font-bold text-sm">{quests.gold} <span className="text-yellow-600 text-xs">Gold</span></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
