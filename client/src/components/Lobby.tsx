import { useState } from 'react';
import type { LobbyState } from '../../../shared/types';
import { socket } from '../socket';

interface LobbyProps {
  lobby: LobbyState | null;
}

export function Lobby({ lobby }: LobbyProps) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'join'>('menu');

  const handleCreate = () => {
    if (!name.trim()) return;
    socket.emit('create-room', name.trim());
  };

  const handleJoin = () => {
    if (!name.trim() || !joinCode.trim()) return;
    socket.emit('join-room', { code: joinCode.trim().toUpperCase(), name: name.trim() });
  };

  const handleStart = () => {
    socket.emit('start-game');
  };

  if (lobby) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-board-surface rounded-2xl p-8 shadow-xl max-w-md w-full text-center border border-board-accent">
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
                className="bg-board-accent rounded-lg py-2 px-4 flex items-center justify-between"
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
      <div className="bg-board-surface rounded-2xl p-8 shadow-xl max-w-md w-full text-center border border-board-accent">
        <h1 className="text-5xl font-extrabold text-white mb-1">SPERO</h1>
        <p className="text-spero-yellow font-bold text-lg mb-1">TCG Online</p>
        <p className="text-gray-500 mb-8 text-sm">2-Player Card Game</p>

        {mode === 'menu' && (
          <div className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={15}
              className="w-full bg-board-accent border border-gray-600 rounded-xl py-3 px-4 text-center text-lg text-white placeholder-gray-500 focus:border-spero-yellow focus:outline-none"
            />
            <button
              onClick={handleCreate}
              disabled={!name.trim()}
              className="w-full bg-spero-blue text-white font-bold py-3 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:scale-100 cursor-pointer disabled:cursor-not-allowed"
            >
              Create Room
            </button>
            <button
              onClick={() => setMode('join')}
              disabled={!name.trim()}
              className="w-full bg-transparent border-2 border-spero-blue text-spero-blue font-bold py-3 px-6 rounded-xl text-lg hover:bg-spero-blue/10 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 cursor-pointer disabled:cursor-not-allowed"
            >
              Join Room
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-4">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Room code (e.g. ABCD)"
              maxLength={4}
              className="w-full bg-board-accent border border-gray-600 rounded-xl py-3 px-4 text-center text-2xl tracking-[0.3em] font-mono text-white placeholder-gray-500 focus:border-spero-yellow focus:outline-none uppercase"
            />
            <button
              onClick={handleJoin}
              disabled={joinCode.length !== 4}
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
