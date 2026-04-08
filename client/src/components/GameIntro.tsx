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

  // Match-cinematic intro: my name slides from the left, opponent slides
  // from the right, the VS pops in with an overshoot + golden flare, and
  // the "first turn" subtext fades up last (delays baked into the
  // keyframes via animation-delay). Background gets a faint amber radial
  // gradient pulse to lift the splash above plain black.
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center cursor-pointer overflow-hidden bg-black/85 backdrop-blur-sm"
      onClick={onDismiss}
    >
      {/* Soft radial vignette so the center reads warmer than the edges */}
      <div
        className="pointer-events-none absolute inset-0 animate-fade-in"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.05) 30%, transparent 65%)',
        }}
      />
      <div className="relative flex flex-col items-center gap-6">
        <div className="flex items-center gap-6 md:gap-12">
          <div className="text-2xl md:text-5xl font-bold text-spero-yellow text-right min-w-[120px] md:min-w-[180px] drop-shadow-[0_2px_8px_rgba(245,158,11,0.4)] animate-intro-name-left">
            {myName}
          </div>
          <div
            className="text-3xl md:text-6xl font-black text-amber-400 animate-intro-vs"
            style={{ textShadow: '0 0 8px rgba(245,158,11,0.4)' }}
          >
            VS
          </div>
          <div className="text-2xl md:text-5xl font-bold text-gray-200 text-left min-w-[120px] md:min-w-[180px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] animate-intro-name-right">
            {opponentName}
          </div>
        </div>
        <div className="text-sm md:text-base text-gray-400 animate-intro-subtext">
          First turn: <span className="text-white font-bold">{firstPlayerName}</span>
        </div>
      </div>
    </div>
  );
}
