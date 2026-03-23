import cardsData from '../../../data/cards.json';

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
      <div className={`absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b ${frameAccent} pointer-events-none`} />

      {/* Spell swirl decoration */}
      {isSpell && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border border-violet-500/20 animate-spin" style={{ animationDuration: '8s' }} />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full border border-violet-400/15 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }} />
        </div>
      )}

      {/* Weapon pointed frame accent */}
      {isWeapon && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[30px] border-r-[30px] border-b-[12px] border-l-transparent border-r-transparent border-b-amber-700/30 pointer-events-none" />
      )}

      {/* Mana cost gem — top-left */}
      <div className={`
        absolute ${small ? 'top-0.5 left-0.5 w-5 h-5 text-[10px]' : 'top-1 left-1 w-7 h-7 text-xs'}
        rounded-full bg-gradient-to-br from-blue-400 to-blue-700
        border border-blue-300 shadow-md shadow-blue-500/50
        flex items-center justify-center font-extrabold text-white z-10
      `}>
        {def.manaCost}
      </div>

      {/* Card name banner */}
      <div className={`
        ${small ? 'mt-6 mx-1 px-1 py-0.5' : 'mt-8 mx-2 px-2 py-1'}
        ${rarityBannerBg[def.rarity]} rounded-sm
        text-center z-10
      `}>
        <span className={`
          text-white font-bold leading-tight
          ${small ? 'text-[8px]' : 'text-[10px]'}
          drop-shadow-sm
        `}>
          {def.name}
        </span>
      </div>

      {/* Card text / description area */}
      <div className={`
        flex-1 ${small ? 'mx-1 mt-1 px-1' : 'mx-2 mt-1.5 px-2'}
        flex items-start justify-center overflow-hidden
      `}>
        <p className={`
          text-gray-300 text-center leading-tight
          ${small ? 'text-[6px]' : 'text-[8px]'}
        `}>
          {def.text}
        </p>
      </div>

      {/* Keywords */}
      {def.keywords.length > 0 && (
        <div className={`${small ? 'mx-1 mb-0.5' : 'mx-2 mb-0.5'} flex justify-center flex-wrap gap-0.5`}>
          {def.keywords.map((kw) => (
            <span
              key={kw}
              className={`
                ${small ? 'text-[5px] px-0.5' : 'text-[7px] px-1'}
                bg-white/10 text-gray-400 rounded-sm font-semibold uppercase
              `}
            >
              {kw}
            </span>
          ))}
        </div>
      )}

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
