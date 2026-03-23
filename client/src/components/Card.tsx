import cardsData from '../../../data/cards.json';
import { CardArt } from '../utils/cardArt';

interface CardDef {
  cardCode: string;
  name: string;
  manaCost: number;
  type: 'MINION' | 'SPELL' | 'WEAPON';
  heroClass: 'DEREK' | 'TALA' | 'JIMMY' | 'ANDERS' | 'NEUTRAL';
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  attack: number;
  health: number;
  text: string;
  keywords: string[];
}

interface CardProps {
  cardCode: string | null;
  onClick?: () => void;
  selected?: boolean;
  greyed?: boolean;
  small?: boolean;
  className?: string;
}

const rarityBorder: Record<CardDef['rarity'], string> = {
  COMMON: 'border-gray-400',
  RARE: 'border-blue-400',
  EPIC: 'border-purple-500',
  LEGENDARY: 'border-yellow-400',
};

const rarityGlow: Record<CardDef['rarity'], string> = {
  COMMON: 'shadow-gray-400/30',
  RARE: 'shadow-blue-400/40',
  EPIC: 'shadow-purple-500/40',
  LEGENDARY: 'shadow-yellow-400/50',
};

const rarityBannerBg: Record<CardDef['rarity'], string> = {
  COMMON: 'bg-gray-600',
  RARE: 'bg-blue-700',
  EPIC: 'bg-purple-700',
  LEGENDARY: 'bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-600',
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
          rounded-xl border-2 border-gray-600 flex-shrink-0
          bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950
          flex items-center justify-center relative overflow-hidden
          ${onClick ? 'cursor-pointer hover:brightness-110 active:scale-95' : ''}
          ${className ?? ''}
        `}
      >
        {/* Diamond pattern for card back */}
        <div className="absolute inset-2 border border-gray-600 rounded-lg opacity-40" />
        <div className="absolute inset-4 border border-gray-700 rounded-md opacity-25 rotate-45 scale-75" />
        <div className="text-gray-500 font-extrabold text-sm tracking-widest select-none">SPERO</div>
      </button>
    );
  }

  const def = cardsByCode[cardCode];
  if (!def) {
    return (
      <div
        className={`
          ${small ? 'w-[100px] h-[143px]' : 'w-[140px] h-[200px]'}
          rounded-xl border-2 border-red-800 bg-gray-900
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
  const hasStats = isMinion || isWeapon;

  // Frame background based on card type
  const frameBg = isSpell
    ? 'bg-gradient-to-b from-indigo-900 via-violet-950 to-indigo-900'
    : isWeapon
      ? 'bg-gradient-to-b from-stone-800 via-stone-900 to-stone-800'
      : 'bg-gradient-to-b from-slate-800 via-slate-900 to-slate-800';

  // Top accent based on type (frame style)
  const frameAccent = isSpell
    ? 'from-violet-500/30 to-transparent'
    : isWeapon
      ? 'from-amber-600/30 to-transparent'
      : 'from-slate-500/20 to-transparent';

  return (
    <button
      onClick={onClick}
      className={`
        ${small ? 'w-[100px] h-[143px]' : 'w-[140px] h-[200px]'}
        rounded-xl border-2 ${rarityBorder[def.rarity]} flex-shrink-0
        ${frameBg} relative overflow-hidden
        flex flex-col transition-all duration-200
        ${onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg active:scale-95' : ''}
        ${selected ? `ring-2 ring-white ring-offset-1 ring-offset-black shadow-lg ${rarityGlow[def.rarity]}` : ''}
        ${greyed ? 'opacity-40 grayscale' : ''}
        ${className ?? ''}
      `}
    >
      {/* Type-based frame accent at top */}
      <div className={`absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b ${frameAccent} pointer-events-none`} />

      {/* Mana cost gem — top-left */}
      <div className={`
        absolute ${small ? 'top-0.5 left-0.5 w-5 h-5 text-[10px]' : 'top-1 left-1 w-7 h-7 text-xs'}
        rounded-full bg-gradient-to-br from-blue-400 to-blue-700
        border border-blue-300 shadow-md shadow-blue-500/50
        flex items-center justify-center font-extrabold text-white z-10
      `}>
        {def.manaCost}
      </div>

      {/* Card art area */}
      <div className={`${small ? 'h-[45px] mt-5' : 'h-[65px] mt-7'} mx-1 rounded overflow-hidden flex items-center justify-center shrink-0`}>
        <CardArt cardCode={cardCode} className="w-full h-full" />
      </div>

      {/* Card name banner */}
      <div className={`
        ${small ? 'mx-0.5 px-1 py-px' : 'mx-1.5 px-2 py-0.5'}
        ${rarityBannerBg[def.rarity]} rounded-sm
        text-center z-10 shrink-0
      `}>
        <span className={`
          text-white font-bold leading-none
          ${small ? 'text-[7px]' : 'text-[10px]'}
          drop-shadow-sm
        `}>
          {def.name}
        </span>
      </div>

      {/* Card text — only on larger cards or spells (spells need text since no stats) */}
      {(!small || isSpell) && def.text && (
        <div className={`
          flex-1 ${small ? 'mx-0.5 px-0.5' : 'mx-2 mt-0.5 px-1.5'}
          flex items-start justify-center overflow-hidden min-h-0
        `}>
          <p className={`
            text-gray-300 text-center leading-tight
            ${small ? 'text-[5px] line-clamp-2' : 'text-[7px] line-clamp-3'}
          `}>
            {def.text}
          </p>
        </div>
      )}

      {/* Spacer for small minion/weapon cards (no text shown) */}
      {small && !isSpell && <div className="flex-1" />}

      {/* Bottom stat area */}
      {hasStats && (
        <div className={`
          flex justify-between items-end
          ${small ? 'px-0.5 pb-0.5' : 'px-1 pb-1'}
          z-10
        `}>
          {/* Attack */}
          <div className={`
            ${small ? 'w-5 h-5 text-[9px]' : 'w-7 h-7 text-xs'}
            rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700
            border border-yellow-400 shadow-md shadow-yellow-500/40
            flex items-center justify-center font-extrabold text-white
          `}>
            {def.attack}
          </div>

          {/* Health (red) or Durability (green for weapon) */}
          <div className={`
            ${small ? 'w-5 h-5 text-[9px]' : 'w-7 h-7 text-xs'}
            rounded-full
            ${isWeapon
              ? 'bg-gradient-to-br from-emerald-400 to-emerald-700 border-emerald-300 shadow-emerald-500/40'
              : 'bg-gradient-to-br from-red-500 to-red-800 border-red-400 shadow-red-500/40'
            }
            border shadow-md
            flex items-center justify-center font-extrabold text-white
          `}>
            {def.health}
          </div>
        </div>
      )}

      {/* Spell bottom spacer (no stats) */}
      {isSpell && <div className={small ? 'h-2' : 'h-3'} />}

      {/* Selected glow overlay */}
      {selected && (
        <div className="absolute inset-0 rounded-xl border-2 border-white/40 pointer-events-none animate-pulse" />
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
        ${sizeMap[size]} rounded-xl border-2 border-gray-600
        bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950
        flex items-center justify-center relative overflow-hidden
        ${onClick && !disabled ? 'cursor-pointer hover:brightness-110' : ''}
        ${disabled ? 'cursor-not-allowed' : ''}
      `}
    >
      <div className="absolute inset-2 border border-gray-600 rounded-lg opacity-40" />
      <div className="absolute inset-4 border border-gray-700 rounded-md opacity-25 rotate-45 scale-75" />
      <div className="text-gray-500 font-extrabold text-sm tracking-widest select-none">SPERO</div>
    </button>
  );
}
