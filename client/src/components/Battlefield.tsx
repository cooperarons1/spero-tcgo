import type { ClientStack } from '../../../shared/types';
import type { GameEffect } from '../hooks/useGameAnimations';
import { CardStack } from './CardStack';
import { clientStackPower, clientStackSmarts, topCharacterName } from '../utils/stackHelpers';

interface MissionPopoverProps {
  stackId: string;
  power: number;
  smarts: number;
  name: string;
  onPowerMission: () => void;
  onSmartsMission: () => void;
  onCancel: () => void;
}

function MissionPopover({ power, smarts, name, onPowerMission, onSmartsMission, onCancel }: MissionPopoverProps) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 animate-bounce-in" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-col items-center gap-2 bg-board-surface border border-board-accent rounded-xl p-3 shadow-2xl min-w-[180px]">
        <div className="text-xs font-bold text-white">{name}</div>
        <div className="flex gap-2">
          {power > 0 && (
            <button
              onClick={onPowerMission}
              className="flex flex-col items-center gap-0.5 bg-spero-red text-white font-bold px-4 py-2 rounded-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer text-sm"
            >
              <span>Power</span>
              <span className="text-lg">{power}</span>
            </button>
          )}
          {smarts > 0 && (
            <button
              onClick={onSmartsMission}
              className="flex flex-col items-center gap-0.5 bg-spero-blue text-white font-bold px-4 py-2 rounded-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer text-sm"
            >
              <span>Smarts</span>
              <span className="text-lg">{smarts}</span>
            </button>
          )}
        </div>
        <button
          onClick={onCancel}
          className="text-gray-400 text-xs underline cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface BattlefieldProps {
  stacks: ClientStack[];
  isOwner: boolean;
  onStackClick?: (stackId: string) => void;
  onCardClick?: (stackId: string, instanceId: string) => void;
  highlightedStackIds?: string[];
  highlightStyle?: 'default' | 'block';
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
  onRestoreCard?: (stackId: string, cardInstanceId: string) => void;
  canRestore?: boolean;
  // Mission popover
  selectedStackId?: string;
  onPowerMission?: (stackId: string) => void;
  onSmartsMission?: (stackId: string) => void;
  onMissionCancel?: () => void;
  // Ready stack glow
  readyStackIds?: string[];
  // Dim stacks that are not highlighted (e.g. during block phase)
  dimNonHighlighted?: boolean;
  // Card inspect callback
  onInspect?: (cardCode: string) => void;
  // Split-drag from stack
  onDragStartFromStack?: (stackId: string, cardInstanceId: string, e: React.PointerEvent) => void;
  canSplitDrag?: boolean;
}

export function Battlefield({
  stacks,
  isOwner,
  onStackClick,
  onCardClick,
  highlightedStackIds = [],
  highlightStyle = 'default',
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
  onRestoreCard,
  canRestore,
  selectedStackId,
  onPowerMission,
  onSmartsMission,
  onMissionCancel,
  readyStackIds = [],
  dimNonHighlighted = false,
  onInspect,
  onDragStartFromStack,
  canSplitDrag,
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

  // Hearthstone-style gaps: narrow base, adjacent stacks slide apart when hovered
  const gapClass = (index: number) => {
    const isHovered = hoveredDropTarget === `gap-${index}`;
    return `flex-shrink-0 rounded-lg border-2 border-dashed transition-all duration-200 self-stretch flex items-center justify-center
      ${showGaps
        ? `${isHovered ? 'w-2 border-spero-yellow bg-spero-yellow/10' : 'w-2 border-spero-yellow/30 hover:border-spero-yellow/60'}
           cursor-pointer ${isDragActive ? 'animate-lane-pulse' : ''}`
        : 'w-0 border-transparent pointer-events-none overflow-hidden'}`;
  };

  // Compute margin classes for stacks adjacent to a hovered gap
  const getStackMargin = (stackIndex: number) => {
    if (!hoveredDropTarget?.startsWith('gap-')) return '';
    const gapIndex = parseInt(hoveredDropTarget.split('-')[1], 10);
    const classes: string[] = [];
    // Stack before the gap gets right margin
    if (stackIndex === gapIndex - 1) classes.push('mr-8');
    // Stack after the gap gets left margin
    if (stackIndex === gapIndex) classes.push('ml-8');
    return classes.join(' ');
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
        const isReady = readyStackIds.includes(stack.stackId);
        const isSelected = selectedStackId === stack.stackId;
        const isBlockHighlighted = highlightStyle === 'block' && highlightedStackIds.includes(stack.stackId);
        const isDimmed = dimNonHighlighted && !highlightedStackIds.includes(stack.stackId);
        const stackMargin = getStackMargin(i);
        return (
          <div key={stack.stackId} className={`flex items-start transition-all duration-200 ${stackMargin}`}>
            <div
              data-drop-stack={stack.stackId}
              className={`transition-all rounded-xl relative ${
                isDragActive ? 'ring-1 ring-spero-yellow/30 animate-lane-pulse' : ''
              } ${isHovered ? 'ring-2 ring-spero-yellow bg-spero-yellow/10' : ''
              } ${isBlockHighlighted ? 'ring-2 ring-spero-blue animate-pulse shadow-lg shadow-spero-blue/30' : ''
              } ${isDimmed ? 'opacity-50' : ''}`}
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
                isReady={isReady}
                onRestoreCard={onRestoreCard}
                canRestore={canRestore}
                onInspect={onInspect}
                onDragStartFromStack={onDragStartFromStack}
                canSplitDrag={canSplitDrag}
              />
              {/* Mission popover positioned near the stack */}
              {isSelected && onPowerMission && onSmartsMission && onMissionCancel && (
                <MissionPopover
                  stackId={stack.stackId}
                  power={clientStackPower(stack)}
                  smarts={clientStackSmarts(stack)}
                  name={topCharacterName(stack)}
                  onPowerMission={() => onPowerMission(stack.stackId)}
                  onSmartsMission={() => onSmartsMission(stack.stackId)}
                  onCancel={onMissionCancel}
                />
              )}
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
