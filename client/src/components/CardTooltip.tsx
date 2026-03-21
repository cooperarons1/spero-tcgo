import { createPortal } from 'react-dom';
import type { CardDef } from '../../../shared/types';
import { getCardImagePath } from '../utils/cardImages';

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
  const tooltipWidth = 320;

  // Clamp horizontally to stay within viewport
  const rawLeft = anchorRect.left + anchorRect.width / 2;
  const minLeft = tooltipWidth / 2 + 8;
  const maxLeft = window.innerWidth - tooltipWidth / 2 - 8;
  const clampedLeft = Math.max(minLeft, Math.min(maxLeft, rawLeft));

  const style: React.CSSProperties = {
    position: 'fixed',
    left: clampedLeft,
    transform: 'translateX(-50%)',
    zIndex: 100,
    ...(flipBelow
      ? { top: anchorRect.bottom + 8 }
      : { bottom: window.innerHeight - anchorRect.top + 8 }),
  };

  return createPortal(
    <div
      style={style}
      className="bg-board-surface border border-board-accent rounded-lg shadow-2xl text-sm max-w-[320px] w-[320px] animate-tooltip-fade pointer-events-none overflow-hidden"
    >
      {/* Card image */}
      <img
        src={getCardImagePath(cardDef.cardCode)}
        alt={cardDef.name}
        className="w-full h-44 object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />

      <div className="p-3">
        {/* Header */}
        <div className="flex justify-between items-start gap-2 mb-1">
          <span className="text-lg font-bold text-white leading-tight">{cardDef.name}</span>
          <span className="text-gray-400 text-sm shrink-0">Cost {cardDef.cost}</span>
        </div>

        {/* Type line */}
        <div className="text-sm text-gray-400 mb-2">
          {cardDef.typeA}{cardDef.typeB ? ` — ${cardDef.typeB}` : ''}
          <span className="ml-2 inline-flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${colorDot[cardDef.color] ?? colorDot.none}`} />
            <span className={`${colorMap[cardDef.color] ?? colorMap.none} capitalize`}>
              {cardDef.color}
            </span>
          </span>
        </div>

        <div className="border-t border-board-accent my-1" />

        {/* Stats row */}
        <div className="flex items-center gap-2 text-base font-bold mb-2">
          {cardDef.power > 0 && (
            <span className="bg-red-600/20 text-spero-red px-2 py-0.5 rounded-full text-sm">P: {cardDef.power}</span>
          )}
          {cardDef.smarts > 0 && (
            <span className="bg-blue-600/20 text-spero-blue px-2 py-0.5 rounded-full text-sm">S: {cardDef.smarts}</span>
          )}
        </div>

        {/* Rules text */}
        {cardDef.rulesText && (
          <>
            <div className="border-t border-board-accent my-1" />
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
              {cardDef.rulesText}
            </p>
          </>
        )}

        {/* Flavor text */}
        {(cardDef as any).flavorText && (
          <p className="text-xs italic text-gray-500 mt-1">{(cardDef as any).flavorText}</p>
        )}
      </div>
    </div>,
    document.body
  );
}
