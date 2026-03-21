import type { ClientStack } from '../../../shared/types';
import type { GameEffect } from '../hooks/useGameAnimations';
import { Card } from './Card';
import { clientStackPower, clientStackSmarts, topCharacterName, clientStackColor } from '../utils/stackHelpers';

interface CardStackProps {
  stack: ClientStack;
  isOwner: boolean;
  onCardClick?: (instanceId: string) => void;
  onStackClick?: () => void;
  highlighted?: boolean;
  actionLabel?: string;
  isActionPhase?: boolean;
  acted?: boolean;
  turnNumber?: number;
  cardSize?: 'sm' | 'md';
  activeEffect?: GameEffect | null;
  animatingBuilds?: Set<string>;
}

export function CardStack({ stack, isOwner, onCardClick, onStackClick, highlighted, actionLabel, isActionPhase, acted, turnNumber, cardSize = 'md', activeEffect, animatingBuilds }: CardStackProps) {
  const power = clientStackPower(stack);
  const smarts = clientStackSmarts(stack);
  const name = topCharacterName(stack);
  const color = clientStackColor(stack);
  const hasSummoningSickness = turnNumber !== undefined && stack.createdOnTurn === turnNumber;

  // Determine VFX class based on active effect
  let vfxClass = '';
  if (activeEffect) {
    if (activeEffect.type === 'stun' && activeEffect.stackId === stack.stackId) {
      vfxClass = 'animate-damage-shake animate-stun-flip';
    } else if (activeEffect.type === 'damage' && activeEffect.stackId === stack.stackId) {
      vfxClass = 'animate-damage-shake animate-red-flash';
    } else if (activeEffect.type === 'restore' && activeEffect.stackId === stack.stackId) {
      vfxClass = 'animate-green-glow';
    }
  }

  const colorAccent: Record<string, string> = {
    red: 'border-spero-red/60',
    blue: 'border-spero-blue/60',
    green: 'border-spero-green/60',
    yellow: 'border-spero-yellow/60',
    black: 'border-spero-black/60',
    none: 'border-gray-500/60',
  };

  const cardOffset = Math.min(32, Math.max(16, 120 / stack.cards.length));
  const containerWidth = cardSize === 'sm' ? '108px' : '144px';
  const baseHeight = cardSize === 'sm' ? 60 : 80;

  return (
    <div
      className={`
        relative inline-flex flex-col items-center gap-1 p-2 rounded-xl
        border ${colorAccent[color] || colorAccent.none}
        ${stack.tapped ? 'opacity-60 rotate-6' : ''}
        ${highlighted ? 'ring-2 ring-spero-yellow shadow-lg shadow-spero-yellow/30' : ''}
        ${onStackClick ? 'cursor-pointer hover:bg-white/5' : ''}
        ${vfxClass}
        transition-all
      `}
      onClick={onStackClick}
    >
      {/* Fanned cards — dynamic offset */}
      <div className="relative" style={{ height: `${baseHeight + stack.cards.length * cardOffset}px`, width: containerWidth }}>
        {stack.cards.map((card, i) => (
          <div
            key={card.instanceId}
            className={`absolute left-0 hover:scale-125 hover:z-50 transition-transform duration-200 ${animatingBuilds?.has(card.instanceId) ? 'animate-card-deal' : ''}`}
            style={{ top: `${i * cardOffset}px`, zIndex: i }}
          >
            <Card
              card={card}
              size={cardSize}
              onClick={onCardClick ? () => onCardClick(card.instanceId) : undefined}
            />
          </div>
        ))}
      </div>

      {/* Stats bar */}
      <div className="flex gap-2 text-base font-bold">
        {power > 0 && <span className="text-red-400">P:{power}</span>}
        {smarts > 0 && <span className="text-blue-400">S:{smarts}</span>}
      </div>

      {/* Tapped indicator */}
      {stack.tapped && (
        <span className="absolute -top-1 -right-1 bg-gray-600 text-[8px] text-white px-1 rounded">
          TAP
        </span>
      )}

      {/* Action label */}
      {actionLabel && (
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-spero-yellow text-black text-[8px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
          {actionLabel}
        </span>
      )}

      {/* Summoning sickness indicator */}
      {hasSummoningSickness && (
        <span className="absolute -top-1 -left-1 bg-yellow-600 text-[8px] text-white px-1 rounded">
          NEW
        </span>
      )}

    </div>
  );
}
