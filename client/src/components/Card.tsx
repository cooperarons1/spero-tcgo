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

// Diamond-faceted mana gem modeled on the Shadow-of-Demise style: blue
// gem with bronze ring, light-reflected facets. Used for the mana cost
// badge. `value` is the mana cost rendered centered on the gem.
export function ManaGem({ value, size = 28 }: { value: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))' }}>
      <defs>
        <linearGradient id="mana-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9ecbff" />
          <stop offset="100%" stopColor="#2d62c6" />
        </linearGradient>
        <linearGradient id="mana-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e4a9e" />
          <stop offset="100%" stopColor="#0b214d" />
        </linearGradient>
      </defs>
      {/* Bronze ring backdrop */}
      <circle cx="16" cy="16" r="14" fill="#3a2a15" stroke="#c28a42" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="12" fill="#241607" stroke="#8a5a28" strokeWidth="0.7" />
      {/* Diamond body — two triangles per half for a faceted look */}
      <polygon points="16,5 26,16 16,27 6,16" fill="url(#mana-dark)" stroke="#0a1a38" strokeWidth="0.4" />
      <polygon points="16,5 16,27 6,16" fill="url(#mana-light)" opacity="0.9" />
      <polygon points="16,5 22,16 16,20 10,16" fill="#b5d4ff" opacity="0.5" />
      {/* Mana number centered */}
      <text x="16" y="21" textAnchor="middle" fontSize="13" fontWeight="900" fill="#ffffff" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }} stroke="#0a1a38" strokeWidth="0.5" paintOrder="stroke">
        {value}
      </text>
    </svg>
  );
}

// Hearthstone-style teardrop gem rendered with inline SVG. Gold-rimmed
// circular frame with a rarity-colored jewel inside, highlighted with a
// subtle glint. `size` in px for square bounding box.
function RarityGem({ rarity, size = 14 }: { rarity: string; size?: number }) {
  const stroke = '#d4a24a';
  const fill = rarityColor[rarity] || rarityColor.COMMON;
  const glow = `${fill}99`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ filter: `drop-shadow(0 0 4px ${glow})` }}>
      {/* Gold ring */}
      <circle cx="12" cy="12" r="10" fill="#2a1f10" stroke={stroke} strokeWidth="1.4" />
      <circle cx="12" cy="12" r="8.5" fill="#1a1108" stroke={stroke} strokeWidth="0.6" opacity="0.6" />
      {/* Teardrop gem — point up for RARE/EPIC/LEGENDARY, round for COMMON */}
      {rarity === 'COMMON' ? (
        <>
          <circle cx="12" cy="12" r="6" fill={fill} />
          <ellipse cx="10" cy="9.5" rx="2" ry="1.2" fill="#ffffff" opacity="0.6" />
        </>
      ) : (
        <>
          {/* Teardrop path: point at top, round at bottom */}
          <path d="M 12 4.5 C 8.5 8 7 11 7 13.5 C 7 16.5 9.2 18.8 12 18.8 C 14.8 18.8 17 16.5 17 13.5 C 17 11 15.5 8 12 4.5 Z" fill={fill} />
          {/* Gem highlight */}
          <path d="M 10 8 C 9 10 8.5 12 9 13.5 C 9.5 12.5 10.5 10.5 11.5 8.5 Z" fill="#ffffff" opacity="0.55" />
        </>
      )}
    </svg>
  );
}

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
      {/* ── Mana gem — diamond-faceted blue gem in a bronze ring,
           modeled on Hearthstone/Shadow-of-Demise visuals. ── */}
      <div className={`absolute ${small ? 'top-0.5 left-0.5' : 'top-1 left-1'} z-20`}>
        <ManaGem value={def.manaCost} size={small ? 18 : 26} />
      </div>

      {/* ── Secret badge — top-right, inside card ── */}
      {isSecret && (
        <div className={`
          absolute ${small ? 'top-0.5 right-0.5 w-3.5 h-3.5 text-[6px]' : 'top-1 right-1 w-5 h-5 text-[9px]'}
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

      {/* ── Rarity gem — Hearthstone-style jewel, positioned to overlap the
           bottom edge of the art (higher than before, as requested, so
           it reads as a frame ornament rather than an orphan above the
           name banner). ── */}
      <div className={`flex justify-center ${small ? '-mt-2 z-10' : '-mt-3 z-10'}`}>
        <RarityGem rarity={def.rarity} size={small ? 11 : 16} />
      </div>

      {/* ── Card name banner ── */}
      <div className={`
        ${small ? 'mx-0.5 px-1 py-px' : 'mx-1 px-1.5 py-0.5'}
        bg-stone-900/80 border-y border-amber-700/40
        text-center z-10 shrink-0 overflow-hidden
      `}>
        <span className={`
          text-amber-100 font-bold leading-tight block truncate drop-shadow-md
          ${small
            ? 'text-[6px]'
            : def.name.length > 20 ? 'text-[7px]' : def.name.length > 15 ? 'text-[8px]' : 'text-[8.5px]'
          }
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
            ${small
              ? 'text-[5px] line-clamp-2'
              : def.text.length > 60 ? 'text-[5.5px] line-clamp-3' : 'text-[6.5px] line-clamp-2'
            }
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
            absolute ${small ? 'bottom-0.5 left-0.5 w-4 h-4 text-[8px]' : 'bottom-1 left-1 w-6 h-6 text-[11px]'}
            rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700
            border-2 border-yellow-400 shadow-md shadow-yellow-500/40
            flex items-center justify-center font-extrabold text-white z-20
          `}>
            {def.attack}
          </div>

          {/* Health/Durability — bottom-right */}
          <div className={`
            absolute ${small ? 'bottom-0.5 right-0.5 w-4 h-4 text-[8px]' : 'bottom-1 right-1 w-6 h-6 text-[11px]'}
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
