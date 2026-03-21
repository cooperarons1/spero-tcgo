import type { ClientGameState } from '../../../shared/types';
import { ConfettiCanvas } from './ConfettiCanvas';

type RematchState = 'default' | 'proposed' | 'received' | 'declined';

interface GameOverProps {
  winnerName: string;
  isMe: boolean;
  onPlayAgain: () => void;
  onRequestRematch: () => void;
  onDeclineRematch: () => void;
  gameState: ClientGameState;
  rematchState: RematchState;
  onLeaveGame?: () => void;
}

function getWinMessage(isMe: boolean): string {
  return isMe ? 'Well played!' : 'Better luck next game!';
}

export function GameOver({ winnerName, isMe, onPlayAgain, onRequestRematch, onDeclineRematch, gameState, rematchState, onLeaveGame }: GameOverProps) {
  const winMessage = getWinMessage(isMe);

  return (
    <div className={`fixed inset-0 bg-black/70 flex items-center justify-center z-50 ${!isMe ? 'animate-vignette-red' : ''}`}>
      {isMe && <ConfettiCanvas />}
      <div className={`bg-board-surface rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4 text-center animate-bounce-in border border-board-accent ${isMe ? 'ring-2 ring-spero-yellow/40' : ''}`}>
        <h2 className={`text-3xl font-bold text-white mb-2 ${isMe ? 'animate-victory-title' : ''}`}>
          {isMe ? 'Victory!' : `${winnerName} Wins!`}
        </h2>
        <p className="text-gray-400 mb-6">
          {winMessage}
        </p>

        <div className="space-y-2">
          {rematchState === 'default' && (
            <button
              onClick={onRequestRematch}
              className="w-full bg-spero-green text-white font-bold py-3 px-8 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              Rematch
            </button>
          )}
          {rematchState === 'proposed' && (
            <div className="text-gray-400 text-sm py-3">
              Waiting for opponent to accept...
            </div>
          )}
          {rematchState === 'received' && (
            <div className="flex gap-3">
              <button
                onClick={onRequestRematch}
                className="flex-1 bg-spero-green text-white font-bold py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                Accept Rematch
              </button>
              <button
                onClick={onDeclineRematch}
                className="flex-1 bg-board-accent text-gray-300 font-bold py-3 rounded-xl hover:bg-board-accent/80 active:scale-95 transition-all cursor-pointer"
              >
                Decline
              </button>
            </div>
          )}
          {rematchState === 'declined' && (
            <div className="text-gray-500 text-sm py-3">Rematch declined.</div>
          )}
          {onLeaveGame && (
            <button
              onClick={onLeaveGame}
              className="w-full bg-board-accent text-gray-300 font-bold py-3 px-8 rounded-xl text-base hover:bg-board-accent/80 active:scale-95 transition-all cursor-pointer"
            >
              Leave
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
