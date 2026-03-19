interface APCounterProps {
  myAP: number;
  opponentAP: number;
  myName: string;
  opponentName: string;
}

export function APCounter({ myAP, opponentAP, myName, opponentName }: APCounterProps) {
  const maxAP = 15;

  return (
    <div className="flex items-center gap-4 bg-board-surface/80 px-4 py-2 rounded-xl border border-board-accent">
      {/* My AP */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">{myName}</span>
        <div className="flex items-center gap-1">
          <div className="w-24 h-3 bg-board-accent rounded-full overflow-hidden">
            <div
              className="h-full bg-spero-green rounded-full transition-all duration-500"
              style={{ width: `${(myAP / maxAP) * 100}%` }}
            />
          </div>
          <span className="text-sm font-bold text-spero-green">{myAP}/{maxAP}</span>
        </div>
      </div>

      <span className="text-gray-600 font-bold">vs</span>

      {/* Opponent AP */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">{opponentName}</span>
        <div className="flex items-center gap-1">
          <div className="w-24 h-3 bg-board-accent rounded-full overflow-hidden">
            <div
              className="h-full bg-spero-red rounded-full transition-all duration-500"
              style={{ width: `${(opponentAP / maxAP) * 100}%` }}
            />
          </div>
          <span className="text-sm font-bold text-spero-red">{opponentAP}/{maxAP}</span>
        </div>
      </div>
    </div>
  );
}
