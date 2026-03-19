import { useEffect, useRef } from 'react';
import type { LogEntry, LogCategory } from '../../../shared/types';

const categoryColors: Record<LogCategory, string> = {
  BUILD: 'border-spero-green',
  MISSION: 'border-spero-yellow',
  COMBAT: 'border-spero-red',
  AP: 'border-amber-400',
  PHASE: 'border-spero-blue',
  GAME: 'border-purple-400',
};

const categoryLabels: Record<LogCategory, string> = {
  BUILD: 'BLD',
  MISSION: 'MSN',
  COMBAT: 'CMB',
  AP: 'AP',
  PHASE: 'PHS',
  GAME: 'GM',
};

interface GameLogProps {
  log: LogEntry[];
  myPlayerIndex: 0 | 1;
  onClose: () => void;
}

export function GameLog({ log, myPlayerIndex, onClose }: GameLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  return (
    <div className="w-[280px] bg-board-surface border-l border-board-accent flex flex-col h-full shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-board-accent">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Game Log</span>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white text-sm cursor-pointer"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {log.map((entry) => {
          const isMe = entry.playerIndex === myPlayerIndex;
          const isOpponent = entry.playerIndex !== null && !isMe;

          return (
            <div
              key={entry.id}
              className={`flex items-start gap-2 text-xs py-1 border-l-2 pl-2 ${categoryColors[entry.category]}`}
            >
              <span className="text-gray-600 shrink-0 w-5 text-right">{entry.turnNumber}</span>
              <span className="text-gray-500 shrink-0 w-7 text-[10px] font-mono">
                {categoryLabels[entry.category]}
              </span>
              <span
                className={`leading-relaxed ${
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
