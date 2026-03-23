import { createPortal } from 'react-dom';
import type { CardDef } from '../../../shared/types';
import { getCardImagePath } from '../utils/cardImages';

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
      className="bg-board-surface border border-board-accent rounded-lg shadow-2xl max-w-[320px] w-[320px] animate-tooltip-fade pointer-events-none overflow-hidden"
    >
      {/* Card name header */}
      <div className="px-3 py-1.5 border-b border-board-accent/50 flex items-center justify-between">
        <span className="text-white text-sm font-bold truncate">{cardDef.name}</span>
        <span className="text-gray-400 text-xs ml-2 shrink-0">{cardDef.type}</span>
      </div>
      <img
        src={getCardImagePath(cardDef.cardCode)}
        alt={cardDef.name}
        className="w-full object-contain"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
          // Show the rulesText fallback when image fails
          const next = (e.target as HTMLImageElement).nextElementSibling;
          if (next) (next as HTMLElement).style.display = 'block';
        }}
      />
      {/* Rules text fallback — visible when image fails to load */}
      <div className="px-3 py-2 hidden">
        {cardDef.text && <p className="text-gray-300 text-xs">{cardDef.text}</p>}
        {cardDef.flavor && <p className="text-gray-500 text-xs italic mt-1">{cardDef.flavor}</p>}
      </div>
    </div>,
    document.body
  );
}
