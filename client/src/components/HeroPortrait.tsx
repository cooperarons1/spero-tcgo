import { useState, useEffect, useRef } from 'react';
import type { GameEffect } from '../hooks/useGameAnimations';

interface HeroPortraitProps {
  playerName: string;
  health: number;
  isOpponent: boolean;
  effects?: GameEffect[];
  playerIndex?: 0 | 1;
}

export function HeroPortrait({ playerName, health, isOpponent, effects, playerIndex }: HeroPortraitProps) {
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

  const healthColor = health > 7
    ? 'border-spero-green bg-spero-green/20 text-spero-green'
    : health >= 4
    ? 'border-spero-yellow bg-spero-yellow/20 text-spero-yellow'
    : health >= 1
    ? 'border-spero-red bg-spero-red/20 text-spero-red'
    : 'border-spero-red bg-spero-red/30 text-spero-red animate-pulse';

  return (
    <div className={`flex flex-col items-center gap-1 ${isOpponent ? '' : ''}`}>
      {/* Name above for opponent, below for player */}
      {isOpponent && (
        <span className="text-xs text-gray-400 font-medium">{playerName}</span>
      )}

      <div className="relative">
        {/* Portrait circle */}
        <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-board-accent bg-board-surface flex items-center justify-center overflow-hidden ${
          damageFlash ? 'animate-damage-shake' : ''
        }`}>
          {/* Generic silhouette placeholder */}
          <svg viewBox="0 0 40 40" className="w-10 h-10 text-gray-600">
            <circle cx="20" cy="14" r="8" fill="currentColor" />
            <ellipse cx="20" cy="36" rx="14" ry="10" fill="currentColor" />
          </svg>
        </div>

        {/* Health shield - overlapping bottom of portrait */}
        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full border-3 flex items-center justify-center font-bold text-sm md:text-base ${healthColor} ${
          damageFlash ? 'animate-red-flash' : ''
        }`}>
          {health}
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
