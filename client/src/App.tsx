import { useState, useEffect, useCallback, useRef, Component } from 'react';
import type { ReactNode } from 'react';
import { socket } from './socket';
import type { ClientGameState, LobbyState } from '../../shared/types';
import { useAuth } from './hooks/useAuth';
import { AuthScreen } from './components/AuthScreen';
import { Lobby } from './components/Lobby';
import GameBoard from './components/GameBoard';
import { GameIntro } from './components/GameIntro';
import { Collection } from './components/Collection';
import { DeckPicker } from './components/DeckPicker';
import { MatchHistory } from './components/MatchHistory';
import { Friends } from './components/Friends';
import { ReconnectionOverlay } from './components/ReconnectionOverlay';

class ErrorBoundary extends Component<{ children: ReactNode }, { errorMsg: string | null }> {
  state = { errorMsg: null as string | null };
  static getDerivedStateFromError(error: unknown) {
    try { return { errorMsg: error instanceof Error ? error.message : JSON.stringify(error) }; }
    catch { return { errorMsg: 'Unknown error' }; }
  }
  componentDidCatch(error: unknown, info: any) { console.error('[CRASH]', error, info?.componentStack); }
  render() {
    if (this.state.errorMsg) {
      return (
        <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center p-8">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h1>
          <pre className="text-sm text-gray-300 max-w-lg overflow-auto whitespace-pre-wrap">{this.state.errorMsg}</pre>
          <button onClick={() => { this.setState({ errorMsg: null }); window.location.reload(); }}
            className="mt-4 bg-amber-500 text-black px-6 py-2 rounded font-bold">Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

type View = 'lobby' | 'game' | 'collection' | 'deckpicker' | 'deckpicker-ai' | 'matchhistory' | 'friends';
type RematchState = 'default' | 'proposed' | 'received' | 'declined';
type ConnectionStatus = 'connected' | 'disconnected' | 'opponent-disconnected';

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
  const errorTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [incomingChallenge, setIncomingChallenge] = useState<{ challengeId: string; fromUid: string; fromName: string } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');

  // Opponent action animation queue
  const [displayedState, setDisplayedState] = useState<ClientGameState | null>(null);
  const stateQueueRef = useRef<ClientGameState[]>([]);
  const processingRef = useRef(false);
  const displayedRef = useRef<ClientGameState | null>(null);

  useEffect(() => { displayedRef.current = displayedState; }, [displayedState]);

  const processQueueRef = useRef<(() => void) | undefined>(undefined);
  processQueueRef.current = () => {
    if (processingRef.current || stateQueueRef.current.length === 0) return;
    processingRef.current = true;
    const next = stateQueueRef.current.shift()!;
    displayedRef.current = next;
    setDisplayedState(next);
    setTimeout(() => {
      processingRef.current = false;
      processQueueRef.current?.();
    }, 1200);
  };

  // Connect socket when auth resolves
  useEffect(() => {
    if (user && !socket.connected) {
      socket.connect();
    }
    if (!user && socket.connected) {
      socket.disconnect();
    }
  }, [user]);

  // Socket connection/disconnection listeners for reconnection UI
  useEffect(() => {
    const onDisconnect = () => {
      setConnectionStatus('disconnected');
    };

    const onConnect = () => {
      setConnectionStatus('connected');
      const savedRoom = sessionStorage.getItem('spero-room-code');
      if (savedRoom) {
        socket.emit('rejoin-room', { roomCode: savedRoom });
      }
    };

    const onReconnected = (data: { roomCode: string }) => {
      setConnectionStatus('connected');
      sessionStorage.setItem('spero-room-code', data.roomCode);
    };

    const onOpponentDisconnected = () => {
      setConnectionStatus('opponent-disconnected');
    };

    const onOpponentReconnected = () => {
      setConnectionStatus('connected');
    };

    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    socket.on('reconnected', onReconnected);
    socket.on('opponent-disconnected', onOpponentDisconnected);
    socket.on('opponent-reconnected', onOpponentReconnected);

    return () => {
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
      socket.off('reconnected', onReconnected);
      socket.off('opponent-disconnected', onOpponentDisconnected);
      socket.off('opponent-reconnected', onOpponentReconnected);
    };
  }, []);

  useEffect(() => {
    socket.on('lobby-update', (data: LobbyState) => {
      setLobby(data);
      setGameState(null);
      setView('lobby');
      introShownRef.current = false;
      matchSavedRef.current = false;
      setRematchState('default');
      sessionStorage.setItem('spero-room-code', data.code);
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

      if (state.winner && !matchSavedRef.current) {
        matchSavedRef.current = true;
      }

      if (!state.winner) {
        setRematchState('default');
        matchSavedRef.current = false;
      }

      // Queue animation for opponent actions — show each with delay
      const current = displayedRef.current;
      const phaseChanged = current && current.phase !== state.phase;
      const isOpponentTurn = state.phase === 'PLAYING' &&
        state.currentPlayerIndex !== state.myPlayerIndex;
      const isOpponentActing = current && !phaseChanged && !state.winner && isOpponentTurn;

      if (phaseChanged) {
        console.log('[STATE] Phase changed:', current?.phase, '->', state.phase, 'applying immediately');
        // Force-sync ref immediately so subsequent events in the same tick see the new phase
        displayedRef.current = state;
      }

      if (isOpponentActing) {
        stateQueueRef.current.push(state);
        processQueueRef.current?.();
      } else {
        // My turn, game start, phase transition, or game over — apply immediately
        stateQueueRef.current = [];
        processingRef.current = false;
        // Sync ref immediately so subsequent events in same tick see fresh state
        displayedRef.current = state;
        setDisplayedState(state);
      }
    });

    socket.on('needs-target', (data: { cardInstanceId?: string; heroPower?: boolean; locationInstanceId?: string; validTargets: string[] }) => {
      console.log('[needs-target]', data.heroPower ? 'hero-power' : data.locationInstanceId ? 'location' : data.cardInstanceId, 'targets:', data.validTargets);
      const isHeroPower = !!data.heroPower;
      const isLocation = !!data.locationInstanceId;
      const interactionId = isHeroPower ? 'needs-target-hero-power'
        : isLocation ? `needs-target-location-${data.locationInstanceId}`
        : `needs-target-${data.cardInstanceId}`;
      const context = isHeroPower ? 'hero-power' as const
        : isLocation ? 'location' as const
        : 'battlecry' as const;
      const pendingInteraction = {
        type: 'CHOOSE_TARGET' as const,
        waitingForPlayerId: '__self__',
        timeoutAt: null as any,
        targetChoice: {
          interactionId,
          effectSource: data.cardInstanceId ?? data.locationInstanceId ?? 'hero-power',
          prompt: isHeroPower ? 'Choose a target for Hero Power'
            : isLocation ? 'Choose a target for Location'
            : 'Choose a target',
          validTargets: data.validTargets.map((id: string) => ({ id, label: '' })),
          allowSkip: false,
          context,
        },
      };
      // Apply to both gameState AND displayedState so targeting overlay is visible
      setGameState(prev => {
        if (!prev) return prev;
        return { ...prev, pendingInteraction: { ...pendingInteraction, waitingForPlayerId: prev.myPlayerId } };
      });
      setDisplayedState(prev => {
        if (!prev) return prev;
        return { ...prev, pendingInteraction: { ...pendingInteraction, waitingForPlayerId: prev.myPlayerId } };
      });
    });

    socket.on('error', (msg: string) => {
      setError(prev => {
        // If same message, just extend visibility (timer reset below handles it)
        if (prev === msg) return prev;
        return msg;
      });
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(null), 5000);
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
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(null), 5000);
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
    <ErrorBoundary>
    <>
      {connectionStatus !== 'connected' && view === 'game' && (
        <ReconnectionOverlay
          status={connectionStatus}
          onReturnToLobby={() => {
            socket.emit('leave-game');
            setGameState(null);
            setView('lobby');
            setConnectionStatus('connected');
            sessionStorage.removeItem('spero-room-code');
          }}
        />
      )}
      {error && (
        <div
          onClick={() => { setError(null); clearTimeout(errorTimerRef.current); }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-full shadow-lg animate-bounce-in cursor-pointer flex items-center gap-2"
        >
          {error}
          <span className="text-white/70 text-xs">×</span>
        </div>
      )}

      {view === 'game' && gameState ? (
        <>
          <GameBoard
            gameState={displayedState ?? gameState!}
            opponentHovering={opponentHovering}
            opponentEmote={opponentEmote}
            onLeaveGame={() => { socket.emit('leave-game'); setGameState(null); setView('lobby'); sessionStorage.removeItem('spero-room-code'); }}
            uid={user.uid}
            rematchState={rematchState}
            onRequestRematch={() => { setRematchState('proposed'); socket.emit('request-rematch'); }}
            onDeclineRematch={() => socket.emit('decline-rematch')}
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
      ) : view === 'collection' ? (
        <Collection
          uid={user.uid}
          onBack={() => setView('lobby')}
        />
      ) : view === 'deckpicker' ? (
        <DeckPicker
          mode="online"
          uid={user.uid}
          onBack={() => setView('lobby')}
        />
      ) : view === 'deckpicker-ai' ? (
        <DeckPicker
          mode="ai"
          uid={user.uid}
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
          onCollection={() => setView('collection')}
          onMatchHistory={() => setView('matchhistory')}
          onFriends={() => setView('friends')}
          onPlayOnline={() => setView('deckpicker')}
          onPlayAI={() => setView('deckpicker-ai')}
          onSignOut={signOut}
        />
      )}
    </>
    </ErrorBoundary>
  );
}

export default App;
