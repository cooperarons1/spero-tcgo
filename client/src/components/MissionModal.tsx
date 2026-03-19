import type { ClientStack } from '../../../shared/types';
import { clientStackPower, clientStackSmarts, topCharacterName } from '../utils/stackHelpers';

interface MissionModalProps {
  stacks: ClientStack[];
  actedStacks: string[];
  onPowerMission: (stackId: string) => void;
  onSmartsMission: (stackId: string) => void;
  onDuel: (attackerStackId: string) => void;
  onCancel: () => void;
}

export function MissionModal({ stacks, actedStacks, onPowerMission, onSmartsMission, onDuel, onCancel }: MissionModalProps) {
  const availableStacks = stacks.filter((s) => !s.tapped && !actedStacks.includes(s.stackId));

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-bounce-in">
      <div className="bg-board-surface rounded-2xl p-6 shadow-2xl max-w-lg w-full mx-4 border border-board-accent">
        <h3 className="text-xl font-bold text-center mb-4 text-white">Choose Action</h3>

        {availableStacks.length === 0 ? (
          <p className="text-center text-gray-500 italic mb-4">No available stacks to act with.</p>
        ) : (
          <div className="space-y-3 mb-4">
            {availableStacks.map((stack) => {
              const power = clientStackPower(stack);
              const smarts = clientStackSmarts(stack);
              const name = topCharacterName(stack);

              return (
                <div key={stack.stackId} className="bg-board-accent rounded-lg p-3">
                  <div className="font-bold text-white mb-2">{name} ({stack.cards.length} cards)</div>
                  <div className="flex gap-2 flex-wrap">
                    {power > 0 && (
                      <button
                        onClick={() => onPowerMission(stack.stackId)}
                        className="bg-spero-red text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                      >
                        Power Mission (P:{power})
                      </button>
                    )}
                    {smarts > 0 && (
                      <button
                        onClick={() => onSmartsMission(stack.stackId)}
                        className="bg-spero-blue text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                      >
                        Smarts Mission (S:{smarts})
                      </button>
                    )}
                    <button
                      onClick={() => onDuel(stack.stackId)}
                      className="bg-spero-black text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                    >
                      Duel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={onCancel}
          className="w-full bg-board-accent text-gray-400 font-bold py-2 px-4 rounded-lg hover:bg-board-accent/80 transition-all cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
