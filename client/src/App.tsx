import { useState, useEffect } from 'react';
import { socket } from './socket';
import type { ClientGameState, LobbyState } from '../../shared/types';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';

function App() {
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    socket.on('lobby-update', (data: LobbyState) => {
      setLobby(data);
      setGameState(null);
    });

    socket.on('game-state', (state: ClientGameState) => {
      setGameState(state);
      setLobby(null);
    });

    socket.on('error', (msg: string) => {
      setError(msg);
      setTimeout(() => setError(null), 3000);
    });

    return () => {
      socket.off('lobby-update');
      socket.off('game-state');
      socket.off('error');
    };
  }, []);

  return (
    <>
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-full shadow-lg animate-bounce-in">
          {error}
        </div>
      )}

      {gameState ? (
        <GameBoard gameState={gameState} />
      ) : (
        <Lobby lobby={lobby} />
      )}
    </>
  );
}

export default App;
