import { useRef, useState, useEffect } from 'react';
import type { ClientCardInstance } from '../../../shared/types';
import { getCardDef } from '../utils/stackHelpers';
import { getCardImagePath, getColorClass, getColorBg } from '../utils/cardImages';
import { CardTooltip } from './CardTooltip';

interface CardProps {
  card: ClientCardInstance;
  onClick?: () => void;
  disabled?: boolean;
  highlighted?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const sizeMap = {
  sm: 'w-16 h-22',
  md: 'w-24 h-34',
  lg: 'w-32 h-44',
};

export function Card({ card, onClick, disabled, highlighted, size = 'md' }: CardProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!card.faceUp || !card.cardCode) {
    return <CardBack size={size} onClick={onClick} disabled={disabled} />;
  }

  const def = getCardDef(card.cardCode);
  if (!def) return <CardBack size={size} />;

  const colorBorder = getColorClass(def.color);
  const colorBg = getColorBg(def.color);
  const imgSrc = getCardImagePath(card.cardCode);

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      setTooltipVisible(true);
    }, 150);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setTooltipVisible(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`
          ${sizeMap[size]} rounded-lg border-2 ${colorBorder} ${colorBg}
          flex flex-col overflow-hidden relative
          transition-all duration-200
          ${onClick && !disabled ? 'cursor-pointer hover:-translate-y-2 hover:shadow-lg hover:shadow-white/20 active:scale-95' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${highlighted ? 'animate-pulse-glow -translate-y-1 ring-2 ring-white/50' : ''}
        `}
      >
        {/* Card image */}
        <img
          src={imgSrc}
          alt={def.name}
          className="absolute inset-0 w-full h-full object-cover rounded-lg"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />

        {/* Stats overlay */}
        <div className="absolute inset-0 flex flex-col justify-between p-0.5 pointer-events-none">
          {/* Cost badge */}
          <div className="flex justify-between items-start">
            <span className="bg-black/70 text-white text-[10px] font-bold rounded px-1">
              {def.cost}
            </span>
            {size !== 'sm' && (
              <span className="bg-black/70 text-white text-[8px] rounded px-1 max-w-[60%] truncate">
                {def.name}
              </span>
            )}
          </div>

          {/* Bottom stats */}
          <div className="flex justify-between items-end">
            {def.smarts > 0 && (
              <span className="bg-blue-600/90 text-white text-[10px] font-bold rounded px-1">
                S:{def.smarts}
              </span>
            )}
            <span className="flex-1" />
            {def.power > 0 && (
              <span className="bg-red-600/90 text-white text-[10px] font-bold rounded px-1">
                P:{def.power}
              </span>
            )}
          </div>
        </div>
      </button>
      {tooltipVisible && btnRef.current && (
        <CardTooltip cardDef={def} anchorRect={btnRef.current.getBoundingClientRect()} />
      )}
    </>
  );
}

export function CardBack({ size = 'md', onClick, disabled }: { size?: 'sm' | 'md' | 'lg'; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${sizeMap[size]} rounded-lg border-2 border-gray-600 bg-gradient-to-br from-board-accent via-board-surface to-board-accent flex items-center justify-center shadow-md ${onClick && !disabled ? 'cursor-pointer hover:brightness-110' : ''} ${disabled ? 'cursor-not-allowed' : ''}`}
    >
      <div className="text-gray-400 font-bold text-xs">SPERO</div>
    </button>
  );
}
