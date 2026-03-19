import { createPortal } from 'react-dom';
import type { CardDef } from '../../../shared/types';

const colorMap: Record<string, string> = {
  red: 'text-spero-red',
  blue: 'text-spero-blue',
  yellow: 'text-spero-yellow',
  green: 'text-spero-green',
  black: 'text-spero-black',
  none: 'text-spero-none',
};

const colorDot: Record<string, string> = {
  red: 'bg-spero-red',
  blue: 'bg-spero-blue',
  yellow: 'bg-spero-yellow',
  green: 'bg-spero-green',
  black: 'bg-spero-black',
  none: 'bg-spero-none',
};

interface CardTooltipProps {
  cardDef: CardDef;
  anchorRect: DOMRect;
}

export function CardTooltip({ cardDef, anchorRect }: CardTooltipProps) {
  const flipBelow = anchorRect.top < 200;

  const style: React.CSSProperties = {
    position: 'fixed',
    left: anchorRect.left + anchorRect.width / 2,
    transform: 'translateX(-50%)',
    zIndex: 100,
    ...(flipBelow
      ? { top: anchorRect.bottom + 8 }
      : { bottom: window.innerHeight - anchorRect.top + 8 }),
  };

  return createPortal(
    <div
      style={style}
      className="bg-board-surface border border-board-accent rounded-lg shadow-2xl p-3 text-sm max-w-[250px] animate-tooltip-fade pointer-events-none"
    >
      {/* Header */}
      <div className="flex justify-between items-start gap-2 mb-1">
        <span className="font-bold text-white leading-tight">{cardDef.name}</span>
        <span className="text-gray-400 text-xs shrink-0">Cost {cardDef.cost}</span>
      </div>

      {/* Type line */}
      <div className="text-xs text-gray-400 mb-2">
        {cardDef.typeA}{cardDef.typeB ? ` — ${cardDef.typeB}` : ''}
      </div>

      <div className="border-t border-board-accent my-1" />

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs mb-1">
        {cardDef.power > 0 && (
          <span className="text-spero-red font-bold">P: {cardDef.power}</span>
        )}
        {cardDef.smarts > 0 && (
          <span className="text-spero-blue font-bold">S: {cardDef.smarts}</span>
        )}
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${colorDot[cardDef.color] ?? colorDot.none}`} />
          <span className={`${colorMap[cardDef.color] ?? colorMap.none} capitalize`}>
            {cardDef.color}
          </span>
        </span>
      </div>

      {/* Rules text */}
      {cardDef.rulesText && (
        <>
          <div className="border-t border-board-accent my-1" />
          <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">
            {cardDef.rulesText}
          </p>
        </>
      )}
    </div>,
    document.body
  );
}
