import type { ClientCardInstance } from '../../../shared/types';
import { Card } from './Card';
import { getCardDef } from '../utils/stackHelpers';

interface SideplayZoneProps {
  cards: ClientCardInstance[];
  onInspect?: (cardCode: string) => void;
}

function getEffectType(rulesText: string): 'passive' | 'turn-start' | 'unknown' {
  if (/At the beginning of your turn/i.test(rulesText)) return 'turn-start';
  if (/SIDEPLAY:/i.test(rulesText)) return 'passive';
  return 'unknown';
}

function getEffectSummary(rulesText: string): string {
  // Strip the "SIDEPLAY: " prefix for display
  return rulesText.replace(/^SIDEPLAY:\s*/i, '');
}

export function SideplayZone({ cards, onInspect }: SideplayZoneProps) {
  if (cards.length === 0) return null;

  return (
    <div className="bg-board-surface rounded-xl p-3 border border-board-accent">
      <div className="text-xs uppercase tracking-wider text-gray-600 mb-1">Sideplay</div>
      <div className="flex flex-col gap-1.5">
        {cards.map((card) => {
          const def = card.cardCode ? getCardDef(card.cardCode) : null;
          const effectType = def ? getEffectType(def.rulesText) : 'unknown';
          const effectText = def ? getEffectSummary(def.rulesText) : '';

          return (
            <div
              key={card.instanceId}
              className={`flex items-start gap-2 p-1.5 rounded-lg border cursor-pointer hover:brightness-110 transition-all ${
                effectType === 'turn-start'
                  ? 'border-spero-yellow/40 bg-spero-yellow/5'
                  : 'border-board-accent bg-board-surface/50'
              }`}
              onClick={() => card.cardCode && onInspect?.(card.cardCode)}
            >
              <div className="shrink-0">
                <Card card={card} size="sm" />
              </div>
              <div className="flex-1 min-w-0">
                {def && (
                  <>
                    <div className="text-[10px] font-bold text-gray-300 truncate">{def.name}</div>
                    <div className={`text-[9px] leading-snug mt-0.5 ${
                      effectType === 'turn-start' ? 'text-spero-yellow/80' : 'text-gray-500'
                    }`}>
                      {effectType === 'turn-start' && <span className="font-bold mr-0.5">↻</span>}
                      {effectType === 'passive' && <span className="font-bold mr-0.5">◆</span>}
                      {effectText}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
