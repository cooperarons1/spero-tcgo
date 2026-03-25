import { useEffect, useState } from 'react';
import type { FloatingNumber } from '../hooks/useStateDiff';

interface Props {
  numbers: FloatingNumber[];
}

interface PositionedNumber extends FloatingNumber {
  x: number;
  y: number;
}

export function FloatingNumbers({ numbers }: Props) {
  const [active, setActive] = useState<PositionedNumber[]>([]);

  useEffect(() => {
    if (numbers.length === 0) return;

    const positioned: PositionedNumber[] = [];
    for (const n of numbers) {
      const el = document.querySelector(`[data-entity-id="${n.targetId}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        positioned.push({
          ...n,
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
      }
    }

    if (positioned.length === 0) return;

    setActive(prev => [...prev, ...positioned]);

    const ids = positioned.map(p => p.id);
    const timer = setTimeout(() => {
      setActive(prev => prev.filter(p => !ids.includes(p.id)));
    }, 800);

    return () => clearTimeout(timer);
  }, [numbers]);

  if (active.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {active.map(n => (
        <span
          key={n.id}
          className="absolute animate-float-damage font-extrabold text-2xl drop-shadow-lg"
          style={{
            left: n.x,
            top: n.y - 10,
            transform: 'translateX(-50%)',
            color: n.type === 'damage' ? '#ef4444' : '#22c55e',
          }}
        >
          {n.type === 'damage' ? n.amount : `+${n.amount}`}
        </span>
      ))}
    </div>
  );
}
