import { useEffect, useState } from 'react';
import type { PendingInteraction } from '../../../shared/types';
import { Card } from './Card';

interface TargetingModalProps {
  interaction: PendingInteraction;
  onChooseTarget: (interactionId: string, selectedId: string | null) => void;
  onInspect?: (cardCode: string) => void;
}

export function TargetingModal({ interaction, onChooseTarget, onInspect }: TargetingModalProps) {
  const choice = interaction.targetChoice;
  if (!choice) return null;

  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, Math.ceil((interaction.timeoutAt - Date.now()) / 1000)));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((interaction.timeoutAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [interaction.timeoutAt]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-board-surface rounded-2xl p-6 shadow-2xl max-w-lg w-full mx-4 border border-board-accent animate-bounce-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Choose Target</h2>
          <span className={`text-sm font-bold ${timeLeft <= 10 ? 'text-spero-red animate-timer-urgent' : 'text-gray-400'}`}>
            {timeLeft}s
          </span>
        </div>

        <p className="text-sm text-gray-300 mb-4">{choice.prompt}</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
          {choice.validTargets.map(target => (
            <button
              key={target.id}
              onClick={() => onChooseTarget(choice.interactionId, target.id)}
              className="bg-board-accent rounded-xl p-3 text-left hover:ring-2 hover:ring-spero-yellow active:scale-95 transition-all cursor-pointer"
            >
              {(choice.targetType === 'card-in-stack' || choice.targetType === 'card-in-discard' || choice.targetType === 'card-in-deck') ? (
                <div className="flex flex-col items-center gap-1">
                  <Card
                    card={{ instanceId: target.id, cardCode: target.id.split(':')[0] || target.id, faceUp: true }}
                    size="sm"
                    onInspect={onInspect}
                  />
                  <span className="text-xs text-white font-medium truncate w-full text-center">{target.label}</span>
                  {target.sublabel && <span className="text-[10px] text-gray-500">{target.sublabel}</span>}
                </div>
              ) : (
                <div>
                  <span className="text-sm text-white font-medium">{target.label}</span>
                  {target.sublabel && <p className="text-[10px] text-gray-500 mt-1">{target.sublabel}</p>}
                </div>
              )}
            </button>
          ))}
        </div>

        {choice.allowSkip && (
          <button
            onClick={() => onChooseTarget(choice.interactionId, null as any)}
            className="mt-4 w-full bg-board-accent text-gray-400 py-2 rounded-xl hover:bg-board-accent/80 cursor-pointer text-sm"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
