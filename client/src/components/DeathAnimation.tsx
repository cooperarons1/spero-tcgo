import { useEffect, useState, useRef } from 'react';
import type { BoardMinion } from '../../../shared/types';

interface DeathGhost {
  id: string;
  minion: BoardMinion;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  deadMinions: BoardMinion[];
}

export function DeathAnimation({ deadMinions }: Props) {
  const [ghosts, setGhosts] = useState<DeathGhost[]>([]);
  const posCache = useRef<Map<string, DOMRect>>(new Map());

  // Cache positions of all minions each frame so we can look them up on death
  useEffect(() => {
    const els = document.querySelectorAll('[data-entity-id]');
    els.forEach(el => {
      const id = el.getAttribute('data-entity-id');
      if (id && !id.startsWith('hero-')) {
        posCache.current.set(id, el.getBoundingClientRect());
      }
    });
  });

  useEffect(() => {
    if (deadMinions.length === 0) return;

    const newGhosts: DeathGhost[] = [];
    for (const m of deadMinions) {
      const rect = posCache.current.get(m.instanceId);
      if (rect) {
        newGhosts.push({
          id: `death-${m.instanceId}-${Date.now()}`,
          minion: m,
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });
      }
    }

    if (newGhosts.length === 0) return;

    setGhosts(prev => [...prev, ...newGhosts]);

    const ids = newGhosts.map(g => g.id);
    const timer = setTimeout(() => {
      setGhosts(prev => prev.filter(g => !ids.includes(g.id)));
    }, 500);

    return () => clearTimeout(timer);
  }, [deadMinions]);

  if (ghosts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {ghosts.map(g => (
        <div key={g.id}>
          {/* Ghost minion fading out */}
          <div
            className="absolute animate-minion-death"
            style={{
              left: g.x,
              top: g.y,
              width: g.width,
              height: g.height,
            }}
          >
            <div
              className="w-full h-full rounded-[42%] bg-red-900/60 border-2 border-red-500/50 flex items-center justify-center"
            >
              <span className="text-red-300 text-xl font-bold opacity-80">
                {'\u2620'}
              </span>
            </div>
          </div>
          {/* Particles */}
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            const dx = Math.cos(angle) * 40;
            const dy = Math.sin(angle) * 40;
            return (
              <div
                key={i}
                className="absolute animate-death-particle"
                style={{
                  left: g.x + g.width / 2,
                  top: g.y + g.height / 2,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: i % 2 === 0 ? '#ef4444' : '#f97316',
                  '--dx': `${dx}px`,
                  '--dy': `${dy}px`,
                } as React.CSSProperties}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
