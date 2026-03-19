interface GameOverProps {
  winnerName: string;
  isMe: boolean;
  onPlayAgain: () => void;
}

export function GameOver({ winnerName, isMe, onPlayAgain }: GameOverProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-board-surface rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4 text-center animate-bounce-in border border-board-accent">
        <div className="text-6xl mb-4">{isMe ? '🏆' : '💀'}</div>
        <h2 className="text-3xl font-bold text-white mb-2">
          {isMe ? 'Victory!' : `${winnerName} Wins!`}
        </h2>
        <p className="text-gray-400 mb-6">
          {isMe ? 'You reached 15 AP! Well played!' : 'Better luck next game!'}
        </p>
        <button
          onClick={onPlayAgain}
          className="bg-spero-green text-white font-bold py-3 px-8 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
