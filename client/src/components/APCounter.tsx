import { useState, useEffect, useRef } from 'react';
import type { GameEffect } from '../hooks/useGameAnimations';

interface APCounterProps {
  myAP: number;
  opponentAP: number;
  myName: string;
  opponentName: string;
  myPlayerIndex?: 0 | 1;
  effects?: GameEffect[];
}

export function APCounter({ myAP, opponentAP, myName, opponentName, myPlayerIndex, effects }: APCounterProps) {
  const maxAP = 15;
  const [myBurst, setMyBurst] = useState(false);
  const [oppBurst, setOppBurst] = useState(false);
  const [floatDelta, setFloatDelta] = useState<{ my: number | null; opp: number | null }>({ my: null, opp: null });

  useEffect(() => {
    if (!effects || myPlayerIndex === undefined) return;
    for (const e of effects) {
      if (e.type === 'ap-change') {
        if (e.playerIndex === myPlayerIndex && e.delta > 0) {
          setMyBurst(true);
          setFloatDelta(prev => ({ ...prev, my: e.delta }));
          setTimeout(() => { setMyBurst(false); setFloatDelta(prev => ({ ...prev, my: null })); }, 800);
        } else if (e.playerIndex !== myPlayerIndex && e.delta > 0) {
          setOppBurst(true);
          setFloatDelta(prev => ({ ...prev, opp: e.delta }));
          setTimeout(() => { setOppBurst(false); setFloatDelta(prev => ({ ...prev, opp: null })); }, 800);
        }
      }
    }
  }, [effects, myPlayerIndex]);

  return (
    <div className="bg-board-surface rounded-xl p-3 border border-board-accent" data-hint-target="ap-counter">
      <h4 className="text-[10px] uppercase tracking-widest text-gray-600 text-center mb-3">Adventure Points</h4>

      {/* My AP */}
      <div className="mb-3 relative">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs text-gray-400">{myName}</span>
          <span className={`text-xl font-bold text-spero-green ${myBurst ? 'animate-ap-burst' : ''}`}>{myAP}</span>
        </div>
        <div className="w-full h-4 bg-board-accent rounded-full overflow-hidden">
          <div className="h-full bg-spero-green rounded-full transition-all duration-700 ease-out"
               style={{ width: `${(myAP / maxAP) * 100}%` }} />
        </div>
        {floatDelta.my !== null && (
          <span className="absolute -top-2 right-0 text-spero-green font-bold text-sm animate-float-up-fade">+{floatDelta.my}</span>
        )}
      </div>

      <div className="text-center text-gray-600 text-xs font-bold my-2">VS</div>

      {/* Opponent AP */}
      <div className="relative">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs text-gray-400">{opponentName}</span>
          <span className={`text-xl font-bold text-spero-red ${oppBurst ? 'animate-ap-burst' : ''}`}>{opponentAP}</span>
        </div>
        <div className="w-full h-4 bg-board-accent rounded-full overflow-hidden">
          <div className="h-full bg-spero-red rounded-full transition-all duration-700 ease-out"
               style={{ width: `${(opponentAP / maxAP) * 100}%` }} />
        </div>
        {floatDelta.opp !== null && (
          <span className="absolute -top-2 right-0 text-spero-red font-bold text-sm animate-float-up-fade">+{floatDelta.opp}</span>
        )}
      </div>
    </div>
  );
}
