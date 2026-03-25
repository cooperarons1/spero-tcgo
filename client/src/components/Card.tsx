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
          rounded-xl border-2 border-amber-700 flex-shrink-0
          bg-gradient-to-br from-amber-950 via-stone-900 to-amber-950
          flex items-center justify-center relative overflow-hidden
          ${onClick ? 'cursor-pointer hover:brightness-110 active:scale-95' : ''}
          ${className ?? ''}
        `}
      >
        {/* Diamond pattern for card back */}
        <div className="absolute inset-2 border border-amber-600 rounded-lg opacity-40" />
        <div className="absolute inset-4 border border-amber-700 rounded-md opacity-25 rotate-45 scale-75" />
        <div className="text-amber-600 font-extrabold text-sm tracking-widest select-none">MIRO</div>
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
  const isLocation = def.type === 'LOCATION';
  const isSecret = isSpell && !!def.secretTrigger;
  const hasStats = isMinion || isWeapon;

  // Frame background based on card type
  const frameBg = isLocation
    ? 'bg-gradient-to-b from-green-900 via-green-950 to-green-900'
    : isSpell
      ? 'bg-gradient-to-b from-indigo-900 via-violet-950 to-indigo-900'
      : isWeapon
        ? 'bg-gradient-to-b from-stone-800 via-stone-900 to-stone-800'
        : 'bg-gradient-to-b from-stone-600 via-stone-700 to-stone-600';

  // Top accent based on type (frame style)
  const frameAccent = isLocation
    ? 'from-emerald-500/30 to-transparent'
    : isSpell
      ? 'from-violet-500/30 to-transparent'
      : isWeapon
        ? 'from-amber-600/30 to-transparent'
        : 'from-slate-500/20 to-transparent';

  const rarityColor: Record<string, string> = {
    COMMON: '#9ca3af',
    RARE: '#3b82f6',
    EPIC: '#a855f7',
    LEGENDARY: '#f59e0b',
  };

  // Hero class text box background
  const classTextBg: Record<string, string> = {
    JIMMY: 'bg-red-900/40',
    TALA: 'bg-green-900/40',
    DEREK: 'bg-yellow-900/40',
    ANDERS: 'bg-blue-900/40',
    DES: 'bg-purple-900/40',
    ASTRID: 'bg-yellow-900/40',
    AVA: 'bg-pink-900/40',
    LUCAS: 'bg-teal-900/40',
    IZZY: 'bg-orange-900/40',
    NEUTRAL: 'bg-gray-800/60',
  };
  const textBg = classTextBg[def.heroClass] || 'bg-gray-800/60';

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
      {/* Mana cost gem — top-left */}
      <div className={`
        absolute ${small ? 'top-0.5 left-0.5 w-5 h-5 text-[10px]' : 'top-0.5 left-0.5 w-7 h-7 text-xs'}
        rounded-full bg-gradient-to-br from-blue-400 to-blue-700
        border border-blue-300 shadow-md shadow-blue-500/50
        flex items-center justify-center font-extrabold text-white z-10
      `}>
        {def.manaCost}
      </div>

      {/* Secret badge overlay */}
      {isSecret && (
        <div className={`
          absolute ${small ? 'top-0.5 right-0.5 w-4 h-4 text-[8px]' : 'top-0.5 right-0.5 w-6 h-6 text-[10px]'}
          rounded-full bg-gradient-to-b from-amber-400 to-amber-600
          border border-amber-300 shadow-md
          flex items-center justify-center font-bold text-white z-10
        `}>
          ?
        </div>
      )}

      {/* Card art area — contained with border */}
      <div className={`
        ${small ? 'h-[58px] mt-2 mx-0.5' : 'h-[90px] mt-3 mx-1'}
        rounded border border-gray-600/50 overflow-hidden
        bg-stone-700/60 flex items-center justify-center shrink-0
      `}>
        <CardArt cardCode={cardCode} className="w-full h-full" />
      </div>

      {/* Rarity gem — diamond between art and name */}
      {def.rarity !== 'COMMON' && (
        <div className={`flex justify-center ${small ? '-mt-1 z-10' : '-mt-1.5 z-10'}`}>
          <div
            className={`${small ? 'w-2 h-2' : 'w-2.5 h-2.5'} rotate-45 shadow-md`}
            style={{ backgroundColor: rarityColor[def.rarity], boxShadow: `0 0 4px ${rarityColor[def.rarity]}80` }}
          />
        </div>
      )}

      {/* Card name banner — distinct background */}
      <div className={`
        ${small ? 'mx-0.5 px-1 py-px mt-0.5' : 'mx-1 px-1.5 py-0.5 mt-0.5'}
        ${textBg} rounded-sm border-y border-gray-600/30
        text-center z-10 shrink-0 overflow-hidden
      `}>
        <span className={`
          text-white font-bold leading-tight block truncate
          ${small ? 'text-[6px]' : 'text-[9px]'}
          drop-shadow-md
        `}>
          {def.name}
        </span>
      </div>

      {/* Card text — separate boxed area */}
      {def.text ? (
        <div className={`
          flex-1 ${small ? 'mx-0.5 mt-0.5 px-0.5 py-px' : 'mx-1 mt-0.5 px-1 py-0.5'}
          bg-black/25 rounded-sm
          flex items-start justify-center overflow-hidden min-h-0
        `}>
          <p className={`
            text-gray-300 text-center leading-tight
            ${small ? 'text-[5px] line-clamp-2' : 'text-[6.5px] line-clamp-3'}
          `}>
            {def.text}
          </p>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* Bottom stat area — minions & weapons */}
      {hasStats && (
        <div className={`
          flex justify-between items-end shrink-0
          ${small ? 'px-0.5 pb-0.5 pt-0.5' : 'px-1 pb-1 pt-0.5'}
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

          {/* Minion type label — centered between attack/health */}
          {isMinion && def.minionType && (
            <span className={`${small ? 'text-[5px]' : 'text-[7px]'} font-bold text-amber-300/70`}>
              {def.minionType}
            </span>
          )}

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

      {/* Location durability — centered green circle */}
      {isLocation && (
        <div className={`
          flex justify-center items-end shrink-0
          ${small ? 'px-0.5 pb-0.5 pt-0.5' : 'px-1 pb-1 pt-0.5'}
          z-10
        `}>
          <div className={`
            ${small ? 'w-5 h-5 text-[9px]' : 'w-7 h-7 text-xs'}
            rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700
            border border-emerald-300 shadow-md shadow-emerald-500/40
            flex items-center justify-center font-extrabold text-white
          `}>
            {def.health}
          </div>
        </div>
      )}

      {/* Spell bottom spacer (no stats) */}
      {isSpell && !isLocation && <div className={small ? 'h-1' : 'h-2'} />}

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
        ${sizeMap[size]} rounded-xl border-2 border-amber-700
        bg-gradient-to-br from-amber-950 via-stone-900 to-amber-950
        flex items-center justify-center relative overflow-hidden
        ${onClick && !disabled ? 'cursor-pointer hover:brightness-110' : ''}
        ${disabled ? 'cursor-not-allowed' : ''}
      `}
    >
      <div className="absolute inset-2 border border-amber-600 rounded-lg opacity-40" />
      <div className="absolute inset-4 border border-amber-700 rounded-md opacity-25 rotate-45 scale-75" />
      <div className="text-amber-600 font-extrabold text-sm tracking-widest select-none">MIRO</div>
    </button>
  );
}
