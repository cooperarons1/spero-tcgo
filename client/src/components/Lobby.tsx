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
  onSignOut: () => void;
}

const RANK_COLORS: Record<string, string> = {
  BRONZE: 'text-amber-600',
  SILVER: 'text-gray-300',
  GOLD: 'text-yellow-400',
  DIAMOND: 'text-cyan-400',
  LEGEND: 'text-purple-400',
};

export function Lobby({ lobby, user, onCollection, onMatchHistory, onFriends, onProfile, onPlayOnline, onPlayAI, onSignOut }: LobbyProps) {
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
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-slate-800 rounded-2xl p-8 shadow-xl max-w-md w-full text-center border border-slate-700">
        <h1 className="text-5xl font-extrabold text-white mb-1">MIRO</h1>
        <p className="text-spero-yellow font-bold text-lg mb-1">TCG Online</p>
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-gray-400 text-sm">Signed in as <span className="text-white font-medium">{displayName}</span>{rank && (
              <span className={`ml-2 text-xs font-bold ${RANK_COLORS[rank.rankTier] || 'text-gray-400'}`}>
                {rank.rankTier} ({rank.elo})
              </span>
            )}</span>
          <button
            onClick={onSignOut}
            className="text-gray-500 text-xs underline hover:text-gray-300 cursor-pointer"
          >
            Sign Out
          </button>
        </div>

        {mode === 'menu' && (
          <div className="space-y-4">
            <button
              onClick={onPlayOnline}
              className="w-full bg-spero-yellow text-black font-bold py-3 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              Play Online
            </button>
            <div className="text-xs text-gray-600 -mt-2">Find a match or create a room</div>

            <button
              onClick={onPlayAI}
              className="w-full bg-spero-green text-white font-bold py-3 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              Play vs AI
            </button>
            <div className="text-xs text-gray-600 -mt-2">Practice against a computer</div>

            <div className="flex gap-3">
              <button
                onClick={handleCreate}
                className="flex-1 bg-spero-blue text-white font-bold py-2.5 px-4 rounded-xl text-sm hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer"
              >
                Create Room
              </button>
              <button
                onClick={() => setMode('join')}
                className="flex-1 bg-transparent border-2 border-spero-blue text-spero-blue font-bold py-2.5 px-4 rounded-xl text-sm hover:bg-spero-blue/10 active:scale-95 transition-all cursor-pointer"
              >
                Join Room
              </button>
            </div>

            <button
              onClick={onFriends}
              className="w-full bg-spero-green/20 border border-spero-green/40 text-spero-green font-bold py-2.5 px-6 rounded-xl text-sm hover:bg-spero-green/30 active:scale-95 transition-all cursor-pointer mt-2"
            >
              Friends
            </button>
            {quests && quests.quests.length > 0 && (
              <div className="mt-4 bg-slate-700/50 rounded-xl p-4 text-left">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm text-gray-300">Daily Quests</h3>
                  <span className="text-xs text-yellow-400 font-bold">{quests.gold}g | Lvl {quests.level}</span>
                </div>
                <div className="space-y-2">
                  {quests.quests.map((q: any) => (
                    <div key={q.id} className={`bg-slate-800 rounded-lg p-2 ${q.completed ? 'opacity-50' : ''}`}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-200">{q.description}</span>
                        <span className="text-yellow-400 font-bold">{q.reward}g</span>
                      </div>
                      <div className="mt-1 bg-slate-900 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-spero-green rounded-full transition-all"
                          style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%` }}
                        />
                      </div>
                      <div className="text-right text-[10px] text-gray-500 mt-0.5">
                        {q.completed ? 'Complete!' : `${q.progress}/${q.target}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <button
                onClick={onProfile}
                className="flex-1 bg-slate-700 text-gray-300 font-bold py-2.5 px-4 rounded-xl text-sm hover:bg-slate-700/80 active:scale-95 transition-all cursor-pointer"
              >
                Profile
              </button>
              <button
                onClick={onCollection}
                className="flex-1 bg-slate-700 text-gray-300 font-bold py-2.5 px-4 rounded-xl text-sm hover:bg-slate-700/80 active:scale-95 transition-all cursor-pointer"
              >
                Collection
              </button>
              <button
                onClick={onMatchHistory}
                className="flex-1 bg-slate-700 text-gray-300 font-bold py-2.5 px-4 rounded-xl text-sm hover:bg-slate-700/80 active:scale-95 transition-all cursor-pointer"
              >
                History
              </button>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-4">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Room code (e.g. ABCDEF)"
              maxLength={6}
              className="w-full bg-slate-700 border border-gray-600 rounded-xl py-3 px-4 text-center text-2xl tracking-[0.3em] font-mono text-white placeholder-gray-500 focus:border-spero-yellow focus:outline-none uppercase"
            />
            <button
              onClick={handleJoin}
              disabled={joinCode.length !== 6}
              className="w-full bg-spero-green text-white font-bold py-3 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:scale-100 cursor-pointer disabled:cursor-not-allowed"
            >
              Join
            </button>
            <button
              onClick={() => setMode('menu')}
              className="text-gray-400 underline cursor-pointer"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
