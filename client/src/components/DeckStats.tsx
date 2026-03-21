import { useMemo } from 'react';
import { getCardDef } from '../utils/stackHelpers';

interface DeckStatsProps {
  deckCards: string[];
}

const colorDot: Record<string, string> = {
  red: 'bg-spero-red', blue: 'bg-spero-blue', green: 'bg-spero-green',
  yellow: 'bg-spero-yellow', black: 'bg-spero-black', none: 'bg-gray-500',
};

export function DeckStats({ deckCards }: DeckStatsProps) {
  const stats = useMemo(() => {
    const manaCurve: Record<number, number> = {};
    const types: Record<string, number> = {};
    const colors: Record<string, number> = {};

    for (const code of deckCards) {
      const def = getCardDef(code);
      if (!def) continue;

      const bucket = Math.min(def.cost, 7);
      manaCurve[bucket] = (manaCurve[bucket] || 0) + 1;

      types[def.typeA] = (types[def.typeA] || 0) + 1;
      colors[def.color] = (colors[def.color] || 0) + 1;
    }

    const maxCurve = Math.max(...Object.values(manaCurve), 1);
    const maxType = Math.max(...Object.values(types), 1);

    return { manaCurve, types, colors, maxCurve, maxType };
  }, [deckCards]);

  if (deckCards.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-[10px] uppercase tracking-widest text-gray-600">Deck Stats</h4>

      {/* Mana Curve */}
      <div>
        <div className="text-[10px] text-gray-500 mb-1">Mana Curve</div>
        <div className="flex items-end gap-1 h-12">
          {Array.from({ length: 8 }, (_, i) => {
            const count = stats.manaCurve[i] || 0;
            const pct = (count / stats.maxCurve) * 100;
            return (
              <div key={i} className="flex flex-col items-center flex-1">
                <div className="w-full bg-board-accent rounded-t relative" style={{ height: `${Math.max(pct, 4)}%` }}>
                  <div className="absolute inset-0 bg-spero-blue/60 rounded-t" />
                </div>
                <span className="text-[8px] text-gray-500 mt-0.5">{i === 7 ? '7+' : i}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Type Breakdown */}
      <div>
        <div className="text-[10px] text-gray-500 mb-1">Types</div>
        <div className="space-y-1">
          {['CHARACTER', 'EQUIPMENT', 'ACTION', 'COMBAT TRICK'].map(type => {
            const count = stats.types[type] || 0;
            if (count === 0) return null;
            const pct = (count / stats.maxType) * 100;
            return (
              <div key={type} className="flex items-center gap-2">
                <span className="text-[9px] text-gray-400 w-16 truncate">{type}</span>
                <div className="flex-1 h-2 bg-board-accent rounded-full overflow-hidden">
                  <div className="h-full bg-spero-green/60 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[9px] text-gray-500 w-4 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Color Breakdown */}
      <div>
        <div className="text-[10px] text-gray-500 mb-1">Colors</div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(stats.colors).map(([color, count]) => (
            <span key={color} className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-full ${colorDot[color] || 'bg-gray-500'}`} />
              <span className="text-[10px] text-gray-400">{count}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
