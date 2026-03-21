import { useState, useEffect } from 'react';
import type { TurnPhase } from '../../../shared/types';

interface PhaseBarProps {
  currentPhase: TurnPhase;
  isMyTurn: boolean;
  buildsRemaining: number;
  onEndBuild?: () => void;
  onEndAction?: () => void;
  turnDeadline: number | null;
}

const phases: TurnPhase[] = ['UNTAP', 'DRAW', 'BUILD', 'ACTION', 'END'];

export function PhaseBar({ currentPhase, isMyTurn, buildsRemaining, onEndBuild, onEndAction, turnDeadline }: PhaseBarProps) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!turnDeadline) {
      setRemaining(null);
      return;
    }

    const tick = () => {
      const r = Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000));
      setRemaining(r);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [turnDeadline]);

  const isUrgent = remaining !== null && remaining <= 10;
  const isTimedOut = remaining === 0;

  return (
    <div className="bg-board-surface rounded-xl p-3 border border-board-accent">
      <div className={`text-center text-sm font-bold mb-3 ${isMyTurn ? 'text-spero-yellow' : 'text-gray-500'}`}>
        {isMyTurn ? 'Your Turn' : "Opponent's Turn"}
      </div>

      <div className="flex flex-col gap-1">
        {phases.map((phase, idx) => {
          const isActive = phase === currentPhase;
          const isPast = idx < phases.indexOf(currentPhase);
          return (
            <div key={phase} className="flex items-center gap-2">
              {/* Step indicator */}
              <div className={`w-3 h-3 rounded-full shrink-0 transition-all ${
                isActive ? 'bg-spero-yellow shadow-[0_0_8px_rgba(243,156,18,0.6)] animate-phase-glow' :
                isPast ? 'bg-gray-600' : 'bg-board-accent border border-gray-700'
              }`} />

              <div className="flex-1">
                <span className={`text-sm font-bold ${
                  isActive ? 'text-white' : isPast ? 'text-gray-600' : 'text-gray-700'
                }`}>
                  {phase}
                  {isActive && phase === 'BUILD' && ` (${buildsRemaining})`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Timer display */}
      {remaining !== null && (
        <div className="mt-2 text-center">
          {isTimedOut ? (
            <span className="text-lg font-bold text-spero-red animate-timer-urgent">Time!</span>
          ) : isUrgent ? (
            <span className="text-2xl font-bold text-spero-red animate-timer-urgent shadow-[0_0_12px_rgba(192,57,43,0.4)] rounded-full inline-block px-2">
              {remaining}
            </span>
          ) : (
            <span className="text-sm text-gray-500 font-mono">
              {Math.floor(remaining / 60)}:{(remaining % 60).toString().padStart(2, '0')}
            </span>
          )}
        </div>
      )}

      {/* Phase action button */}
      {isMyTurn && currentPhase === 'BUILD' && (
        <button onClick={onEndBuild}
          className="w-full mt-3 bg-spero-blue text-white text-sm font-bold py-2 rounded-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer">
          End Build Phase
        </button>
      )}
      {isMyTurn && currentPhase === 'ACTION' && (
        <button onClick={onEndAction}
          className="w-full mt-3 bg-spero-red text-white text-sm font-bold py-2 rounded-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer">
          End Turn
        </button>
      )}
    </div>
  );
}
