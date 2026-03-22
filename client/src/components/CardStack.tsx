import type { ClientStack } from '../../../shared/types';
import type { GameEffect } from '../hooks/useGameAnimations';
import { Card } from './Card';
import { clientStackPower, clientStackSmarts, topCharacterName, clientStackColor, clientStackGroup, getCardDef } from '../utils/stackHelpers';

interface CardStackProps {
  stack: ClientStack;
  isOwner: boolean;
  onCardClick?: (instanceId: string) => void;
  onStackClick?: () => void;
  highlighted?: boolean;
  actionLabel?: string;
  isActionPhase?: boolean;
  acted?: boolean;
  isReady?: boolean;
  turnNumber?: number;
  cardSize?: 'sm' | 'md';
  activeEffect?: GameEffect | null;
  animatingBuilds?: Set<string>;
  onRestoreCard?: (stackId: string, cardInstanceId: string) => void;
  canRestore?: boolean;
  onInspect?: (cardCode: string) => void;
  onDragStartFromStack?: (stackId: string, cardInstanceId: string, e: React.PointerEvent) => void;
  canSplitDrag?: boolean;
}

export function CardStack({ stack, isOwner, onCardClick, onStackClick, highlighted, actionLabel, isActionPhase, acted, isReady, turnNumber, cardSize = 'md', activeEffect, animatingBuilds, onRestoreCard, canRestore, onInspect, onDragStartFromStack, canSplitDrag }: CardStackProps) {
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
        ${hasSummoningSickness ? 'border-dashed' : ''}
        ${stack.tapped ? 'opacity-60 rotate-12 grayscale' : acted ? 'opacity-70' : ''}
        ${highlighted ? 'ring-2 ring-spero-yellow shadow-lg shadow-spero-yellow/30' : ''}
        ${isReady ? 'ring-2 ring-green-500/50 animate-pulse' : ''}
        ${onStackClick ? 'cursor-pointer hover:bg-white/5' : ''}
        ${vfxClass}
        transition-all
      `}
      onClick={onStackClick}
    >
      {/* Fanned cards — dynamic offset */}
      <div className="relative" style={{ height: `${baseHeight + stack.cards.length * cardOffset}px`, width: containerWidth }}>
        {stack.cards.map((card, i) => {
          const canFlip = canRestore && !card.faceUp && card.cardCode && (() => {
            const def = getCardDef(card.cardCode!);
            if (!def) return false;
            if (def.cost > stack.cards.length) return false;
            // Color check
            if (def.color !== 'none') {
              const sCol = clientStackColor(stack);
              if (sCol !== 'none' && sCol !== def.color) return false;
            }
            // Stack group check for characters
            if (def.typeA === 'CHARACTER' && def.stackGroup) {
              const existing = clientStackGroup(stack);
              if (existing && existing !== def.stackGroup) return false;
            }
            // Duplicate name check
            if (stack.cards.some(c => c.faceUp && c.instanceId !== card.instanceId && c.cardCode && getCardDef(c.cardCode)?.name === def.name)) return false;
            return true;
          })();
          return (
            <div
              key={card.instanceId}
              className={`absolute left-0 group hover:scale-125 hover:z-50 transition-transform duration-200 ${animatingBuilds?.has(card.instanceId) ? 'animate-card-deal' : ''}`}
              style={{ top: `${i * cardOffset}px`, zIndex: i }}
              onPointerDown={canSplitDrag && stack.cards.length > 1 ? (e) => {
                e.stopPropagation();
                onDragStartFromStack?.(stack.stackId, card.instanceId, e);
              } : undefined}
            >
              <Card
                card={card}
                size={cardSize}
                onClick={onCardClick ? () => onCardClick(card.instanceId) : undefined}
                onInspect={onInspect}
              />
              {canFlip && (
                <button
                  className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-lg cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestoreCard?.(stack.stackId, card.instanceId);
                  }}
                >
                  <span className="bg-spero-yellow text-black text-xs font-bold px-3 py-1 rounded-full shadow">Flip</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Stats bar — colored circle badges */}
      <div className="flex gap-1.5 items-center">
        {power > 0 && (
          <div className="w-7 h-7 rounded-full bg-spero-red flex items-center justify-center shadow">
            <span className="text-white font-black text-sm">{power}</span>
          </div>
        )}
        {smarts > 0 && (
          <div className="w-7 h-7 rounded-full bg-spero-blue flex items-center justify-center shadow">
            <span className="text-white font-black text-sm">{smarts}</span>
          </div>
        )}
      </div>

      {/* Stack name */}
      {name && (
        <div className="text-[10px] text-gray-400 truncate max-w-[100px] text-center">{name}</div>
      )}

      {/* Acted indicator — positioned to avoid conflict with tapped rotation */}
      {acted && !stack.tapped && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center text-[10px] text-white">
          ✓
        </span>
      )}

      {/* Action label */}
      {actionLabel && (
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-spero-yellow text-black text-[8px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
          {actionLabel}
        </span>
      )}

    </div>
  );
}
