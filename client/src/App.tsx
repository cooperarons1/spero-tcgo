import { useState, useEffect, useCallback, useRef } from 'react';
import { socket } from './socket';
import type { ClientGameState, LobbyState } from '../../shared/types';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { GameIntro } from './components/GameIntro';
import { DeckBuilder } from './components/DeckBuilder';
import { MatchHistory } from './components/MatchHistory';
import { saveMatch, type MatchRecord } from './utils/matchHistory';

type View = 'lobby' | 'game' | 'deckbuilder' | 'matchhistory';
type RematchState = 'default' | 'proposed' | 'received' | 'declined';

function App() {
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

      // Save match history on game over
      if (state.winner && !matchSavedRef.current) {
        matchSavedRef.current = true;
        const myStats = state.playerStats[state.myPlayerIndex];
        const oppIdx = state.myPlayerIndex === 0 ? 1 : 0;
        const oppStats = state.playerStats[oppIdx];
        const record: MatchRecord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          date: Date.now(),
          myName: state.myPlayerName,
          opponentName: state.opponent.playerName,
          isWin: state.winner === state.myPlayerId,
          winReason: state.winReason,
          myAP: state.apScores[state.myPlayerIndex],
          opponentAP: state.apScores[oppIdx],
          turns: state.turnNumber,
          myMissions: myStats.missionsLaunched,
          opponentMissions: oppStats.missionsLaunched,
          myDamage: myStats.damageDealt,
          opponentDamage: oppStats.damageDealt,
        };
        saveMatch(record);
      }

      // Reset rematch state when new game starts (no winner)
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

    return () => {
      socket.off('lobby-update');
      socket.off('game-state');
      socket.off('error');
      socket.off('opponent-hovering');
      socket.off('opponent-emote');
      socket.off('rematch-proposed');
      socket.off('rematch-declined');
    };
  }, []);

  const dismissIntro = useCallback(() => setShowIntro(false), []);

  const firstPlayerName = gameState
    ? (gameState.currentPlayerIndex === gameState.myPlayerIndex
        ? gameState.myPlayerName
        : gameState.opponent.playerName)
    : '';

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
        <DeckBuilder deck={null} onBack={() => setView('lobby')} />
      ) : view === 'matchhistory' ? (
        <MatchHistory onBack={() => setView('lobby')} />
      ) : (
        <Lobby
          lobby={lobby}
          onDeckBuilder={() => setView('deckbuilder')}
          onMatchHistory={() => setView('matchhistory')}
        />
      )}
    </>
  );
}

export default App;
