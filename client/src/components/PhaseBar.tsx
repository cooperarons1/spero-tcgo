import type { TurnPhase } from '../../../shared/types';

interface PhaseBarProps {
  currentPhase: TurnPhase;
  isMyTurn: boolean;
  buildsRemaining: number;
  onEndBuild?: () => void;
  onEndAction?: () => void;
}

const phases: TurnPhase[] = ['UNTAP', 'DRAW', 'BUILD', 'ACTION', 'END'];

export function PhaseBar({ currentPhase, isMyTurn, buildsRemaining, onEndBuild, onEndAction }: PhaseBarProps) {
  return (
    <div className="flex items-center gap-2 bg-board-surface/80 px-4 py-2 rounded-xl border border-board-accent">
      {phases.map((phase) => {
        const isActive = phase === currentPhase;
        const isPast = phases.indexOf(phase) < phases.indexOf(currentPhase);
        return (
          <div
            key={phase}
            className={`
              px-3 py-1 rounded-lg text-xs font-bold transition-all
              ${isActive ? 'bg-spero-yellow text-black scale-110' : ''}
              ${isPast ? 'bg-board-accent text-gray-500' : ''}
              ${!isActive && !isPast ? 'bg-board-accent/50 text-gray-600' : ''}
            `}
          >
            {phase}
            {isActive && phase === 'BUILD' && (
              <span className="ml-1 text-[10px]">({buildsRemaining})</span>
            )}
          </div>
        );
      })}

      {/* Phase action buttons */}
      {isMyTurn && currentPhase === 'BUILD' && (
        <button
          onClick={onEndBuild}
          className="ml-auto bg-spero-blue text-white text-xs font-bold px-3 py-1 rounded-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
        >
          End Build
        </button>
      )}
      {isMyTurn && currentPhase === 'ACTION' && (
        <button
          onClick={onEndAction}
          className="ml-auto bg-spero-red text-white text-xs font-bold px-3 py-1 rounded-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
        >
          End Turn
        </button>
      )}
    </div>
  );
}
