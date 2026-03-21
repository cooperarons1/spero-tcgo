import { useState, useEffect, useCallback, useRef } from 'react';
import { socket } from './socket';
import type { ClientGameState, LobbyState } from '../../shared/types';
import { useAuth } from './hooks/useAuth';
import { AuthScreen } from './components/AuthScreen';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { GameIntro } from './components/GameIntro';
import { DeckBuilder } from './components/DeckBuilder';
import { DeckCollection } from './components/DeckCollection';
import { MatchHistory } from './components/MatchHistory';
import { Friends } from './components/Friends';

type View = 'lobby' | 'game' | 'deckbuilder' | 'deckcollection' | 'matchhistory' | 'friends';
type RematchState = 'default' | 'proposed' | 'received' | 'declined';

function App() {
  const { user, loading, signUp, signIn, signOut } = useAuth();
  const [view, setView] = useState<View>('lobby');
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opponentHovering, setOpponentHovering] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [opponentEmote, setOpponentEmote] = useState<string | null>(null);
  const [rematchState, setRematchState] = useState<RematchState>('default');
  const introShownRef = useRef(false);
  const matchSavedRef = useRef(false);
  const [editingDeck, setEditingDeck] = useState<any>(null);
  const [incomingChallenge, setIncomingChallenge] = useState<{ challengeId: string; fromUid: string; fromName: string } | null>(null);

  // Connect socket when auth resolves
  useEffect(() => {
    if (user && !socket.connected) {
      socket.connect();
    }
    if (!user && socket.connected) {
      socket.disconnect();
    }
  }, [user]);

  useEffect(() => {
    socket.on('lobby-update', (data: LobbyState) => {
      setLobby(data);
      setGameState(null);
      setView('lobby');
      introShownRef.current = false;
      matchSavedRef.current = false;
      setRematchState('default');
    });

    socket.on('game-state', (state: ClientGameState) => {
      setGameState(state);
      setLobby(null);
      setView('game');
      setOpponentHovering(false);

      if (state.turnNumber === 1 && !introShownRef.current) {
        introShownRef.current = true;
        setShowIntro(true);
      }

      // Server writes match history now — no client-side saveMatch
      if (state.winner && !matchSavedRef.current) {
        matchSavedRef.current = true;
      }

      if (!state.winner) {
        setRematchState('default');
        matchSavedRef.current = false;
      }
    });

    socket.on('error', (msg: string) => {
      setError(msg);
      setTimeout(() => setError(null), 3000);
    });

    socket.on('opponent-hovering', (data: { isHovering: boolean }) => {
      setOpponentHovering(data.isHovering);
    });

    socket.on('opponent-emote', (data: { emoteId: string }) => {
      setOpponentEmote(data.emoteId);
      setTimeout(() => setOpponentEmote(null), 3000);
    });

    socket.on('rematch-proposed', () => {
      setRematchState('received');
    });

    socket.on('rematch-declined', () => {
      setRematchState('declined');
    });

    socket.on('match-found', () => {
      // Game state will follow automatically via game-state event
    });

    socket.on('queue-timeout', () => {
      setError('Matchmaking timed out. Try again!');
      setTimeout(() => setError(null), 3000);
    });

    socket.on('duel-challenge', (data: { challengeId: string; fromUid: string; fromName: string }) => {
      setIncomingChallenge(data);
      setView('friends');
    });

    return () => {
      socket.off('lobby-update');
      socket.off('game-state');
      socket.off('error');
      socket.off('opponent-hovering');
      socket.off('opponent-emote');
      socket.off('rematch-proposed');
      socket.off('rematch-declined');
      socket.off('match-found');
      socket.off('queue-timeout');
      socket.off('duel-challenge');
    };
  }, []);

  const dismissIntro = useCallback(() => setShowIntro(false), []);

  const firstPlayerName = gameState
    ? (gameState.currentPlayerIndex === gameState.myPlayerIndex
        ? gameState.myPlayerName
        : gameState.opponent.playerName)
    : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} />;
  }

  return (
    <>
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-full shadow-lg animate-bounce-in">
          {error}
        </div>
      )}

      {view === 'game' && gameState ? (
        <>
          <GameBoard
            gameState={gameState}
            opponentHovering={opponentHovering}
            opponentEmote={opponentEmote}
            rematchState={rematchState}
            onRematchStateChange={setRematchState}
            onLeaveGame={() => { setGameState(null); setView('lobby'); }}
            uid={user.uid}
          />
          {showIntro && (
            <GameIntro
              myName={gameState.myPlayerName}
              opponentName={gameState.opponent.playerName}
              firstPlayerName={firstPlayerName}
              onDismiss={dismissIntro}
            />
          )}
        </>
      ) : view === 'deckbuilder' ? (
        <DeckBuilder
          deck={editingDeck}
          uid={user.uid}
          onBack={() => { setEditingDeck(null); setView('deckcollection'); }}
        />
      ) : view === 'deckcollection' ? (
        <DeckCollection
          uid={user.uid}
          onEditDeck={(deck) => { setEditingDeck(deck); setView('deckbuilder'); }}
          onNewDeck={() => { setEditingDeck(null); setView('deckbuilder'); }}
          onBack={() => setView('lobby')}
        />
      ) : view === 'matchhistory' ? (
        <MatchHistory uid={user.uid} onBack={() => setView('lobby')} />
      ) : view === 'friends' ? (
        <Friends uid={user.uid} onBack={() => setView('lobby')} incomingChallenge={incomingChallenge} onChallengeHandled={() => setIncomingChallenge(null)} />
      ) : (
        <Lobby
          lobby={lobby}
          user={user}
          onDeckCollection={() => setView('deckcollection')}
          onMatchHistory={() => setView('matchhistory')}
          onFriends={() => setView('friends')}
          onSignOut={signOut}
        />
      )}
    </>
  );
}

export default App;
