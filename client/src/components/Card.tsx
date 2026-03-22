import { useRef, useState, useEffect, useCallback } from 'react';
import type { ClientCardInstance } from '../../../shared/types';
import { getCardDef } from '../utils/stackHelpers';
import { getCardImagePath, getColorClass, getColorBg } from '../utils/cardImages';
import { CardTooltip } from './CardTooltip';

interface CardProps {
  card: ClientCardInstance;
  onClick?: () => void;
  onInspect?: (cardCode: string) => void;
  disabled?: boolean;
  highlighted?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const sizeMap = {
  sm: 'w-24 h-[132px]',
  md: 'w-36 h-[198px]',
  lg: 'w-48 h-[264px]',
};

export function Card({ card, onClick, onInspect, disabled, highlighted, size = 'md' }: CardProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchHandledRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
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
  const cardCode = card.cardCode;

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

  // Touch: long-press (300ms) opens inspect, short tap triggers onClick
  const handleTouchStart = () => {
    touchHandledRef.current = false;
    if (onInspect && cardCode) {
      touchTimerRef.current = setTimeout(() => {
        touchHandledRef.current = true;
        onInspect(cardCode);
      }, 300);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = null;
    if (touchHandledRef.current) {
      // Long-press was triggered — prevent the click
      e.preventDefault();
    }
  };

  const handleInspectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onInspect && cardCode) onInspect(cardCode);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onContextMenu={onInspect ? (e) => { e.preventDefault(); onInspect(cardCode); } : undefined}
        className={`
          ${sizeMap[size]} rounded-lg border-2 ${colorBorder} ${colorBg}
          flex flex-col overflow-hidden relative group/card
          transition-all duration-200
          ${onClick && !disabled ? 'cursor-pointer hover:-translate-y-2 hover:shadow-lg hover:shadow-white/20 active:scale-95' : ''}
          ${disabled ? 'cursor-not-allowed' : ''}
          ${highlighted ? 'animate-pulse-glow -translate-y-1 ring-2 ring-white/50' : ''}
        `}
      >
        {/* Card image */}
        <img
          src={imgSrc}
          alt={def.name}
          className="absolute inset-0 w-full h-full object-cover rounded-lg"
          onError={(e) => {
            const el = e.target as HTMLImageElement;
            el.style.display = 'none';
            el.parentElement?.classList.add('fallback-card');
          }}
        />

        {/* Fallback overlay — only visible when image fails */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-2 hidden [.fallback-card>&]:flex">
          <span className="text-white text-xs font-bold text-center">{def.name}</span>
          <span className="text-gray-400 text-[10px]">{def.typeA}</span>
        </div>

        {/* Inspect magnifying glass icon */}
        {onInspect && (
          <div
            className="inspect-icon absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity cursor-pointer hover:bg-black/80"
            onClick={handleInspectClick}
            title="Inspect card"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        )}

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
