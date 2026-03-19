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
}

export function CardStack({ stack, isOwner, onCardClick, onStackClick, highlighted, actionLabel }: CardStackProps) {
  const power = clientStackPower(stack);
  const smarts = clientStackSmarts(stack);
  const name = topCharacterName(stack);
  const color = clientStackColor(stack);

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
      {/* Stack name */}
      <div className="text-[10px] font-bold text-gray-300 truncate max-w-20">
        {name}
      </div>

      {/* Fanned cards */}
      <div className="relative" style={{ height: `${Math.min(120, 50 + stack.cards.length * 16)}px`, width: '64px' }}>
        {stack.cards.map((card, i) => (
          <div
            key={card.instanceId}
            className="absolute left-0"
            style={{ top: `${i * 16}px`, zIndex: i }}
          >
            <Card
              card={card}
              size="sm"
              onClick={onCardClick ? () => onCardClick(card.instanceId) : undefined}
            />
          </div>
        ))}
      </div>

      {/* Stats bar */}
      <div className="flex gap-2 text-[10px] font-bold">
        {smarts > 0 && <span className="text-blue-400">S:{smarts}</span>}
        {power > 0 && <span className="text-red-400">P:{power}</span>}
        <span className="text-gray-500">x{stack.cards.length}</span>
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
    </div>
  );
}
