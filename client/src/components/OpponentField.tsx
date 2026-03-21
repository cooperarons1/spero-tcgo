import type { ClientPlayerInfo } from '../../../shared/types';
import type { GameEffect } from '../hooks/useGameAnimations';
import { Battlefield } from './Battlefield';

interface OpponentFieldProps {
  opponent: ClientPlayerInfo;
  onStackClick?: (stackId: string) => void;
  highlightedStackIds?: string[];
  opponentHovering?: boolean;
  cardSize?: 'sm' | 'md';
  getStackEffect?: (stackId: string) => GameEffect | null;
}

export function OpponentField({ opponent, onStackClick, highlightedStackIds, cardSize, getStackEffect }: OpponentFieldProps) {
  if (opponent.stacks.length === 0 && opponent.sideplay.length === 0) {
    return null;
  }

  return (
    <div className="bg-board-surface/40 rounded-xl p-3 border border-board-accent/50">
      <Battlefield
        stacks={opponent.stacks}
        isOwner={false}
        onStackClick={onStackClick}
        highlightedStackIds={highlightedStackIds}
        cardSize={cardSize}
        getStackEffect={getStackEffect}
      />
      {opponent.sideplay.length > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          Sideplay: {opponent.sideplay.length} card(s)
        </div>
      )}
    </div>
  );
}
