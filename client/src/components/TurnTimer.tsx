import { useEffect, useRef, useState } from 'react';

interface TurnTimerProps {
  deadline: number | null;
  isMyTurn: boolean;
}

export function TurnTimer({ deadline, isMyTurn }: TurnTimerProps) {
  const [pct, setPct] = useState(100);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!deadline) {
      setPct(100);
      return;
    }

    startRef.current = Date.now();
    const total = deadline - startRef.current;
    if (total <= 0) { setPct(0); return; }

    const tick = () => {
      const remaining = deadline - Date.now();
      const p = Math.max(0, Math.min(100, (remaining / total) * 100));
      setPct(p);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [deadline]);

  if (!deadline) return null;

  const color = pct > 50 ? 'bg-spero-green' : pct > 20 ? 'bg-spero-yellow' : 'bg-spero-red';
  const urgent = pct < 16.7; // ~10s of 60s

  return (
    <div className="w-full h-1 bg-board-accent/50 shrink-0">
      <div
        className={`h-full ${color} transition-colors duration-300 ${urgent ? 'animate-timer-urgent' : ''}`}
        style={{ width: `${pct}%`, transition: 'width 100ms linear' }}
      />
    </div>
  );
}
