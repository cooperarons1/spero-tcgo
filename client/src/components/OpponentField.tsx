import type { ClientPlayerInfo } from '../../../shared/types';
import { Battlefield } from './Battlefield';

interface OpponentFieldProps {
  opponent: ClientPlayerInfo;
  onStackClick?: (stackId: string) => void;
  highlightedStackIds?: string[];
  opponentHovering?: boolean;
}

export function OpponentField({ opponent, onStackClick, highlightedStackIds }: OpponentFieldProps) {
  if (opponent.stacks.length === 0 && opponent.sideplay.length === 0) {
    return null;
  }

  return (
    <div className="bg-board-surface/40 rounded-xl p-3 border border-board-accent/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-gray-300">{opponent.playerName}</span>
      </div>
      <Battlefield
        stacks={opponent.stacks}
        isOwner={false}
        onStackClick={onStackClick}
        highlightedStackIds={highlightedStackIds}
      />
      {opponent.sideplay.length > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          Sideplay: {opponent.sideplay.length} card(s)
        </div>
      )}
    </div>
  );
}
