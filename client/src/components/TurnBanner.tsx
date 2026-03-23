import { useEffect, useState } from 'react';

interface TurnBannerProps {
  isMyTurn: boolean;
}

export function TurnBanner({ isMyTurn }: TurnBannerProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-40 flex justify-center pointer-events-none animate-turn-banner">
      <div
        className={`mt-16 px-8 py-3 rounded-full font-extrabold text-xl shadow-2xl ${
          isMyTurn
            ? 'bg-spero-yellow text-black'
            : 'bg-slate-700 text-gray-300 border border-gray-600'
        }`}
      >
        {isMyTurn ? 'YOUR TURN' : "OPPONENT'S TURN"}
      </div>
    </div>
  );
}
