import { useEffect, useState, useRef } from 'react';
import type { HintConfig } from '../hooks/useOnboardingHints';

interface HintOverlayProps {
  hint: HintConfig;
  onDismiss: () => void;
}

export function HintOverlay({ hint, onDismiss }: HintOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const findTarget = () => {
      const el = document.querySelector(`[data-hint-target="${hint.target}"]`);
      if (el) {
        setRect(el.getBoundingClientRect());
      } else {
        rafRef.current = requestAnimationFrame(findTarget);
      }
    };
    findTarget();
    return () => cancelAnimationFrame(rafRef.current);
  }, [hint.target]);

  if (!rect) return null;

  const padding = 8;
  const cutout = {
    left: rect.left - padding,
    top: rect.top - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };

  // Position tooltip relative to target
  let tooltipStyle: React.CSSProperties = {};
  switch (hint.position) {
    case 'top':
      tooltipStyle = { left: rect.left + rect.width / 2, top: rect.top - 12, transform: 'translate(-50%, -100%)' };
      break;
    case 'bottom':
      tooltipStyle = { left: rect.left + rect.width / 2, top: rect.bottom + 12, transform: 'translate(-50%, 0)' };
      break;
    case 'left':
      tooltipStyle = { left: rect.left - 12, top: rect.top + rect.height / 2, transform: 'translate(-100%, -50%)' };
      break;
    case 'right':
      tooltipStyle = { left: rect.right + 12, top: rect.top + rect.height / 2, transform: 'translate(0, -50%)' };
      break;
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onDismiss}>
      {/* Semi-transparent overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="hint-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={cutout.left}
              y={cutout.top}
              width={cutout.width}
              height={cutout.height}
              rx="8"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#hint-mask)"
        />
      </svg>

      {/* Highlight border */}
      <div
        className="absolute border-2 border-spero-yellow rounded-lg pointer-events-none animate-pulse-glow"
        style={{ left: cutout.left, top: cutout.top, width: cutout.width, height: cutout.height }}
      />

      {/* Tooltip */}
      <div
        className="absolute bg-spero-yellow text-black font-bold text-sm px-4 py-2 rounded-xl shadow-xl max-w-[250px] pointer-events-none animate-bounce-in"
        style={tooltipStyle}
      >
        {hint.text}
        <div className="text-[10px] font-normal mt-1 text-black/60">Click anywhere to dismiss</div>
      </div>
    </div>
  );
}
