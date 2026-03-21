import { useState } from 'react';
import type { LobbyState } from '../../../shared/types';
import type { User } from 'firebase/auth';
import { socket } from '../socket';
import { DeckSelector } from './DeckSelector';

interface LobbyProps {
  lobby: LobbyState | null;
  user: User;
  onDeckCollection: () => void;
  onMatchHistory: () => void;
  onSignOut: () => void;
}

export function Lobby({ lobby, user, onDeckCollection, onMatchHistory, onSignOut }: LobbyProps) {
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'join'>('menu');
  const [matchmaking, setMatchmaking] = useState<'idle' | 'searching'>('idle');
  const [selectedDeckCards, setSelectedDeckCards] = useState<string[] | null>(null);

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

  const handleDeckSelect = (cards: string[] | null) => {
    setSelectedDeckCards(cards);
    socket.emit('select-deck', { deckCards: cards });
  };

  const handleFindMatch = () => {
    if (!selectedDeckCards || selectedDeckCards.length !== 60) {
      return;
    }

    setMatchmaking('searching');
    socket.emit('join-queue', { deckCards: selectedDeckCards });

    // Listen for match found
    const onMatch = () => {
      setMatchmaking('idle');
      socket.off('match-found', onMatch);
      socket.off('queue-timeout', onTimeout);
    };
    const onTimeout = () => {
      setMatchmaking('idle');
      socket.off('match-found', onMatch);
      socket.off('queue-timeout', onTimeout);
    };
    socket.on('match-found', onMatch);
    socket.on('queue-timeout', onTimeout);
  };

  const handleCancelQueue = () => {
    setMatchmaking('idle');
    socket.emit('leave-queue');
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

          <div className="mb-4">
            <DeckSelector uid={user.uid} onSelectDeck={handleDeckSelect} />
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
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-gray-400 text-sm">Signed in as <span className="text-white font-medium">{displayName}</span></span>
          <button
            onClick={onSignOut}
            className="text-gray-500 text-xs underline hover:text-gray-300 cursor-pointer"
          >
            Sign Out
          </button>
        </div>

        {matchmaking === 'searching' && (
          <div className="fixed inset-0 z-50 bg-black/60 flex flex-col items-center justify-center">
            <div className="bg-board-surface rounded-2xl p-8 border border-board-accent text-center">
              <div className="w-12 h-12 border-4 border-spero-yellow border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white font-bold text-lg mb-2">Searching for opponent...</p>
              <p className="text-gray-400 text-sm mb-6">This may take a moment</p>
              <button
                onClick={handleCancelQueue}
                className="bg-board-accent text-gray-300 font-bold py-2 px-6 rounded-xl hover:bg-board-accent/80 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {mode === 'menu' && (
          <div className="space-y-4">
            <button
              onClick={handleFindMatch}
              className="w-full bg-spero-yellow text-black font-bold py-3 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              Find Match
            </button>
            <div className="text-xs text-gray-600 -mt-2">Auto-match with another player</div>

            <button
              onClick={handleCreate}
              className="w-full bg-spero-blue text-white font-bold py-3 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              Create Room
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full bg-transparent border-2 border-spero-blue text-spero-blue font-bold py-3 px-6 rounded-xl text-lg hover:bg-spero-blue/10 active:scale-95 transition-all cursor-pointer"
            >
              Join Room
            </button>
            <div className="flex gap-3 mt-4">
              <button
                onClick={onDeckCollection}
                className="flex-1 bg-board-accent text-gray-300 font-bold py-2.5 px-4 rounded-xl text-sm hover:bg-board-accent/80 active:scale-95 transition-all cursor-pointer"
              >
                My Decks
              </button>
              <button
                onClick={onMatchHistory}
                className="flex-1 bg-board-accent text-gray-300 font-bold py-2.5 px-4 rounded-xl text-sm hover:bg-board-accent/80 active:scale-95 transition-all cursor-pointer"
              >
                Match History
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
              className="w-full bg-board-accent border border-gray-600 rounded-xl py-3 px-4 text-center text-2xl tracking-[0.3em] font-mono text-white placeholder-gray-500 focus:border-spero-yellow focus:outline-none uppercase"
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
