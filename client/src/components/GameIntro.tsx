import { useEffect } from 'react';

interface GameIntroProps {
  myName: string;
  opponentName: string;
  firstPlayerName: string;
  onDismiss: () => void;
}

export function GameIntro({ myName, opponentName, firstPlayerName, onDismiss }: GameIntroProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer"
      onClick={onDismiss}
    >
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <div className="flex items-center gap-6 md:gap-10">
          <div className="text-2xl md:text-4xl font-bold text-spero-yellow text-right min-w-[100px]">
            {myName}
          </div>
          <div className="text-3xl md:text-5xl font-black text-gray-500">VS</div>
          <div className="text-2xl md:text-4xl font-bold text-gray-300 text-left min-w-[100px]">
            {opponentName}
          </div>
        </div>
        <div className="text-sm md:text-base text-gray-400">
          First turn: <span className="text-white font-bold">{firstPlayerName}</span>
        </div>
      </div>
    </div>
  );
}
