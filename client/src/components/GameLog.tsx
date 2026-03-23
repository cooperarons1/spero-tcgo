import { useEffect, useRef } from 'react';
import type { LogEntry, LogCategory } from '../../../shared/types';

const categoryColors: Record<LogCategory, string> = {
  PLAY: 'border-spero-green',
  COMBAT: 'border-spero-red',
  EFFECT: 'border-amber-400',
  TURN: 'border-spero-blue',
  GAME: 'border-purple-400',
};

const categoryLabels: Record<LogCategory, string> = {
  PLAY: 'PLY',
  COMBAT: 'CMB',
  EFFECT: 'EFF',
  TURN: 'TRN',
  GAME: 'GM',
};

interface GameLogProps {
  log: LogEntry[];
  myPlayerIndex: 0 | 1;
  onClose?: () => void;
}

export function GameLog({ log, myPlayerIndex }: GameLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 py-1.5">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Game Log</span>
      </div>

      <div className="flex-1 overflow-y-auto px-1 py-1 space-y-0.5">
        {log.map((entry) => {
          const isMe = entry.playerIndex === myPlayerIndex;
          const isOpponent = entry.playerIndex !== null && !isMe;

          return (
            <div
              key={entry.id}
              className={`flex items-start gap-1.5 text-[11px] py-0.5 border-l-2 pl-1.5 ${categoryColors[entry.category]}`}
            >
              <span className="text-gray-600 shrink-0 w-4 text-right">{entry.turnNumber}</span>
              <span className="text-gray-500 shrink-0 w-6 text-[9px] font-mono">
                {categoryLabels[entry.category]}
              </span>
              <span
                className={`leading-snug ${
                  isMe ? 'text-spero-green' : isOpponent ? 'text-spero-red' : 'text-gray-400'
                }`}
              >
                {entry.message}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
