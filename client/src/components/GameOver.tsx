import type { ClientGameState, PlayerStats } from '../../../shared/types';

interface GameOverProps {
  winnerName: string;
  isMe: boolean;
  onPlayAgain: () => void;
  gameState: ClientGameState;
}

function StatRow({ label, my, opp }: { label: string; my: number; opp: number }) {
  return (
    <tr className="border-t border-board-accent">
      <td className="py-1.5 px-2 text-right font-bold text-white">{my}</td>
      <td className="py-1.5 px-3 text-center text-gray-400 text-xs">{label}</td>
      <td className="py-1.5 px-2 text-left font-bold text-white">{opp}</td>
    </tr>
  );
}

export function GameOver({ winnerName, isMe, onPlayAgain, gameState }: GameOverProps) {
  const myStats: PlayerStats = gameState.playerStats[gameState.myPlayerIndex];
  const oppIdx = gameState.myPlayerIndex === 0 ? 1 : 0;
  const oppStats: PlayerStats = gameState.playerStats[oppIdx];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-board-surface rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4 text-center animate-bounce-in border border-board-accent">
        <div className="text-6xl mb-4">{isMe ? '🏆' : '💀'}</div>
        <h2 className="text-3xl font-bold text-white mb-2">
          {isMe ? 'Victory!' : `${winnerName} Wins!`}
        </h2>
        <p className="text-gray-400 mb-4">
          {isMe ? 'You reached 15 AP! Well played!' : 'Better luck next game!'}
        </p>

        {/* Stats table */}
        <table className="w-full mb-4 text-sm">
          <thead>
            <tr className="text-gray-500 text-xs">
              <th className="pb-1 text-right pr-2">You</th>
              <th className="pb-1 text-center px-3"></th>
              <th className="pb-1 text-left pl-2">{gameState.opponent.playerName}</th>
            </tr>
          </thead>
          <tbody>
            <StatRow label="AP Earned" my={myStats.apEarned} opp={oppStats.apEarned} />
            <StatRow
              label="Missions"
              my={myStats.missionsLaunched}
              opp={oppStats.missionsLaunched}
            />
            <StatRow
              label="Unblocked"
              my={myStats.missionsUnblocked}
              opp={oppStats.missionsUnblocked}
            />
            <StatRow label="Cards Played" my={myStats.cardsPlayed} opp={oppStats.cardsPlayed} />
            <StatRow label="Tricks Used" my={myStats.combatTricksUsed} opp={oppStats.combatTricksUsed} />
            <StatRow label="Damage Dealt" my={myStats.damageDealt} opp={oppStats.damageDealt} />
            <StatRow label="Duels" my={myStats.duelsInitiated} opp={oppStats.duelsInitiated} />
          </tbody>
        </table>

        {/* Extra info */}
        <div className="text-xs text-gray-500 mb-4 flex justify-center gap-4">
          <span>Turns: {gameState.turnNumber}</span>
          <span>Deck: {gameState.deckCount} remaining</span>
        </div>

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
