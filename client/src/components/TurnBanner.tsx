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

  // Layered banner: outer wrapper does the slide-in/slide-out (turn-banner
  // keyframe), the inner pill is the static surface, the absolute sweep
  // bar travels left→right behind the text once on entrance, and the
  // <span> scales+kerns the text so it lands with a "showtime" beat.
  return (
    <div className="fixed inset-x-0 top-0 z-40 flex justify-center pointer-events-none animate-turn-banner">
      <div
        className={`relative mt-16 px-10 py-3 rounded-full font-extrabold text-xl shadow-2xl overflow-hidden ${
          isMyTurn
            ? 'bg-spero-yellow text-black border-2 border-amber-200'
            : 'bg-slate-700 text-gray-300 border border-gray-600'
        }`}
      >
        {/* Sweep bar — only on the player's own turn so opponent turns
            stay subdued. The bar is brighter on the yellow background. */}
        {isMyTurn && (
          <div
            className="absolute inset-y-0 -inset-x-4 pointer-events-none animate-turn-banner-sweep"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0) 70%, transparent 100%)',
              mixBlendMode: 'screen',
            }}
          />
        )}
        <span className="relative inline-block animate-turn-banner-text">
          {isMyTurn ? 'YOUR TURN' : "OPPONENT'S TURN"}
        </span>
      </div>
    </div>
  );
}
