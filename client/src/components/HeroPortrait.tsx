import { useState, useEffect, useRef } from 'react';
import type { GameEffect } from '../hooks/useGameAnimations';

interface HeroPortraitProps {
  playerName: string;
  health: number;
  ap?: number;
  isOpponent: boolean;
  effects?: GameEffect[];
  playerIndex?: 0 | 1;
  onClick?: () => void;
}

export function HeroPortrait({ playerName, health, ap, isOpponent, effects, playerIndex, onClick }: HeroPortraitProps) {
  const [damageFlash, setDamageFlash] = useState(false);
  const [floatDelta, setFloatDelta] = useState<number | null>(null);
  const prevHealth = useRef(health);

  useEffect(() => {
    if (health < prevHealth.current) {
      const delta = prevHealth.current - health;
      setDamageFlash(true);
      setFloatDelta(-delta);
      setTimeout(() => {
        setDamageFlash(false);
        setFloatDelta(null);
      }, 800);
    }
    prevHealth.current = health;
  }, [health]);

  return (
    <div className={`flex flex-col items-center gap-1`}>
      {isOpponent && (
        <span className="text-xs text-gray-400 font-medium">{playerName}</span>
      )}

      <div className="relative">
        {/* Portrait circle */}
        <div
          className={`w-16 h-16 md:w-20 md:h-20 rounded-full border-3 border-board-accent shadow-lg ring-1 ring-white/10 bg-board-surface flex items-center justify-center overflow-hidden ${
            damageFlash ? 'animate-damage-shake' : ''
          } ${onClick ? 'cursor-pointer hover:brightness-125 active:scale-95 transition-all' : ''}`}
          onClick={onClick}
        >
          {/* Generic silhouette placeholder */}
          <svg viewBox="0 0 40 40" className="w-10 h-10 text-gray-600">
            <circle cx="20" cy="14" r="8" fill="currentColor" />
            <ellipse cx="20" cy="36" rx="14" ry="10" fill="currentColor" />
          </svg>
        </div>

        {/* AP badge (bottom-left) */}
        {ap !== undefined && ap > 0 && (
          <div className="absolute -bottom-2 -left-1 w-7 h-7 md:w-8 md:h-8 rounded-full bg-spero-yellow border-2 border-yellow-600 flex items-center justify-center shadow-lg">
            <span className="text-black font-bold text-sm md:text-base drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]">{ap}</span>
          </div>
        )}

        {/* Circular health badge */}
        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-7 h-7 md:w-8 md:h-8 rounded-full bg-board-surface border border-board-accent flex items-center justify-center ${
          damageFlash ? 'animate-red-flash' : ''
        }`}>
          <span className="text-white font-bold text-sm md:text-base drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{health}</span>
        </div>

        {/* Float damage */}
        {floatDelta !== null && (
          <span className="absolute -top-2 right-0 text-spero-red font-bold text-sm animate-float-up-fade">
            {floatDelta}
          </span>
        )}
      </div>

      {!isOpponent && (
        <span className="text-xs text-gray-400 font-medium mt-1">{playerName}</span>
      )}
    </div>
  );
}
