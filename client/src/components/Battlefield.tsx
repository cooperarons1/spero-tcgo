import type { ClientStack } from '../../../shared/types';
import { CardStack } from './CardStack';

interface BattlefieldProps {
  stacks: ClientStack[];
  isOwner: boolean;
  onStackClick?: (stackId: string) => void;
  onCardClick?: (stackId: string, instanceId: string) => void;
  highlightedStackIds?: string[];
  actionLabels?: Record<string, string>;
  showNewStackSlots?: boolean;
  onNewStack?: () => void;
  isActionPhase?: boolean;
  actedStacks?: string[];
  onPowerMission?: (stackId: string) => void;
  onSmartsMission?: (stackId: string) => void;
  onDuel?: (stackId: string) => void;
  isDragActive?: boolean;
  hoveredDropTarget?: string | null;
  turnNumber?: number;
}

export function Battlefield({
  stacks,
  isOwner,
  onStackClick,
  onCardClick,
  highlightedStackIds = [],
  actionLabels = {},
  showNewStackSlots = false,
  onNewStack,
  isActionPhase = false,
  actedStacks = [],
  onPowerMission,
  onSmartsMission,
  onDuel,
  isDragActive = false,
  hoveredDropTarget = null,
  turnNumber,
}: BattlefieldProps) {
  const showNewSlot = showNewStackSlots || isDragActive;
  const isNewHovered = hoveredDropTarget === 'new';

  if (stacks.length === 0 && !showNewSlot) {
    return <div className="min-h-[80px]" />;
  }

  return (
    <div className="flex gap-3 justify-center flex-wrap">
      {stacks.map((stack) => {
        const isHovered = hoveredDropTarget === stack.stackId;
        return (
          <div
            key={stack.stackId}
            data-drop-stack={stack.stackId}
            className={`transition-all rounded-xl ${
              isDragActive ? 'ring-1 ring-spero-yellow/30 animate-lane-pulse' : ''
            } ${isHovered ? 'ring-2 ring-spero-yellow bg-spero-yellow/10' : ''}`}
          >
            <CardStack
              stack={stack}
              isOwner={isOwner}
              onStackClick={onStackClick ? () => onStackClick(stack.stackId) : undefined}
              onCardClick={onCardClick ? (id) => onCardClick(stack.stackId, id) : undefined}
              highlighted={highlightedStackIds.includes(stack.stackId)}
              actionLabel={actionLabels[stack.stackId]}
              isActionPhase={isActionPhase}
              acted={actedStacks.includes(stack.stackId)}
              onPowerMission={onPowerMission}
              onSmartsMission={onSmartsMission}
              onDuel={onDuel}
              turnNumber={turnNumber}
            />
          </div>
        );
      })}
      {showNewSlot && (
        <div
          data-drop-lane="new"
          className={`w-[120px] min-h-[140px] rounded-xl border-2 border-dashed flex items-center justify-center transition-all
            ${isNewHovered ? 'ring-2 ring-spero-yellow bg-spero-yellow/10 border-spero-yellow' : 'border-spero-yellow/40'}
            ${showNewStackSlots ? 'hover:bg-spero-yellow/5 cursor-pointer' : ''}
            ${isDragActive ? 'animate-lane-pulse' : ''}`}
          onClick={showNewStackSlots ? onNewStack : undefined}
        >
          <span className="text-spero-yellow/60 text-sm font-bold">+ New</span>
        </div>
      )}
    </div>
  );
}
