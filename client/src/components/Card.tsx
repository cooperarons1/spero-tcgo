import cardsData from '../../../data/cards.json';
import { CardArt } from '../utils/cardArt';

interface CardDef {
  cardCode: string;
  name: string;
  manaCost: number;
  type: 'MINION' | 'SPELL' | 'WEAPON' | 'LOCATION';
  heroClass: 'DEREK' | 'TALA' | 'JIMMY' | 'ANDERS' | 'DES' | 'ASTRID' | 'AVA' | 'LUCAS' | 'IZZY' | 'NEUTRAL';
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  attack: number;
  health: number;
  text: string;
  keywords: string[];
  minionType?: string | null;
  secretTrigger?: string;
}

interface CardProps {
  cardCode: string | null;
  onClick?: () => void;
  selected?: boolean;
  greyed?: boolean;
  small?: boolean;
  className?: string;
}

// ── Hero class frame colors ──
const classBorder: Record<string, string> = {
  JIMMY: 'border-red-600',
  TALA: 'border-green-600',
  DEREK: 'border-yellow-500',
  ANDERS: 'border-blue-500',
  DES: 'border-purple-600',
  ASTRID: 'border-amber-400',
  AVA: 'border-pink-500',
  LUCAS: 'border-teal-500',
  IZZY: 'border-orange-500',
  NEUTRAL: 'border-stone-500',
};

const classFrameBg: Record<string, string> = {
  JIMMY: 'bg-gradient-to-b from-red-950 via-red-900/80 to-red-950',
  TALA: 'bg-gradient-to-b from-green-950 via-green-900/80 to-green-950',
  DEREK: 'bg-gradient-to-b from-yellow-950 via-yellow-900/80 to-yellow-950',
  ANDERS: 'bg-gradient-to-b from-blue-950 via-blue-900/80 to-blue-950',
  DES: 'bg-gradient-to-b from-purple-950 via-purple-900/80 to-purple-950',
  ASTRID: 'bg-gradient-to-b from-amber-950 via-amber-900/80 to-amber-950',
  AVA: 'bg-gradient-to-b from-pink-950 via-pink-900/80 to-pink-950',
  LUCAS: 'bg-gradient-to-b from-teal-950 via-teal-900/80 to-teal-950',
  IZZY: 'bg-gradient-to-b from-orange-950 via-orange-900/80 to-orange-950',
  NEUTRAL: 'bg-gradient-to-b from-stone-800 via-stone-700/80 to-stone-800',
};

const rarityColor: Record<string, string> = {
  COMMON: '#9ca3af',
  RARE: '#3b82f6',
  EPIC: '#a855f7',
  LEGENDARY: '#f59e0b',
};

const cardsByCode: Record<string, CardDef> = {};
for (const c of cardsData as CardDef[]) {
  cardsByCode[c.cardCode] = c;
}

export function Card({ cardCode, onClick, selected, greyed, small, className }: CardProps) {
  // Card back
  if (!cardCode) {
    return (
      <button
        onClick={onClick}
        className={`
          ${small ? 'w-[100px] h-[143px]' : 'w-[140px] h-[200px]'}
          rounded-lg border-2 border-amber-700 flex-shrink-0
          bg-stone-900 relative overflow-hidden
          ${onClick ? 'cursor-pointer hover:brightness-110 active:scale-95' : ''}
          ${className ?? ''}
        `}
      >
        <img src="/cards/card-back.png" alt="" className="absolute inset-0 w-full h-full object-cover rounded-md" />
      </button>
    );
  }

  const def = cardsByCode[cardCode];
  if (!def) {
    return (
      <div
        className={`
          ${small ? 'w-[100px] h-[143px]' : 'w-[140px] h-[200px]'}
          rounded-lg border-2 border-red-800 bg-gray-900
          flex items-center justify-center text-red-400 text-xs text-center p-2
          ${className ?? ''}
        `}
      >
        Unknown: {cardCode}
      </div>
    );
  }

  const isMinion = def.type === 'MINION';
  const isWeapon = def.type === 'WEAPON';
  const isSpell = def.type === 'SPELL';
  const isLocation = def.type === 'LOCATION';
  const isSecret = isSpell && !!def.secretTrigger;
  const hasStats = isMinion || isWeapon;
  const border = classBorder[def.heroClass] || classBorder.NEUTRAL;
  const frameBg = classFrameBg[def.heroClass] || classFrameBg.NEUTRAL;

  return (
    <button
      onClick={onClick}
      className={`
        ${small ? 'w-[100px] h-[143px]' : 'w-[140px] h-[200px]'}
        rounded-lg border-2 ${border} flex-shrink-0
        ${frameBg} relative overflow-hidden
        flex flex-col transition-all duration-200
        ${onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg active:scale-95' : ''}
        ${selected ? 'ring-2 ring-white ring-offset-1 ring-offset-black shadow-lg shadow-white/20' : ''}
        ${greyed ? 'opacity-40 grayscale' : ''}
        ${className ?? ''}
      `}
    >
      {/* ── Mana cost gem — top-left, inside card ── */}
      <div className={`
        absolute ${small ? 'top-1 left-1 w-5 h-5 text-[9px]' : 'top-1 left-1 w-7 h-7 text-xs'}
        rounded-full bg-gradient-to-br from-blue-400 to-blue-700
        border-2 border-blue-300 shadow-lg shadow-blue-500/50
        flex items-center justify-center font-extrabold text-white z-20
      `}>
        {def.manaCost}
      </div>

      {/* ── Secret badge — top-right, inside card ── */}
      {isSecret && (
        <div className={`
          absolute ${small ? 'top-1 right-1 w-4 h-4 text-[7px]' : 'top-1 right-1 w-6 h-6 text-[10px]'}
          rounded-full bg-gradient-to-b from-amber-400 to-amber-600
          border border-amber-300 shadow-md
          flex items-center justify-center font-bold text-white z-20
        `}>
          ?
        </div>
      )}

      {/* ── Card art — large, edge-to-edge, ~60% of card ── */}
      <div className={`
        ${small ? 'h-[82px]' : 'h-[118px]'}
        w-full overflow-hidden shrink-0
        bg-stone-800 flex items-center justify-center
      `}>
        <CardArt cardCode={cardCode} className="w-full h-full" />
      </div>

      {/* ── Rarity gem — centered between art and name ── */}
      <div className={`flex justify-center ${small ? '-mt-1.5 z-10' : '-mt-2 z-10'}`}>
        <div
          className={`${small ? 'w-3 h-3' : 'w-3.5 h-3.5'} rotate-45 border border-white/40`}
          style={{
            backgroundColor: rarityColor[def.rarity],
            boxShadow: `0 0 8px ${rarityColor[def.rarity]}aa, inset 0 1px 2px rgba(255,255,255,0.4)`,
          }}
        />
      </div>

      {/* ── Card name banner ── */}
      <div className={`
        ${small ? 'mx-0.5 px-1 py-px' : 'mx-1 px-1.5 py-0.5'}
        bg-stone-900/80 border-y border-amber-700/40
        text-center z-10 shrink-0 overflow-hidden
      `}>
        <span className={`
          text-amber-100 font-bold leading-tight block truncate
          ${small ? 'text-[6px]' : 'text-[8.5px]'}
          drop-shadow-md
        `}>
          {def.name}
        </span>
      </div>

      {/* ── Card text ── */}
      {def.text ? (
        <div className={`
          flex-1 ${small ? 'mx-0.5 px-0.5 py-px pb-4' : 'mx-1 px-1.5 py-0.5 pb-5'}
          bg-stone-900/50 rounded-sm
          flex items-start justify-center overflow-hidden min-h-0
        `}>
          <p className={`
            text-gray-300 text-center leading-tight
            ${small ? 'text-[5px] line-clamp-2' : 'text-[6.5px] line-clamp-2'}
          `}>
            {def.text}
          </p>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* ── Bottom stats — absolute positioned inside card ── */}
      {hasStats && (
        <>
          {/* Attack — bottom-left */}
          <div className={`
            absolute ${small ? 'bottom-1 left-1 w-5 h-5 text-[9px]' : 'bottom-1.5 left-1.5 w-7 h-7 text-xs'}
            rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700
            border-2 border-yellow-400 shadow-md shadow-yellow-500/40
            flex items-center justify-center font-extrabold text-white z-20
          `}>
            {def.attack}
          </div>

          {/* Health/Durability — bottom-right */}
          <div className={`
            absolute ${small ? 'bottom-1 right-1 w-5 h-5 text-[9px]' : 'bottom-1.5 right-1.5 w-7 h-7 text-xs'}
            rounded-full
            ${isWeapon
              ? 'bg-gradient-to-br from-emerald-400 to-emerald-700 border-emerald-300 shadow-emerald-500/40'
              : 'bg-gradient-to-br from-red-500 to-red-800 border-red-400 shadow-red-500/40'
            }
            border-2 shadow-md z-20
            flex items-center justify-center font-extrabold text-white
          `}>
            {def.health}
          </div>

          {/* Tribe label — bottom center */}
          {isMinion && def.minionType && (
            <div className={`absolute ${small ? 'bottom-1' : 'bottom-2'} left-1/2 -translate-x-1/2 z-20`}>
              <span className={`
                ${small ? 'text-[4px] px-0.5' : 'text-[6px] px-1.5 py-px'}
                font-bold text-amber-200 bg-stone-900/80 rounded-sm border border-amber-700/30
              `}>
                {def.minionType}
              </span>
            </div>
          )}
        </>
      )}

      {/* Location durability — bottom center */}
      {isLocation && (
        <div className={`absolute ${small ? 'bottom-1' : 'bottom-1.5'} left-1/2 -translate-x-1/2 z-20`}>
          <div className={`
            ${small ? 'w-5 h-5 text-[9px]' : 'w-7 h-7 text-xs'}
            rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700
            border-2 border-emerald-300 shadow-md shadow-emerald-500/40
            flex items-center justify-center font-extrabold text-white
          `}>
            {def.health}
          </div>
        </div>
      )}

      {/* Selected glow */}
      {selected && (
        <div className="absolute inset-0 rounded-lg border-2 border-white/40 pointer-events-none animate-pulse" />
      )}
    </button>
  );
}

export function CardBack({ size = 'md', onClick, disabled }: { size?: 'sm' | 'md' | 'lg'; onClick?: () => void; disabled?: boolean }) {
  const sizeMap = {
    sm: 'w-[100px] h-[143px]',
    md: 'w-[140px] h-[200px]',
    lg: 'w-[180px] h-[257px]',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizeMap[size]} rounded-lg border-2 border-amber-700
        bg-stone-900 relative overflow-hidden
        ${onClick && !disabled ? 'cursor-pointer hover:brightness-110' : ''}
        ${disabled ? 'cursor-not-allowed' : ''}
      `}
    >
      <img src="/cards/card-back.png" alt="" className="absolute inset-0 w-full h-full object-cover rounded-md" />
    </button>
  );
}
