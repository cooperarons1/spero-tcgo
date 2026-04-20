import cardsData from '../../../data/cards.json';
import { CardArt } from '../utils/cardArt';
import { GoldenEffectsOverlay as GoldenEffectsOverlayLazy } from './GoldenEffectsOverlay';
import { FEATURE_FLAGS } from '../utils/featureFlags';

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
  /** Golden/foil variant: adds a shimmer animation + warm gold tint
   * over the art region while keeping the frame and HUD unchanged. */
  golden?: boolean;
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
  // Hearthstone-reference mana gem: big multi-faceted blue crystal, no
  // bronze ring, sits as a standalone shape you can drop over a card
  // frame. Each facet is a distinct polygon with its own shade so the
  // gem reads as crystalline rather than flat.
  return (
    <svg width={size} height={size} viewBox="0 0 40 44" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.7))', overflow: 'visible' }}>
      <defs>
        <linearGradient id="mgBlueTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfe0ff" />
          <stop offset="100%" stopColor="#4a82d6" />
        </linearGradient>
        <linearGradient id="mgBlueMid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2c5ba8" />
          <stop offset="100%" stopColor="#15306b" />
        </linearGradient>
        <linearGradient id="mgBlueDeep" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a3a78" />
          <stop offset="100%" stopColor="#0a1938" />
        </linearGradient>
      </defs>

      {/* Solid opaque base — guarantees the gem is never see-through
           even where overlapping facets leave sub-pixel gaps. */}
      <polygon
        points="20,1 38,14 32,40 8,40 2,14"
        fill="#15306b"
      />
      {/* Outer crystal outline — dark navy border */}
      <polygon
        points="20,1 38,14 32,40 8,40 2,14"
        fill="url(#mgBlueMid)"
        stroke="#061030"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Top bright facet */}
      <polygon points="20,2 37,13 30,22 20,18 10,22 3,13" fill="url(#mgBlueTop)" />
      {/* Left inner facet */}
      <polygon points="10,22 20,18 18,40 8,39 3,14" fill="url(#mgBlueMid)" opacity="0.85" />
      {/* Right inner facet */}
      <polygon points="30,22 20,18 22,40 32,39 37,14" fill="url(#mgBlueDeep)" opacity="0.95" />
      {/* Bottom deep facet */}
      <polygon points="18,40 22,40 32,39 20,41 8,39" fill="#0a1938" />
      {/* Specular highlight on top-left */}
      <polygon points="9,7 16,4 19,9 13,14" fill="#ffffff" opacity="0.6" />
      <polygon points="20,11 24,9 28,13 22,15" fill="#ffffff" opacity="0.3" />

      {/* Mana number — big, white with thick black stroke */}
      <text
        x="20" y="30"
        textAnchor="middle"
        fontSize="20" fontWeight="900"
        fill="#ffffff"
        stroke="#000000" strokeWidth="2.2"
        paintOrder="stroke"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
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

export function Card({ cardCode, onClick, selected, greyed, small, className, golden }: CardProps) {
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
  // Golden rendering is gated — see utils/featureFlags.ts. Data flag
  // stays plumbed in the type system; visuals go dormant until the
  // animation approach ships.
  const showGold = golden && FEATURE_FLAGS.GOLDEN_CARDS;
  const border = showGold ? 'border-amber-300' : (classBorder[def.heroClass] || classBorder.NEUTRAL);
  const frameBg = showGold
    ? 'bg-gradient-to-b from-amber-700 via-amber-800 to-amber-950'
    : (classFrameBg[def.heroClass] || classFrameBg.NEUTRAL);

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
      {/* ── Ornate corner flourishes (skip on small size where they'd
           fight for space with the stat badges). Thin amber arcs on
           each corner of the frame, pure SVG. ── */}
      {!small && (
        <>
          <svg className="absolute top-0 left-0 w-4 h-4 z-[1] pointer-events-none" viewBox="0 0 16 16">
            <path d="M 1 9 Q 1 1 9 1" fill="none" stroke="#d4a24a" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="1.8" cy="1.8" r="1.1" fill="#d4a24a" />
          </svg>
          <svg className="absolute top-0 right-0 w-4 h-4 z-[1] pointer-events-none" viewBox="0 0 16 16">
            <path d="M 15 9 Q 15 1 7 1" fill="none" stroke="#d4a24a" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="14.2" cy="1.8" r="1.1" fill="#d4a24a" />
          </svg>
          <svg className="absolute bottom-0 left-0 w-4 h-4 z-[1] pointer-events-none" viewBox="0 0 16 16">
            <path d="M 1 7 Q 1 15 9 15" fill="none" stroke="#d4a24a" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="1.8" cy="14.2" r="1.1" fill="#d4a24a" />
          </svg>
          <svg className="absolute bottom-0 right-0 w-4 h-4 z-[1] pointer-events-none" viewBox="0 0 16 16">
            <path d="M 15 7 Q 15 15 7 15" fill="none" stroke="#d4a24a" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="14.2" cy="14.2" r="1.1" fill="#d4a24a" />
          </svg>
        </>
      )}

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

      {/* ── Card art — large, edge-to-edge, ~60% of card. Golden
           variant overlays a shimmer/tint sweep and a gold border glow. ── */}
      <div className={`
        ${small ? 'h-[82px]' : 'h-[118px]'}
        w-full overflow-hidden shrink-0 relative
        bg-stone-800 flex items-center justify-center
        ${golden ? 'shadow-[inset_0_0_0_2px_rgba(245,158,11,0.8)]' : ''}
      `}>
        <CardArt cardCode={cardCode} className="w-full h-full" golden={showGold} />
        {showGold && (
          <GoldenEffectsOverlayLazy cardCode={cardCode} rarity={def.rarity} />
        )}
        {golden && (
          <>
            {/* Warm gold tint wash */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.22) 0%, rgba(252,211,77,0.12) 50%, rgba(245,158,11,0.24) 100%)' }} />
            {/* Animated shimmer sweep */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -inset-y-4 -left-1/2 w-1/3 animate-[shimmer_3s_linear_infinite]" style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)' }} />
            </div>
          </>
        )}
      </div>

      {/* ── Rarity gem — Hearthstone-style jewel, positioned to overlap the
           bottom edge of the art (higher than before, as requested, so
           it reads as a frame ornament rather than an orphan above the
           name banner). ── */}
      <div className={`flex justify-center ${small ? '-mt-2 z-10' : '-mt-3 z-10'}`}>
        <RarityGem rarity={def.rarity} size={small ? 11 : 16} />
      </div>

      {/* ── Card name banner — gold scroll with tapered ends, Hearthstone
           reference. Implemented with overlaid CSS shapes: center
           rectangle plus two angled end-caps. ── */}
      <div className={`relative ${small ? 'mx-0 -mt-0.5 mb-0.5 h-3' : 'mx-0 -mt-1 mb-1 h-5'} z-10 shrink-0 flex items-center justify-center`}>
        {/* Scroll left cap */}
        <div className={`absolute left-0 top-0 bottom-0 ${small ? 'w-2' : 'w-3'} bg-gradient-to-r from-amber-900 to-amber-700 border-y border-amber-400/50`}
          style={{ clipPath: 'polygon(0 50%, 50% 0, 100% 0, 100% 100%, 50% 100%)' }} />
        {/* Scroll right cap */}
        <div className={`absolute right-0 top-0 bottom-0 ${small ? 'w-2' : 'w-3'} bg-gradient-to-l from-amber-900 to-amber-700 border-y border-amber-400/50`}
          style={{ clipPath: 'polygon(0 0, 50% 0, 100% 50%, 50% 100%, 0 100%)' }} />
        {/* Scroll center */}
        <div className={`absolute ${small ? 'left-1.5 right-1.5' : 'left-2 right-2'} top-0 bottom-0 bg-gradient-to-b from-amber-700 via-amber-600 to-amber-800 border-y-2 border-amber-400/60 shadow-inner`} />
        <span className={`
          relative text-amber-50 font-black leading-tight block truncate px-2 tracking-wide
          ${small
            ? 'text-[6px]'
            : def.name.length > 20 ? 'text-[7px]' : def.name.length > 15 ? 'text-[8px]' : 'text-[9px]'
          }
        `} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.6)' }}>
          {def.name}
        </span>
      </div>

      {/* ── Card text — parchment-tan panel inside a dark stone cutout. ── */}
      {def.text ? (
        <div className={`
          flex-1 ${small ? 'mx-0.5 px-0.5 py-px pb-4' : 'mx-1.5 px-1.5 py-1 pb-5'}
          rounded-sm
          flex items-start justify-center overflow-hidden min-h-0
          border border-amber-900/40 shadow-inner
        `}
          style={{ background: 'linear-gradient(to bottom, #d9c7a0 0%, #c5ad85 50%, #b79a6d 100%)' }}
        >
          <p className={`
            text-stone-900 text-center leading-tight font-semibold
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

          {/* Tribe banner — small stylized ribbon centered at the bottom
               of the frame. Tapered-end clip-path + amber gradient
               match the name-scroll aesthetic. */}
          {isMinion && def.minionType && (
            <div className={`absolute ${small ? 'bottom-0' : 'bottom-0.5'} left-1/2 -translate-x-1/2 z-20 flex items-center`}>
              <div
                className={`${small ? 'px-1.5 py-px' : 'px-2 py-0.5'} bg-gradient-to-b from-amber-600 via-amber-700 to-amber-900 border-y border-amber-400/60 shadow`}
                style={{ clipPath: 'polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%)' }}
              >
                <span className={`${small ? 'text-[4px]' : 'text-[6px]'} font-black text-amber-50 tracking-wider drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]`}>
                  {def.minionType}
                </span>
              </div>
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
