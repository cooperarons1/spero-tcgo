import type { ClientStack } from '../../../shared/types';
import { CardStack } from './CardStack';

interface BattlefieldProps {
  stacks: ClientStack[];
  isOwner: boolean;
  onStackClick?: (stackId: string) => void;
  onCardClick?: (stackId: string, instanceId: string) => void;
  highlightedStackIds?: string[];
  actionLabels?: Record<string, string>;
}

export function Battlefield({
  stacks,
  isOwner,
  onStackClick,
  onCardClick,
  highlightedStackIds = [],
  actionLabels = {},
}: BattlefieldProps) {
  if (stacks.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-gray-600 text-sm italic">
        No stacks
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3 justify-center items-end p-2">
      {stacks.map((stack) => (
        <CardStack
          key={stack.stackId}
          stack={stack}
          isOwner={isOwner}
          onStackClick={onStackClick ? () => onStackClick(stack.stackId) : undefined}
          onCardClick={onCardClick ? (id) => onCardClick(stack.stackId, id) : undefined}
          highlighted={highlightedStackIds.includes(stack.stackId)}
          actionLabel={actionLabels[stack.stackId]}
        />
      ))}
    </div>
  );
}
