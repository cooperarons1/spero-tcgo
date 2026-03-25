import { useEffect, useState } from 'react';

interface SpellFlight {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  phase: 'fly' | 'impact';
}

interface Props {
  spell: { cardCode: string; targetId: string } | null;
  onComplete: () => void;
}

export function SpellCastEffect({ spell, onComplete }: Props) {
  const [flight, setFlight] = useState<SpellFlight | null>(null);

  useEffect(() => {
    if (!spell) return;

    // Source: approximate hand position (bottom center)
    const fromX = window.innerWidth / 2;
    const fromY = window.innerHeight - 100;

    // Target: find by entity id
    const targetEl = document.querySelector(`[data-entity-id="${spell.targetId}"]`);
    if (!targetEl) {
      onComplete();
      return;
    }
    const rect = targetEl.getBoundingClientRect();
    const toX = rect.left + rect.width / 2;
    const toY = rect.top + rect.height / 2;

    const id = `spell-${Date.now()}`;
    setFlight({ id, fromX, fromY, toX, toY, phase: 'fly' });

    // After fly animation, show impact
    const flyTimer = setTimeout(() => {
      setFlight(prev => prev ? { ...prev, phase: 'impact' } : null);
    }, 400);

    // Clean up after impact
    const impactTimer = setTimeout(() => {
      setFlight(null);
      onComplete();
    }, 700);

    return () => {
      clearTimeout(flyTimer);
      clearTimeout(impactTimer);
    };
  }, [spell, onComplete]);

  if (!flight) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {flight.phase === 'fly' && (
        <div
          className="absolute w-8 h-10 rounded-lg bg-violet-500/80 border border-violet-300/60 shadow-[0_0_16px_rgba(139,92,246,0.7)] animate-spell-fly"
          style={{
            '--from-x': `${flight.fromX}px`,
            '--from-y': `${flight.fromY}px`,
            '--to-x': `${flight.toX}px`,
            '--to-y': `${flight.toY}px`,
          } as React.CSSProperties}
        />
      )}
      {flight.phase === 'impact' && (
        <div
          className="absolute animate-spell-impact"
          style={{
            left: flight.toX,
            top: flight.toY,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="w-16 h-16 rounded-full bg-violet-400/60 shadow-[0_0_30px_rgba(139,92,246,0.8)]" />
        </div>
      )}
    </div>
  );
}
