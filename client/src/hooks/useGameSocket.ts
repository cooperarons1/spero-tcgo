import { useState, useEffect } from 'react';
import { socket } from '../socket';
import type { ClientGameState, LobbyState } from '../../../shared/types';

export function useGameSocket() {
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

  return { lobby, gameState, error };
}
