import type { ClientStack } from '../../../shared/types';
import type { GameEffect } from '../hooks/useGameAnimations';
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
  onNewStackAtIndex?: (index: number) => void;
  isActionPhase?: boolean;
  actedStacks?: string[];
  isDragActive?: boolean;
  hoveredDropTarget?: string | null;
  turnNumber?: number;
  cardSize?: 'sm' | 'md';
  stackOrder?: string[];
  getStackEffect?: (stackId: string) => GameEffect | null;
  animatingBuilds?: Set<string>;
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
  onNewStackAtIndex,
  isActionPhase = false,
  actedStacks = [],
  isDragActive = false,
  hoveredDropTarget = null,
  turnNumber,
  cardSize,
  stackOrder,
  getStackEffect,
  animatingBuilds,
}: BattlefieldProps) {
  const showGaps = showNewStackSlots || isDragActive;

  // Order stacks according to stackOrder if provided
  const orderedStacks = stackOrder
    ? (() => {
        const stackMap = new Map(stacks.map(s => [s.stackId, s]));
        const ordered: ClientStack[] = [];
        for (const id of stackOrder) {
          const s = stackMap.get(id);
          if (s) {
            ordered.push(s);
            stackMap.delete(id);
          }
        }
        // Append any stacks not in the order
        for (const s of stackMap.values()) {
          ordered.push(s);
        }
        return ordered;
      })()
    : stacks;

  if (orderedStacks.length === 0 && !showGaps) {
    return <div className="min-h-[80px]" />;
  }

  const gapClass = (index: number) => {
    const isHovered = hoveredDropTarget === `gap-${index}`;
    return `flex-shrink-0 rounded-lg border-2 border-dashed transition-all self-stretch flex items-center justify-center
      ${showGaps
        ? `${isHovered ? 'w-20 border-spero-yellow bg-spero-yellow/10 ring-2 ring-spero-yellow' : 'w-4 border-spero-yellow/30 hover:w-12 hover:border-spero-yellow/60 hover:bg-spero-yellow/5'}
           cursor-pointer ${isDragActive ? 'animate-lane-pulse' : ''}`
        : 'w-0 border-transparent pointer-events-none overflow-hidden'}`;
  };

  const handleGapClick = (index: number) => {
    if (showNewStackSlots) {
      if (onNewStackAtIndex) {
        onNewStackAtIndex(index);
      } else {
        onNewStack?.();
      }
    }
  };

  return (
    <div className={`flex ${cardSize === 'sm' ? 'gap-2' : 'gap-3'} justify-center flex-wrap items-start`}>
      {/* Leading gap */}
      <div
        data-drop-lane="new"
        data-drop-index={0}
        className={gapClass(0)}
        onClick={() => handleGapClick(0)}
      />

      {orderedStacks.map((stack, i) => {
        const isHovered = hoveredDropTarget === stack.stackId;
        return (
          <div key={stack.stackId} className="flex items-start">
            <div
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
                turnNumber={turnNumber}
                cardSize={cardSize}
                activeEffect={getStackEffect?.(stack.stackId) ?? null}
                animatingBuilds={animatingBuilds}
              />
            </div>
            {/* Trailing gap after each stack */}
            <div
              data-drop-lane="new"
              data-drop-index={i + 1}
              className={gapClass(i + 1)}
              onClick={() => handleGapClick(i + 1)}
            />
          </div>
        );
      })}
    </div>
  );
}
