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
      {active.map(n => {
        // Big-hit emphasis: damage of 5+ (or heal of 5+) gets a larger
        // font + a glowing text-shadow + a yellow-orange critical color
        // for damage (vs the standard red). Makes lethal-range hits
        // visually pop instead of getting lost in the float-up stream.
        const magnitude = Math.abs(n.amount);
        const isBigHit = magnitude >= 5;
        const isDamage = n.type === 'damage';
        const colorClass = isDamage
          ? (isBigHit ? '#fb923c' : '#ef4444')
          : (isBigHit ? '#34d399' : '#22c55e');
        const sizeClass = isBigHit ? 'text-4xl' : 'text-2xl';
        const shadow = isBigHit
          ? (isDamage
              ? '0 0 12px rgba(251,146,60,0.9), 0 2px 4px rgba(0,0,0,0.9)'
              : '0 0 12px rgba(52,211,153,0.9), 0 2px 4px rgba(0,0,0,0.9)')
          : '0 2px 4px rgba(0,0,0,0.8)';
        return (
          <span
            key={n.id}
            className={`absolute animate-float-damage font-extrabold ${sizeClass}`}
            style={{
              left: n.x,
              top: n.y - 10,
              transform: 'translateX(-50%)',
              color: colorClass,
              textShadow: shadow,
            }}
          >
            {isDamage ? n.amount : `+${n.amount}`}
          </span>
        );
      })}
    </div>
  );
}
