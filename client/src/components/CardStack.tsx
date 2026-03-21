import type { ClientStack } from '../../../shared/types';
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
  onPowerMission?: (stackId: string) => void;
  onSmartsMission?: (stackId: string) => void;
  onDuel?: (stackId: string) => void;
  turnNumber?: number;
}

export function CardStack({ stack, isOwner, onCardClick, onStackClick, highlighted, actionLabel, isActionPhase, acted, onPowerMission, onSmartsMission, onDuel, turnNumber }: CardStackProps) {
  const power = clientStackPower(stack);
  const smarts = clientStackSmarts(stack);
  const name = topCharacterName(stack);
  const color = clientStackColor(stack);
  const hasSummoningSickness = turnNumber !== undefined && stack.createdOnTurn === turnNumber;

  const colorAccent: Record<string, string> = {
    red: 'border-spero-red/60',
    blue: 'border-spero-blue/60',
    green: 'border-spero-green/60',
    yellow: 'border-spero-yellow/60',
    black: 'border-spero-black/60',
    none: 'border-gray-500/60',
  };

  return (
    <div
      className={`
        relative inline-flex flex-col items-center gap-1 p-2 rounded-xl
        border ${colorAccent[color] || colorAccent.none}
        ${stack.tapped ? 'opacity-60 rotate-6' : ''}
        ${highlighted ? 'ring-2 ring-spero-yellow shadow-lg shadow-spero-yellow/30' : ''}
        ${onStackClick ? 'cursor-pointer hover:bg-white/5' : ''}
        transition-all
      `}
      onClick={onStackClick}
    >
      {/* Fanned cards — no height cap */}
      <div className="relative" style={{ height: `${80 + stack.cards.length * 32}px`, width: '144px' }}>
        {stack.cards.map((card, i) => (
          <div
            key={card.instanceId}
            className="absolute left-0 hover:scale-125 hover:z-50 transition-transform duration-200"
            style={{ top: `${i * 32}px`, zIndex: i }}
          >
            <Card
              card={card}
              size="md"
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

      {/* Inline action buttons during ACTION phase */}
      {isActionPhase && !stack.tapped && !acted && !hasSummoningSickness && (
        <div className="flex gap-1 mt-1.5 justify-center animate-action-pop">
          {power > 0 && (
            <button onClick={(e) => { e.stopPropagation(); onPowerMission?.(stack.stackId); }}
              className="bg-spero-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full hover:brightness-125 active:scale-95 transition-all cursor-pointer">
              PWR
            </button>
          )}
          {smarts > 0 && (
            <button onClick={(e) => { e.stopPropagation(); onSmartsMission?.(stack.stackId); }}
              className="bg-spero-blue text-white text-[10px] font-bold px-2 py-0.5 rounded-full hover:brightness-125 active:scale-95 transition-all cursor-pointer">
              SMT
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDuel?.(stack.stackId); }}
            className="bg-gray-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full hover:brightness-125 active:scale-95 transition-all cursor-pointer">
            DUEL
          </button>
        </div>
      )}
    </div>
  );
}
