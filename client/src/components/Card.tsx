import type { ReactNode } from 'react';
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
  /** Per-instance mana cost override, e.g. Veil Slip's discounted
   * returned minion. When provided, ManaGem shows this number tinted
   * green instead of the def's base cost. */
  costOverride?: number;
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

// Ring variant of classBorder. We use `ring` (which is a box-shadow under
// the hood) instead of `border` for the card's outer class-color frame so
// children — specifically the name banner — can fill the full card width.
// `border-2` plus `overflow-hidden` was clipping all child layout to the
// 136px padding box, leaving the banner permanently inset 2px on each
// side and unable to fill 140px. `ring` doesn't take layout space, so the
// banner can fill 140px while the class-color frame still renders around
// the card edge as a 2px box-shadow.
const classRing: Record<string, string> = {
  JIMMY: 'ring-red-600',
  TALA: 'ring-green-600',
  DEREK: 'ring-yellow-500',
  ANDERS: 'ring-blue-500',
  DES: 'ring-purple-600',
  ASTRID: 'ring-amber-400',
  AVA: 'ring-pink-500',
  LUCAS: 'ring-teal-500',
  IZZY: 'ring-orange-500',
  NEUTRAL: 'ring-stone-500',
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

// Class-themed name-banner gradient + cap + text-accent colors.
// Kept in sync with classBorder so the banner reads as "this card
// belongs to this hero". Neutrals stay on the amber scroll look
// (no class identity → default Hearthstone-ish gold).
const classBannerCenter: Record<string, string> = {
  JIMMY:   'from-red-700 via-red-600 to-red-900',
  TALA:    'from-green-700 via-green-600 to-green-900',
  DEREK:   'from-yellow-600 via-yellow-500 to-yellow-800',
  ANDERS:  'from-blue-700 via-blue-600 to-blue-900',
  DES:     'from-purple-700 via-purple-600 to-purple-900',
  ASTRID:  'from-amber-700 via-amber-500 to-amber-900',
  AVA:     'from-pink-700 via-pink-500 to-pink-900',
  LUCAS:   'from-teal-700 via-teal-500 to-teal-900',
  IZZY:    'from-orange-700 via-orange-500 to-orange-900',
  NEUTRAL: 'from-amber-700 via-amber-600 to-amber-800',
};
const classBannerCap: Record<string, string> = {
  JIMMY:   'from-red-950 to-red-800',
  TALA:    'from-green-950 to-green-800',
  DEREK:   'from-yellow-950 to-yellow-800',
  ANDERS:  'from-blue-950 to-blue-800',
  DES:     'from-purple-950 to-purple-800',
  ASTRID:  'from-amber-950 to-amber-800',
  AVA:     'from-pink-950 to-pink-800',
  LUCAS:   'from-teal-950 to-teal-800',
  IZZY:    'from-orange-950 to-orange-800',
  NEUTRAL: 'from-amber-900 to-amber-700',
};
const classBannerBorder: Record<string, string> = {
  JIMMY:   'border-red-300/60',
  TALA:    'border-green-300/60',
  DEREK:   'border-yellow-300/60',
  ANDERS:  'border-blue-300/60',
  DES:     'border-purple-300/60',
  ASTRID:  'border-amber-300/60',
  AVA:     'border-pink-300/60',
  LUCAS:   'border-teal-300/60',
  IZZY:    'border-orange-300/60',
  NEUTRAL: 'border-amber-400/60',
};

const rarityColor: Record<string, string> = {
  COMMON: '#9ca3af',
  RARE: '#3b82f6',
  EPIC: '#a855f7',
  LEGENDARY: '#f59e0b',
};

/** Visible keyword chips rendered on hand cards. Order matters — they
 * appear left-to-right in this sequence. BATTLECRY/COMBO/DEATHRATTLE are
 * omitted because they're already conveyed by the card text. */
const KEYWORD_CHIPS: Array<{ id: string; label: string; cls: string }> = [
  { id: 'TAUNT',         label: 'Taunt',         cls: 'bg-stone-800 text-amber-200' },
  { id: 'DIVINE_SHIELD', label: 'Divine Shield', cls: 'bg-yellow-900 text-yellow-200' },
  { id: 'CHARGE',        label: 'Charge',        cls: 'bg-red-900 text-red-200' },
  { id: 'STEALTH',       label: 'Stealth',       cls: 'bg-slate-800 text-slate-200' },
  { id: 'WINDFURY',      label: 'Windfury',      cls: 'bg-cyan-900 text-cyan-200' },
  { id: 'LIFESTEAL',     label: 'Lifesteal',     cls: 'bg-rose-900 text-rose-200' },
  { id: 'SPELL_DAMAGE',  label: 'Spell +1',      cls: 'bg-indigo-900 text-indigo-200' },
];

// Inline-SVG keyword glyphs rendered as a row at the bottom of every Card.
// Each entry is a self-contained SVG (with a viewBox of 24×24) so they all
// scale uniformly. Rendered order in KeywordIcons is the order below; only
// the keywords actually present on the card render. Heart for LIFESTEAL,
// shield for TAUNT, sun for DIVINE_SHIELD, bolt for CHARGE, eye for
// STEALTH, swirl for WINDFURY, spark for SPELL_DAMAGE, skull for
// DEATHRATTLE. Tooltip via `title` for accessibility.
const KEYWORD_ICONS: Array<{ id: string; title: string; node: ReactNode }> = [
  {
    id: 'LIFESTEAL', title: 'Lifesteal — damage dealt heals your hero',
    node: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <defs>
          <linearGradient id="kw-lifesteal-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb7185"/>
            <stop offset="55%" stopColor="#be123c"/>
            <stop offset="100%" stopColor="#6d0b22"/>
          </linearGradient>
        </defs>
        <path d="M12 21 C 5 16 1 12 1 8 a 6 6 0 0 1 11 -3 a 6 6 0 0 1 11 3 c 0 4 -4 8 -11 13 z" fill="url(#kw-lifesteal-fill)" stroke="#fecdd3" strokeWidth="1"/>
      </svg>
    ),
  },
  {
    id: 'TAUNT', title: 'Taunt — enemies must attack this minion first',
    node: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <defs>
          <linearGradient id="kw-taunt-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cbd5e1"/>
            <stop offset="100%" stopColor="#475569"/>
          </linearGradient>
        </defs>
        <path d="M12 2 L 21 5 V 12 C 21 17 17 21 12 22 C 7 21 3 17 3 12 V 5 Z" fill="url(#kw-taunt-fill)" stroke="#1e293b" strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    id: 'DIVINE_SHIELD', title: 'Divine Shield — first damage is ignored',
    node: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <defs>
          <radialGradient id="kw-divine-fill" cx="0.5" cy="0.5" r="0.6">
            <stop offset="0%" stopColor="#fff8c5"/>
            <stop offset="60%" stopColor="#facc15"/>
            <stop offset="100%" stopColor="#92580d"/>
          </radialGradient>
        </defs>
        <circle cx="12" cy="12" r="6" fill="url(#kw-divine-fill)" stroke="#7c4a04" strokeWidth="1"/>
        <g stroke="#fde68a" strokeWidth="1.4" strokeLinecap="round">
          <line x1="12" y1="1" x2="12" y2="4"/>
          <line x1="12" y1="20" x2="12" y2="23"/>
          <line x1="1" y1="12" x2="4" y2="12"/>
          <line x1="20" y1="12" x2="23" y2="12"/>
          <line x1="4.2" y1="4.2" x2="6.3" y2="6.3"/>
          <line x1="17.7" y1="17.7" x2="19.8" y2="19.8"/>
          <line x1="4.2" y1="19.8" x2="6.3" y2="17.7"/>
          <line x1="17.7" y1="6.3" x2="19.8" y2="4.2"/>
        </g>
      </svg>
    ),
  },
  {
    id: 'CHARGE', title: 'Charge — can attack the turn it is summoned',
    node: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M14 2 L 4 14 H 11 L 8 22 L 20 9 H 13 Z" fill="#fde047" stroke="#a16207" strokeWidth="1" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'STEALTH', title: 'Stealth — cannot be targeted until it attacks',
    node: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <ellipse cx="12" cy="12" rx="10" ry="6" fill="#1e293b" stroke="#94a3b8" strokeWidth="1"/>
        <circle cx="12" cy="12" r="3" fill="#0f172a"/>
        <line x1="3" y1="3" x2="21" y2="21" stroke="#cbd5e1" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'WINDFURY', title: 'Windfury — can attack twice each turn',
    node: (
      <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round">
        <path d="M3 8 H 13 a 3 3 0 1 0 -3 -3"/>
        <path d="M3 14 H 17 a 3 3 0 1 1 -3 3"/>
        <path d="M3 20 H 9"/>
      </svg>
    ),
  },
  {
    id: 'SPELL_DAMAGE', title: 'Spell Damage +1',
    node: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 2 L 14 10 L 22 12 L 14 14 L 12 22 L 10 14 L 2 12 L 10 10 Z" fill="#a78bfa" stroke="#5b21b6" strokeWidth="1" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'DEATHRATTLE', title: 'Deathrattle — triggers when this minion dies',
    node: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 2 a 8 8 0 0 1 8 8 v 4 a 4 4 0 0 1 -2 3.5 V 21 H 6 V 17.5 A 4 4 0 0 1 4 14 V 10 a 8 8 0 0 1 8 -8 z" fill="#e5e7eb" stroke="#1f2937" strokeWidth="1"/>
        <circle cx="9" cy="11" r="2" fill="#1f2937"/>
        <circle cx="15" cy="11" r="2" fill="#1f2937"/>
        <rect x="11" y="14.5" width="2" height="3" fill="#1f2937"/>
      </svg>
    ),
  },
];

function KeywordIcons({ keywords, small }: { keywords: string[]; small?: boolean }) {
  const present = KEYWORD_ICONS.filter((kw) => keywords.includes(kw.id));
  if (!present.length) return null;
  // Above stat circles + minion-type label so we don't fight bottom-corners.
  // Centered horizontally; max-width keeps the row from intruding on the
  // attack/health badges (each ~24px corner). Compact gap so 3+ icons fit.
  const sizeCls = small ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';
  const bottomCls = small ? 'bottom-[18px]' : 'bottom-[26px]';
  return (
    <div
      className={`absolute ${bottomCls} left-1/2 -translate-x-1/2 z-[22] pointer-events-none flex items-center justify-center gap-0.5`}
      style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.85))' }}
    >
      {present.map((kw) => (
        <span key={kw.id} className={`${sizeCls} block`} title={kw.title} aria-label={kw.id.toLowerCase()}>
          {kw.node}
        </span>
      ))}
    </div>
  );
}

// Diamond-faceted mana gem modeled on the Shadow-of-Demise style: blue
// gem with bronze ring, light-reflected facets. Used for the mana cost
// badge. `value` is the mana cost rendered centered on the gem.
export function ManaGem({ value, size = 28, discounted = false }: { value: number; size?: number; discounted?: boolean }) {
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

      {/* Mana number — big, white (green when discounted below base) with thick black stroke */}
      <text
        x="20" y="30"
        textAnchor="middle"
        fontSize="20" fontWeight="900"
        fill={discounted ? '#86efac' : '#ffffff'}
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

export function Card({ cardCode, onClick, selected, greyed, small, className, golden, costOverride }: CardProps) {
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
  // `ring` instead of `border` so the class-color frame doesn't take 2px
  // of layout on each side — was forcing the banner to be inset 2px.
  const ring = showGold ? 'ring-amber-300' : (classRing[def.heroClass] || classRing.NEUTRAL);
  const frameBg = showGold
    ? 'bg-gradient-to-b from-amber-700 via-amber-800 to-amber-950'
    : (classFrameBg[def.heroClass] || classFrameBg.NEUTRAL);

  return (
    <button
      onClick={onClick}
      className={`
        ${small ? 'w-[100px] h-[143px]' : 'w-[140px] h-[200px]'}
        rounded-lg ring-2 ${ring} flex-shrink-0
        ${frameBg} relative overflow-hidden
        flex flex-col transition-all duration-200
        ${onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg active:scale-95' : ''}
        ${selected ? 'ring-white ring-offset-1 ring-offset-black shadow-lg shadow-white/20' : ''}
        ${greyed ? 'opacity-40 grayscale' : ''}
        ${className ?? ''}
      `}
      style={{
        // Metallic gold inlay + dark stone carved-out ring. Stacked
        // insets: inner amber hairline, thin dark seat, then outer
        // dark stroke. Reads as "gold frame embedded in stone" not
        // a flat colored border.
        boxShadow:
          'inset 0 0 0 1px rgba(212,162,74,0.9),' +
          'inset 0 0 0 3px rgba(23,15,6,0.85),' +
          'inset 0 2px 6px rgba(255,215,130,0.15),' +
          'inset 0 -3px 6px rgba(0,0,0,0.5),' +
          '0 3px 8px rgba(0,0,0,0.55)',
      }}
    >
      {/* ── Legendary crest — small dragon-style SVG medallion at the
           top-center of the frame, above the mana gem. Marks out
           LEGENDARIES visually the way Hearthstone does with its
           dragon adornment. Skipped on 'small' size where the top
           strip is already crowded. ── */}
      {def.rarity === 'LEGENDARY' && !small && (
        <svg
          className="absolute left-1/2 -translate-x-1/2 -top-1 w-10 h-3 z-[3] pointer-events-none"
          viewBox="0 0 40 12"
          aria-hidden
        >
          <defs>
            <linearGradient id="legcrest-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f5d58a" />
              <stop offset="50%" stopColor="#d4a24a" />
              <stop offset="100%" stopColor="#8a5a28" />
            </linearGradient>
          </defs>
          {/* Wing left */}
          <path d="M 2 7 Q 8 2 14 6 Q 10 3 6 9 Z" fill="url(#legcrest-g)" stroke="#2a1a08" strokeWidth="0.5" />
          {/* Wing right */}
          <path d="M 38 7 Q 32 2 26 6 Q 30 3 34 9 Z" fill="url(#legcrest-g)" stroke="#2a1a08" strokeWidth="0.5" />
          {/* Center orb */}
          <circle cx="20" cy="6" r="3" fill="url(#legcrest-g)" stroke="#2a1a08" strokeWidth="0.6" />
          <circle cx="20" cy="5" r="1" fill="#fff5d0" opacity="0.8" />
        </svg>
      )}
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
        <ManaGem
          value={costOverride ?? def.manaCost}
          size={small ? 18 : 26}
          discounted={costOverride != null && costOverride < def.manaCost}
        />
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

      {/* ── Rarity gem — absolutely positioned over the bottom edge
           of the card art so it can't be hidden behind the name
           banner below. top offset picked so gem sits with 2/3 over
           the art + 1/3 over the scroll. z-30 beats the banner's z-10. ── */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
        style={{ top: small ? '68px' : '100px' }}
      >
        <RarityGem rarity={def.rarity} size={small ? 10 : 14} />
      </div>

      {/* ── Card name banner — gold scroll with tapered ends, Hearthstone
           reference. Implemented with overlaid CSS shapes: center
           rectangle plus two angled end-caps. `w-full` is explicit because
           in Electron's Chromium build the flex-col stretch default was
           collapsing the wrapper to text width — the absolute scroll caps
           ride on the wrapper's width, so a collapsed wrapper produced a
           shrink-to-fit banner instead of one that spans the whole card. ── */}
      <div className={`relative w-full ${small ? '-mt-0.5 mb-0.5 h-3' : '-mt-1 mb-1 h-5'} z-10 shrink-0 flex items-center justify-center`}>
        {(() => {
          const cls = def.heroClass || 'NEUTRAL';
          const cap = classBannerCap[cls] ?? classBannerCap.NEUTRAL;
          const center = classBannerCenter[cls] ?? classBannerCenter.NEUTRAL;
          const bord = classBannerBorder[cls] ?? classBannerBorder.NEUTRAL;
          return (
            <>
              {/* Scroll left cap */}
              <div className={`absolute left-0 top-0 bottom-0 ${small ? 'w-2' : 'w-3'} bg-gradient-to-r ${cap} border-y ${bord}`}
                style={{ clipPath: 'polygon(0 50%, 50% 0, 100% 0, 100% 100%, 50% 100%)' }} />
              {/* Scroll right cap */}
              <div className={`absolute right-0 top-0 bottom-0 ${small ? 'w-2' : 'w-3'} bg-gradient-to-l ${cap} border-y ${bord}`}
                style={{ clipPath: 'polygon(0 0, 50% 0, 100% 50%, 50% 100%, 0 100%)' }} />
              {/* Scroll center */}
              <div className={`absolute ${small ? 'left-1.5 right-1.5' : 'left-2 right-2'} top-0 bottom-0 bg-gradient-to-b ${center} border-y-2 ${bord} shadow-inner`} />
            </>
          );
        })()}
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

      {/* Keyword chip strip removed — the text box already shows each
           keyword by name, so the stacked badges above the art were
           redundant and obscured the portrait. Replaced with the
           bottom-of-card KeywordIcons row (rendered below). */}

      {/* ── Card text — parchment-tan panel inside a dark stone cutout.
           Full card width — the gold ring lives outside layout (ring-2),
           so the text panel can sit flush to the card edge without
           clipping the frame. Bottom padding clears the absolute stat
           badges. ── */}
      {def.text ? (
        <div className={`
          flex-1 w-full ${small ? 'px-1 py-px pb-4' : 'px-1.5 py-1 pb-5'}
          flex items-start justify-center overflow-hidden min-h-0
          border-y border-amber-900/40 shadow-inner
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

      {/* ── Keyword icons row — bottom of card, above the stat circles.
           One small SVG glyph per keyword the card has. Lifesteal heart,
           Taunt shield, Divine Shield sun, Charge bolt, Stealth eye,
           Windfury swirl, Spell Damage spark, Deathrattle skull. ── */}
      <KeywordIcons keywords={def.keywords} small={small} />

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

          {isMinion && def.minionType && (
            <div className={`absolute ${small ? 'bottom-0.5' : 'bottom-1'} left-1/2 -translate-x-1/2 z-20 pointer-events-none`}>
              <span
                className={`${small ? 'text-[5px]' : 'text-[7px]'} font-black text-amber-200 tracking-wider uppercase`}
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)' }}
              >
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
