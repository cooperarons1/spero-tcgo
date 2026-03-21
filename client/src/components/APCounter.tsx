interface APCounterProps {
  myAP: number;
  opponentAP: number;
  myName: string;
  opponentName: string;
}

export function APCounter({ myAP, opponentAP, myName, opponentName }: APCounterProps) {
  const maxAP = 15;

  return (
    <div className="bg-board-surface rounded-xl p-3 border border-board-accent">
      <h4 className="text-[10px] uppercase tracking-widest text-gray-600 text-center mb-3">Adventure Points</h4>

      {/* My AP */}
      <div className="mb-3">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs text-gray-400">{myName}</span>
          <span className="text-xl font-bold text-spero-green">{myAP}</span>
        </div>
        <div className="w-full h-4 bg-board-accent rounded-full overflow-hidden">
          <div className="h-full bg-spero-green rounded-full transition-all duration-700 ease-out"
               style={{ width: `${(myAP / maxAP) * 100}%` }} />
        </div>
      </div>

      <div className="text-center text-gray-600 text-xs font-bold my-2">VS</div>

      {/* Opponent AP */}
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs text-gray-400">{opponentName}</span>
          <span className="text-xl font-bold text-spero-red">{opponentAP}</span>
        </div>
        <div className="w-full h-4 bg-board-accent rounded-full overflow-hidden">
          <div className="h-full bg-spero-red rounded-full transition-all duration-700 ease-out"
               style={{ width: `${(opponentAP / maxAP) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
