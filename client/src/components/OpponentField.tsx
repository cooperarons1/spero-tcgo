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
  onInspect?: (cardCode: string) => void;
}

export function OpponentField({ opponent, onStackClick, highlightedStackIds, cardSize, getStackEffect, onInspect }: OpponentFieldProps) {
  if (opponent.stacks.length === 0 && opponent.sideplay.length === 0) {
    return null;
  }

  return (
    <div>
      <Battlefield
        stacks={opponent.stacks}
        isOwner={false}
        onStackClick={onStackClick}
        highlightedStackIds={highlightedStackIds}
        cardSize={cardSize}
        getStackEffect={getStackEffect}
        onInspect={onInspect}
      />
      {opponent.sideplay.length > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          Sideplay: {opponent.sideplay.length} card(s)
        </div>
      )}
    </div>
  );
}
