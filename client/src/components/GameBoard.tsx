import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import type {
  ClientGameState,
  ClientCardInstance,
  BoardMinion,
  BoardLocation,
  Weapon,
  CardDef,
  HeroClass,
  CardRarity,
  PendingInteraction,
  TargetOption,
  PostGameRewards,
} from '../../../shared/types';
import { HERO_POWER_COST, MAX_BOARD_SIZE } from '../../../shared/types';
import { useGameActions } from '../hooks/useGameActions';
import { useStateDiff } from '../hooks/useStateDiff';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { soundManager } from '../utils/soundManager';
import { CardArt } from '../utils/cardArt';
import { Card as CardComponent, ManaGem } from './Card';
import { socket } from '../socket';
import { FloatingNumbers } from './FloatingNumbers';
import { Settings } from './Settings';
import { DeathAnimation } from './DeathAnimation';
import { SpellCastEffect } from './SpellCastEffect';
import { GameOver } from './GameOver';
import { TurnBanner } from './TurnBanner';
import cardsJson from '../../../data/cards.json';
import { CARD_BACKS } from '../../../shared/seasons';

// ─── Card back style lookup ───
const CARD_BACK_STYLES: Record<string, { type: 'gradient' | 'image'; value: string; borderColor: string }> = {};
for (const cb of CARD_BACKS) {
  CARD_BACK_STYLES[cb.id] = cb.style;
}

// ─── Responsive card scale hook ───
function useCardScale(): number {
  const [scale, setScale] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const w = window.innerWidth;
    return w >= 1200 ? 1 : w >= 768 ? 0.75 : 0.6;
  });
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setScale(w >= 1200 ? 1 : w >= 768 ? 0.75 : 0.6);
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return scale;
}

// ─── Pointer drag state (replaces HTML5 drag-and-drop for mobile compat) ───
type PointerDragKind =
  | { kind: 'hand-card'; cardInstanceId: string; cardType: string | null; targetType: string | null }
  | { kind: 'attack'; attackerInstanceId: string }
  | { kind: 'hero-power' }
  | null;

interface PointerDragState {
  info: NonNullable<PointerDragKind>;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
  activated: boolean; // true once past 5px threshold
}

// ─── Card lookup ───
const CARD_MAP = new Map<string, CardDef>();
for (const c of cardsJson as CardDef[]) {
  CARD_MAP.set(c.cardCode, c);
}
function getCard(code: string | null): CardDef | undefined {
  return code ? CARD_MAP.get(code) : undefined;
}

// ─── Hero class colors ───
const CLASS_COLORS: Record<HeroClass, string> = {
  JIMMY: '#ef4444',
  TALA: '#22c55e',
  DEREK: '#eab308',
  ANDERS: '#3b82f6',
  DES: '#a855f7',
  ASTRID: '#f5c842',
  AVA: '#ec4899',
  LUCAS: '#14b8a6',
  IZZY: '#f97316',
  NEUTRAL: '#9ca3af',
};
const CLASS_BORDER: Record<HeroClass, string> = {
  JIMMY: 'border-red-500',
  TALA: 'border-green-500',
  DEREK: 'border-yellow-500',
  ANDERS: 'border-blue-500',
  DES: 'border-purple-500',
  ASTRID: 'border-yellow-400',
  AVA: 'border-pink-500',
  LUCAS: 'border-teal-500',
  IZZY: 'border-orange-500',
  NEUTRAL: 'border-gray-400',
};
const CLASS_BG: Record<HeroClass, string> = {
  JIMMY: 'bg-red-900/40',
  TALA: 'bg-green-900/40',
  DEREK: 'bg-yellow-900/40',
  ANDERS: 'bg-blue-900/40',
  DES: 'bg-purple-900/40',
  ASTRID: 'bg-yellow-900/40',
  AVA: 'bg-pink-900/40',
  LUCAS: 'bg-teal-900/40',
  IZZY: 'bg-orange-900/40',
  NEUTRAL: 'bg-gray-700/40',
};

// ─── Rarity colors ───
const RARITY_COLORS: Record<CardRarity, string> = {
  COMMON: '#9ca3af',
  RARE: '#3b82f6',
  EPIC: '#a855f7',
  LEGENDARY: '#f59e0b',
};

// ─── Card targeting helper ───
function cardNeedsTarget(def: CardDef): { needsTarget: boolean; targetType: string | null } {
  const TARGETING_TYPES = ['TARGET_MINION','TARGET_ANY','TARGET_FRIENDLY_MINION','TARGET_ENEMY_MINION'];
  if (def.type === 'SPELL') {
    const effects = def.spellEffects ?? (def.spellEffect ? [def.spellEffect] : []);
    for (const e of effects) {
      if (TARGETING_TYPES.includes(e.target)) return { needsTarget: true, targetType: e.target };
    }
  }
  return { needsTarget: false, targetType: null };
}

function locationNeedsTarget(def: CardDef): { needsTarget: boolean; targetType: string | null } {
  const TARGETING_TYPES = ['TARGET_MINION','TARGET_ANY','TARGET_FRIENDLY_MINION','TARGET_ENEMY_MINION','TARGET_HERO'];
  const effects = def.locationEffects ?? (def.locationEffect ? [def.locationEffect] : []);
  for (const e of effects) {
    if (TARGETING_TYPES.includes(e.target)) return { needsTarget: true, targetType: e.target };
  }
  return { needsTarget: false, targetType: null };
}

// ─── Hero powers that need targeting ───
const HERO_POWER_TARGETING: Partial<Record<HeroClass, string>> = {
  JIMMY: 'TARGET_ANY',
  TALA: 'TARGET_FRIENDLY_MINION',
  ANDERS: 'TARGET_MINION',
  ASTRID: 'TARGET_FRIENDLY_MINION',
};

// ─── Hero Power Descriptions ───
const HERO_POWER_DESC: Record<HeroClass, string> = {
  JIMMY: 'Orra Arrow: Deal 2 damage to any target',
  TALA: 'Healing Touch: Restore 2 Health to any character',
  DEREK: 'Tinker: Draw a card',
  ANDERS: 'Hockbandy Strike: Deal 2 damage to a minion and Freeze it',
  DES: 'Orra Siphon: Deal 1 damage to the enemy hero',
  ASTRID: "Nature's Touch: Give a friendly minion +1/+1",
  AVA: 'Deploy Drone: Summon a 1/1 Gadget Drone',
  LUCAS: "Coyote's Trick: Add a random 1-cost card to your hand",
  IZZY: 'Chart Course: Gain 2 Armor. Draw 1 if you have 5+ Armor',
  NEUTRAL: 'Hero Power',
};

// Hero power upgrades removed — base powers only

// Upgrade conditions shown to players
const HERO_UPGRADE_CONDITIONS: Record<HeroClass, { description: string; target: number }> = {
  JIMMY: { description: 'Kill enemy minions', target: 3 },
  TALA: { description: 'Total HP healed', target: 10 },
  DEREK: { description: 'Cards drawn from effects', target: 5 },
  ANDERS: { description: 'Minions frozen', target: 4 },
  DES: { description: 'Enemy minions destroyed', target: 4 },
  ASTRID: { description: 'Divine Shield minions at once', target: 3 },
  AVA: { description: 'Minions summoned', target: 8 },
  LUCAS: { description: 'Enemy minions returned', target: 3 },
  IZZY: { description: 'Armor gained', target: 10 },
  NEUTRAL: { description: '', target: 0 },
};

// ─── Hero Power SVG Icons ───
const HERO_POWER_SVG: Record<HeroClass, React.ReactNode> = {
  JIMMY: ( // fire arrow
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" />
    </svg>
  ),
  TALA: ( // leaf
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66c.42-1.2 1.1-2.5 2.16-3.57C9.48 16.8 11.68 15.81 15 16V20l7-7-7-7v2z" />
    </svg>
  ),
  DEREK: ( // magnifying glass
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </svg>
  ),
  ANDERS: ( // snowflake
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" strokeLinecap="round" />
    </svg>
  ),
  DES: ( // dark orb
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.7" />
      <circle cx="12" cy="12" r="4" fill="black" opacity="0.5" />
      <circle cx="10" cy="10" r="1.5" fill="white" opacity="0.3" />
    </svg>
  ),
  ASTRID: ( // shield
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
    </svg>
  ),
  AVA: ( // drone/circuit
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M12 2v5m0 10v5M2 12h5m10 0h5" strokeLinecap="round" />
    </svg>
  ),
  LUCAS: ( // paw print
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <ellipse cx="12" cy="17" rx="4.5" ry="3" />
      <circle cx="7" cy="11" r="2" />
      <circle cx="17" cy="11" r="2" />
      <circle cx="9.5" cy="6.5" r="1.5" />
      <circle cx="14.5" cy="6.5" r="1.5" />
    </svg>
  ),
  IZZY: ( // compass
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <polygon points="16,8 14,14 8,16 10,10" fill="currentColor" stroke="none" />
    </svg>
  ),
  NEUTRAL: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <circle cx="12" cy="12" r="6" />
    </svg>
  ),
};

// ─── Hero Portrait PNGs (available for some heroes) ───
const HERO_PORTRAIT_PNGS: Partial<Record<HeroClass, string>> = {
  JIMMY: '/heroes/JIMMY.png',
  TALA: '/heroes/TALA.png',
  DEREK: '/heroes/DEREK.png',
};

// ─── Hero Portrait SVGs (fallback) ───
const HERO_PORTRAIT_SVG: Record<HeroClass, React.ReactNode> = {
  JIMMY: (
    <svg viewBox="0 0 60 60" className="w-full h-full">
      <circle cx="30" cy="22" r="11" fill="#dc2626"/>
      <path d="M19 33 Q30 30 41 33 L39 55 Q30 58 21 55Z" fill="#b91c1c"/>
      <path d="M22 15 Q25 5 28 14" fill="#f97316" opacity="0.9"/>
      <path d="M28 13 Q30 2 32 13" fill="#fbbf24" opacity="0.9"/>
      <path d="M32 14 Q35 5 38 15" fill="#f97316" opacity="0.9"/>
      <circle cx="26" cy="21" r="1.5" fill="#fbbf24"/>
      <circle cx="34" cy="21" r="1.5" fill="#fbbf24"/>
    </svg>
  ),
  TALA: (
    <svg viewBox="0 0 60 60" className="w-full h-full">
      <circle cx="30" cy="24" r="11" fill="#16a34a"/>
      <path d="M19 35 Q30 32 41 35 L39 55 Q30 58 21 55Z" fill="#15803d"/>
      <path d="M20 18 Q25 8 30 16" fill="#4ade80" opacity="0.8"/>
      <path d="M30 16 Q35 8 40 18" fill="#4ade80" opacity="0.8"/>
      <path d="M25 14 Q30 6 35 14" fill="#86efac" opacity="0.7"/>
      <circle cx="26" cy="23" r="1.5" fill="#86efac"/>
      <circle cx="34" cy="23" r="1.5" fill="#86efac"/>
    </svg>
  ),
  DEREK: (
    <svg viewBox="0 0 60 60" className="w-full h-full">
      <circle cx="30" cy="26" r="11" fill="#ca8a04"/>
      <ellipse cx="30" cy="17" rx="16" ry="3" fill="#a16207"/>
      <rect x="22" y="8" width="16" height="10" rx="3" fill="#ca8a04"/>
      <path d="M19 37 Q30 34 41 37 L39 55 Q30 58 21 55Z" fill="#a16207"/>
      <circle cx="26" cy="25" r="1.5" fill="#fef08a"/>
      <circle cx="34" cy="25" r="1.5" fill="#fef08a"/>
      <circle cx="44" cy="40" r="5" fill="none" stroke="#fef08a" strokeWidth="1.5" opacity="0.5"/>
      <line x1="48" y1="44" x2="52" y2="48" stroke="#fef08a" strokeWidth="1.5" opacity="0.5"/>
    </svg>
  ),
  ANDERS: (
    <svg viewBox="0 0 60 60" className="w-full h-full">
      <circle cx="30" cy="24" r="11" fill="#2563eb"/>
      <path d="M19 35 Q30 32 41 35 L39 55 Q30 58 21 55Z" fill="#1d4ed8"/>
      <path d="M22 15 L25 6 L28 15" fill="#93c5fd" opacity="0.8"/>
      <path d="M28 13 L30 3 L32 13" fill="#bfdbfe" opacity="0.9"/>
      <path d="M32 15 L35 6 L38 15" fill="#93c5fd" opacity="0.8"/>
      <circle cx="26" cy="23" r="1.5" fill="#bfdbfe"/>
      <circle cx="34" cy="23" r="1.5" fill="#bfdbfe"/>
    </svg>
  ),
  DES: (
    <svg viewBox="0 0 60 60" className="w-full h-full">
      <path d="M18 30 Q18 8 30 10 Q42 8 42 30Z" fill="#7c3aed"/>
      <circle cx="30" cy="24" r="8" fill="#581c87"/>
      <path d="M19 35 Q30 32 41 35 L39 55 Q30 58 21 55Z" fill="#6d28d9"/>
      <circle cx="27" cy="23" r="1.5" fill="#c084fc"/>
      <circle cx="33" cy="23" r="1.5" fill="#c084fc"/>
      <circle cx="30" cy="30" r="25" fill="none" stroke="#a855f7" strokeWidth="1" opacity="0.15"/>
    </svg>
  ),
  ASTRID: (
    <svg viewBox="0 0 60 60" className="w-full h-full">
      <circle cx="30" cy="22" r="11" fill="#eab308"/>
      <path d="M20 18 Q30 6 40 18" fill="#ca8a04"/>
      <rect x="28" y="6" width="4" height="14" rx="1" fill="#fbbf24"/>
      <path d="M19 33 Q30 30 41 33 L39 55 Q30 58 21 55Z" fill="#a16207"/>
      <path d="M26 38 L30 36 L34 38 L34 46 Q30 49 26 46Z" fill="#fbbf24" opacity="0.7"/>
      <circle cx="26" cy="21" r="1.5" fill="#fef9c3"/>
      <circle cx="34" cy="21" r="1.5" fill="#fef9c3"/>
    </svg>
  ),
  AVA: (
    <svg viewBox="0 0 60 60" className="w-full h-full">
      <circle cx="30" cy="24" r="11" fill="#db2777"/>
      <path d="M19 35 Q30 32 41 35 L39 55 Q30 58 21 55Z" fill="#be185d"/>
      <circle cx="25" cy="22" r="4" fill="none" stroke="#f9a8d4" strokeWidth="1.5"/>
      <circle cx="35" cy="22" r="4" fill="none" stroke="#f9a8d4" strokeWidth="1.5"/>
      <line x1="29" y1="22" x2="31" y2="22" stroke="#f9a8d4" strokeWidth="1.5"/>
      <circle cx="25" cy="22" r="2" fill="#fbcfe8" opacity="0.5"/>
      <circle cx="35" cy="22" r="2" fill="#fbcfe8" opacity="0.5"/>
      <line x1="30" y1="13" x2="30" y2="8" stroke="#f9a8d4" strokeWidth="1"/>
      <circle cx="30" cy="7" r="2" fill="#f472b6"/>
    </svg>
  ),
  LUCAS: (
    <svg viewBox="0 0 60 60" className="w-full h-full">
      <circle cx="30" cy="24" r="11" fill="#0d9488"/>
      <path d="M19 35 Q30 32 41 35 L39 55 Q30 58 21 55Z" fill="#0f766e"/>
      <path d="M20 20 Q22 10 26 16" fill="#2dd4bf" opacity="0.7"/>
      <path d="M34 16 Q38 10 40 20" fill="#2dd4bf" opacity="0.7"/>
      <path d="M26 14 Q30 8 34 14" fill="#5eead4" opacity="0.6"/>
      <circle cx="26" cy="23" r="1.5" fill="#99f6e4"/>
      <circle cx="34" cy="23" r="1.5" fill="#99f6e4"/>
      <circle cx="24" cy="44" r="2" fill="#5eead4" opacity="0.4"/>
      <circle cx="36" cy="44" r="2" fill="#5eead4" opacity="0.4"/>
    </svg>
  ),
  IZZY: (
    <svg viewBox="0 0 60 60" className="w-full h-full">
      <circle cx="30" cy="24" r="11" fill="#ea580c"/>
      <path d="M19 35 Q30 32 41 35 L39 55 Q30 58 21 55Z" fill="#c2410c"/>
      <path d="M20 18 Q30 12 40 18" fill="#fb923c"/>
      <path d="M40 18 L48 22 L44 20" fill="#fb923c" opacity="0.7"/>
      <circle cx="26" cy="23" r="1.5" fill="#fed7aa"/>
      <circle cx="34" cy="23" r="1.5" fill="#fed7aa"/>
      <circle cx="30" cy="42" r="4" fill="none" stroke="#fdba74" strokeWidth="1" opacity="0.6"/>
      <polygon points="30,39 31,42 30,45 29,42" fill="#fdba74" opacity="0.6"/>
    </svg>
  ),
  NEUTRAL: (
    <svg viewBox="0 0 60 60" className="w-full h-full">
      <circle cx="30" cy="24" r="11" fill="#6b7280"/>
      <path d="M19 35 Q30 32 41 35 L39 55 Q30 58 21 55Z" fill="#4b5563"/>
      <circle cx="26" cy="23" r="1.5" fill="#d1d5db"/>
      <circle cx="34" cy="23" r="1.5" fill="#d1d5db"/>
    </svg>
  ),
};

// ─── Props ───
interface GameBoardProps {
  gameState: ClientGameState;
  opponentHovering: boolean;
  opponentEmote: string | null;
  onLeaveGame: () => void;
  uid: string;
  postGameRewards: PostGameRewards | null;
}

// ─── Targeting modes ───
type TargetingMode =
  | { type: 'none' }
  | { type: 'play-card'; cardInstanceId: string; cardDef: CardDef; position: number }
  | { type: 'attack'; attackerInstanceId: string }
  | { type: 'hero-power' }
  | { type: 'activate-location'; locationInstanceId: string; cardDef: CardDef }
  | { type: 'interaction'; interactionId: string };

// ─── Mulligan Screen ───
function MulliganScreen({
  hand,
  onConfirm,
  confirmed,
  deadlineAt,
}: {
  hand: ClientCardInstance[];
  onConfirm: (replacements: boolean[]) => void;
  confirmed: boolean;
  deadlineAt: number | null;
}) {
  const [replacing, setReplacing] = useState<boolean[]>(hand.map(() => false));
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!deadlineAt) { setSecondsLeft(null); return; }
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [deadlineAt]);

  const toggle = (i: number) => {
    if (confirmed) return;
    setReplacing((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, #2a1a08 0%, #0a0604 100%)' }}>
      <h2 className="mb-0.5 text-2xl md:text-4xl font-extrabold text-amber-100 drop-shadow-lg tracking-wide animate-bounce-in">Starting Hand</h2>
      <p className="mb-4 md:mb-8 text-amber-300/60 text-xs md:text-sm italic animate-fade-in" style={{ animationDelay: '180ms', animationFillMode: 'both' }}>Keep or Replace Cards</p>
      {secondsLeft !== null && (
        <div className={`absolute top-6 right-6 flex items-center gap-1 rounded-full px-4 py-2 border-2 font-bold text-lg shadow-lg ${
          secondsLeft <= 10 ? 'bg-red-900/80 border-red-400 text-red-100 animate-pulse' : 'bg-stone-900/80 border-amber-500/60 text-amber-200'
        }`}>
          <span className="text-sm opacity-70">⏱</span>
          {secondsLeft}s
        </div>
      )}
      <div className="flex gap-3 md:gap-5 px-2">
        {hand.map((c, i) => {
          const def = getCard(c.cardCode);
          const isReplacing = replacing[i];
          // Cards deal in left-to-right with a small per-card delay so
          // the mulligan reveal feels like a dealer flicking cards out
          // instead of all four landing simultaneously.
          const dealDelay = `${i * 90}ms`;
          return (
            <button
              key={c.instanceId}
              onClick={() => toggle(i)}
              className={`relative flex h-48 w-32 md:h-64 md:w-44 flex-col items-center rounded-xl border-3 overflow-hidden transition-all duration-300 animate-card-deal
                ${isReplacing
                  ? 'border-gray-500/60 scale-95'
                  : 'border-green-400 shadow-[0_0_15px_rgba(74,222,128,0.5)] hover:shadow-[0_0_25px_rgba(74,222,128,0.7)] hover:scale-105'}
              `}
              style={{ background: 'linear-gradient(to bottom, #3d2a14, #2a1a08)', animationDelay: dealDelay, animationFillMode: 'both' }}
            >
              {/* Mana gem */}
              <div className="absolute -left-1 -top-1 z-20"><ManaGem value={def?.manaCost ?? 0} size={32} /></div>
              {/* Card art — large */}
              <div className="w-full h-24 md:h-32 mt-1 overflow-hidden">
                {c.cardCode && <CardArt cardCode={c.cardCode} className="w-full h-full" />}
              </div>
              {/* Name */}
              <span className="text-[11px] md:text-xs font-bold text-amber-100 text-center leading-tight truncate w-full px-2 mt-1">
                {def?.name ?? 'Unknown'}
              </span>
              {/* Text */}
              <span className="text-[8px] md:text-[9px] text-amber-200/50 text-center leading-tight line-clamp-2 px-2 flex-1">{def?.text}</span>
              {/* Stats */}
              {def?.type === 'MINION' && (
                <div className="flex w-full justify-between px-2 pb-1">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 border border-yellow-400 text-xs font-extrabold text-white">
                    {def.attack}
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-800 border border-red-400 text-xs font-extrabold text-white">
                    {def.health}
                  </span>
                </div>
              )}
              {/* Replace overlay — big red X, full color card stays visible */}
              {isReplacing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                  <span className="text-7xl md:text-8xl text-red-500 font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" style={{ lineHeight: 1 }}>{'\u2715'}</span>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-1">
                    <span className="text-xs md:text-sm font-extrabold text-red-400 tracking-wider">REPLACED</span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
      <button
        disabled={confirmed}
        onClick={() => onConfirm(replacing)}
        className={`mt-8 rounded-full px-12 py-3 text-lg font-extrabold tracking-wide transition-all animate-slide-up
          ${confirmed
            ? 'bg-stone-700 text-stone-500 cursor-not-allowed'
            : 'bg-gradient-to-b from-blue-400 to-blue-600 text-white hover:from-blue-300 hover:to-blue-500 hover:scale-105 shadow-[0_0_25px_rgba(59,130,246,0.5)] cursor-pointer'}
        `}
        style={{ animationDelay: '500ms', animationFillMode: 'both' }}
      >
        {confirmed ? 'Waiting for opponent...' : 'Confirm'}
      </button>
    </div>
  );
}

// ─── Minion Card on Board ───
function BoardMinionCard({
  minion,
  isMyMinion,
  canAct,
  hasSummoningSickness,
  isValidTarget,
  isSelected,
  onClick,
  animationClass,
  isBuffed,
  onPointerDown,
  animStyle,
}: {
  minion: BoardMinion;
  isMyMinion: boolean;
  canAct: boolean;
  hasSummoningSickness: boolean;
  isValidTarget: boolean;
  isSelected: boolean;
  onClick: () => void;
  animationClass?: string;
  isBuffed?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  animStyle?: Record<string, string | number>;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const def = getCard(minion.cardCode);
  const isDamaged = minion.currentHealth < minion.maxHealth;
  const isSilenced = minion.isSilenced;
  const hasTaunt = !isSilenced && def?.keywords.includes('TAUNT');
  const hasDivine = minion.hasDivineShield;
  const isFrozen = minion.isFrozen;
  const isStealth = minion.hasStealthUntilAttack;
  const hasDeathrattle = !isSilenced && def?.keywords.includes('DEATHRATTLE');
  const rarityColor = def ? RARITY_COLORS[def.rarity] : undefined;

  return (
    <button
      onClick={onClick}
      onPointerDown={onPointerDown}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={animStyle as React.CSSProperties}
      className={`relative w-[9rem] h-[10.5rem] select-none touch-none transition-all
        ${hasTaunt ? 'minion-oval-taunt' : 'minion-oval'}
        ${hasDivine && !isSilenced ? 'ring-[3px] ring-yellow-300 ring-offset-1 ring-offset-transparent animate-divine-sparkle' : ''}
        ${isFrozen ? 'brightness-75 saturate-50' : ''}
        ${isStealth ? 'opacity-40' : ''}
        ${canAct && isMyMinion ? 'border-[3px] border-green-400 shadow-[0_0_12px_4px_rgba(34,197,94,0.5)] cursor-pointer hover:scale-110 animate-ready-pulse' : ''}
        ${isMyMinion && !canAct && !isFrozen ? 'opacity-80' : ''}
        ${isValidTarget ? 'shadow-[0_0_18px_6px_rgba(34,197,94,0.7)] ring-2 ring-green-400/80 cursor-crosshair scale-105 z-20' : ''}
        ${isSelected ? 'ring-[3px] ring-green-400 shadow-[0_0_24px_8px_rgba(34,197,94,0.6)] -translate-y-2 scale-110 z-30 animate-attacker-pulse' : ''}
        ${isBuffed ? 'animate-buff-pulse' : ''}
        ${animationClass ?? ''}
      `}
    >
      {/* Rarity-colored ring */}
      {rarityColor && def?.rarity !== 'COMMON' && (
        <div className="absolute inset-0 z-[1] pointer-events-none" style={{ borderRadius: '42%', boxShadow: `inset 0 0 0 2px ${rarityColor}40, 0 0 6px 1px ${rarityColor}30` }} />
      )}
      {/* Art fills entire oval — clip to oval shape. Gold variant
           overlays a warm tint + infinite shimmer sweep. */}
      <div className="absolute inset-0 bg-amber-900/80 overflow-hidden" style={{ borderRadius: '42%' }}>
        {minion.cardCode && <CardArt cardCode={minion.cardCode} className="w-full h-full" golden={minion.isGolden} />}
        {minion.isGolden && (
          <>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(252,211,77,0.1) 50%, rgba(245,158,11,0.28) 100%)' }} />
            <div className="absolute -inset-y-4 -left-1/2 w-1/3 pointer-events-none animate-[shimmer_3s_linear_infinite]" style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)' }} />
          </>
        )}
      </div>
      {minion.isGolden && (
        <div className="absolute inset-0 z-[2] pointer-events-none" style={{ borderRadius: '42%', boxShadow: 'inset 0 0 0 3px #fbbf24, 0 0 14px 2px rgba(251,191,36,0.4)' }} />
      )}

      {/* Frozen overlay — animated shimmer */}
      {isFrozen && <div className="absolute inset-0 animate-frost-shimmer z-10" style={{ borderRadius: '42%' }} />}

      {/* Summoning sickness indicator */}
      {hasSummoningSickness && isMyMinion && !isFrozen && (
        <div className="absolute top-0 right-0 z-20 text-[10px] text-yellow-300/80 font-bold">
          z<span className="text-[8px]">z</span><span className="text-[6px]">z</span>
        </div>
      )}

      {/* Silenced X */}
      {isSilenced && (
        <div className="absolute inset-0 flex items-center justify-center z-15" style={{ borderRadius: '42%' }}>
          <span className="text-red-500 text-2xl font-black opacity-60">{'\u2715'}</span>
        </div>
      )}

      {/* Orra Charge counter — blue crystal, top-left */}
      {!isSilenced && def?.keywords.includes('ORRA_CHARGE') && def.orraChargeMax != null && (
        <div className="absolute top-0 left-0 z-20 flex items-center gap-0.5 pointer-events-none">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 border-2 border-cyan-300 text-[10px] font-extrabold text-white shadow-lg animate-pulse">
            {minion.currentOrraCharge ?? 0}/{def.orraChargeMax}
          </div>
        </div>
      )}

      {/* Collar indicator — purple chain icon, top-right */}
      {minion.isCollared && (
        <div className="absolute top-0 right-0 z-20 group/collar">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-800 border-2 border-purple-300 shadow-lg animate-pulse cursor-help">
            <svg viewBox="0 0 16 16" className="w-4 h-4 text-white" fill="currentColor">
              <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="2"/>
              <circle cx="8" cy="8" r="2" fill="currentColor"/>
            </svg>
          </div>
          <div className="absolute top-full mt-1 right-0 hidden group-hover/collar:block bg-stone-900 text-purple-200 text-[10px] px-2 py-1 rounded-lg whitespace-nowrap z-50 border border-purple-500/40 shadow-lg pointer-events-none">
            Collared: Switches sides if it survives combat
          </div>
        </div>
      )}

      {/* Attack circle — bottom-left, inside frame */}
      <div className="absolute bottom-1 left-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-700 border-2 border-yellow-300 text-sm font-extrabold text-white shadow-lg z-20 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
        {minion.currentAttack}
      </div>
      {/* Health circle — bottom-right, inside frame */}
      <div className={`absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-white shadow-lg z-20 border-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]
        ${isDamaged ? 'bg-gradient-to-br from-red-400 to-red-500 border-red-200' : 'bg-gradient-to-br from-red-700 to-red-900 border-red-400'}
      `}>
        {minion.currentHealth}
      </div>
      {/* Deathrattle skull icon — bottom center */}
      {hasDeathrattle && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <svg viewBox="0 0 24 24" className="w-6 h-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" fill="none">
            <circle cx="12" cy="10" r="7" fill="#1a1a1a" stroke="#888" strokeWidth="1.5"/>
            <circle cx="9.5" cy="9" r="1.8" fill="#e8e8e8"/>
            <circle cx="14.5" cy="9" r="1.8" fill="#e8e8e8"/>
            <rect x="10" y="13" width="1.5" height="3" rx="0.5" fill="#e8e8e8"/>
            <rect x="12.5" y="13" width="1.5" height="3" rx="0.5" fill="#e8e8e8"/>
            <rect x="5" y="17" width="14" height="2.5" rx="1" fill="#1a1a1a" stroke="#888" strokeWidth="1"/>
            <rect x="7" y="16" width="2" height="5" rx="0.5" fill="#e8e8e8"/>
            <rect x="11" y="16" width="2" height="5" rx="0.5" fill="#e8e8e8"/>
            <rect x="15" y="16" width="2" height="5" rx="0.5" fill="#e8e8e8"/>
          </svg>
        </div>
      )}

      {/* Name + tribe label — inside frame, above attack/health */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center w-full px-2">
        <div className="text-[9px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] leading-tight truncate">
          {def?.name}
        </div>
        {def?.minionType && (
          <span className="text-[7px] font-bold text-amber-300/90 bg-black/50 px-1 py-px rounded-sm">
            {def.minionType}
          </span>
        )}
      </div>

      {/* Hover tooltip */}
      {showTooltip && def && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-50 pointer-events-none">
          <div className="bg-stone-900/95 border border-amber-700/40 rounded-lg px-3 py-2 shadow-2xl min-w-[160px] max-w-[200px]">
            <div className="text-amber-100 font-bold text-xs mb-0.5">{def.name}</div>
            <div className="text-[9px] text-gray-500 mb-1">
              {minion.currentAttack}/{minion.currentHealth}
              {isDamaged && <span className="text-red-400 ml-1">(damaged)</span>}
              {minion.currentAttack !== def.attack && <span className="text-green-400 ml-1">(buffed)</span>}
            </div>
            {def.text && <p className="text-gray-300 text-[9px] leading-snug mb-1">{def.text}</p>}
            <div className="flex flex-wrap gap-1">
              {hasTaunt && <span className="text-[8px] bg-stone-700 text-amber-300 px-1 rounded">Taunt</span>}
              {hasDivine && <span className="text-[8px] bg-stone-700 text-yellow-300 px-1 rounded">Divine Shield</span>}
              {isFrozen && <span className="text-[8px] bg-stone-700 text-blue-300 px-1 rounded">Frozen</span>}
              {isStealth && <span className="text-[8px] bg-stone-700 text-gray-300 px-1 rounded">Stealth</span>}
              {isSilenced && <span className="text-[8px] bg-stone-700 text-red-300 px-1 rounded">Silenced</span>}
              {def.minionType && <span className="text-[8px] bg-stone-700 text-amber-200 px-1 rounded">{def.minionType}</span>}
            </div>
          </div>
        </div>
      )}
    </button>
  );
}

// ─── Location Card on Board ───
function BoardLocationCard({
  location,
  isMyLocation,
  canActivate,
  isSelected,
  onClick,
}: {
  location: BoardLocation;
  isMyLocation: boolean;
  canActivate: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const def = getCard(location.cardCode);
  const onCooldown = location.cooldownRemaining > 0;
  const activated = location.activatedThisTurn;

  return (
    <button
      onClick={onClick}
      className={`relative w-[7rem] h-[8rem] select-none transition-all rounded-xl border-2 overflow-hidden
        ${canActivate ? 'shadow-[0_0_16px_4px_rgba(59,130,246,0.6)] cursor-pointer hover:scale-110 ring-[2px] ring-blue-400/80 border-blue-500' : ''}
        ${onCooldown || activated ? 'opacity-50 border-stone-600' : !canActivate ? 'border-amber-700' : ''}
        ${isSelected ? 'ring-[3px] ring-green-400 shadow-[0_0_24px_8px_rgba(34,197,94,0.6)] -translate-y-2 scale-110 z-30' : ''}
      `}
      style={{ background: 'linear-gradient(to bottom, #2a3a2a, #1a2a1a)' }}
    >
      {/* Art */}
      <div className="absolute inset-0 overflow-hidden rounded-xl opacity-60">
        {location.cardCode && <CardArt cardCode={location.cardCode} className="w-full h-full" />}
      </div>

      {/* Building icon overlay */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-400/80" fill="currentColor">
          <path d="M12 2L2 7v2h20V7L12 2zm0 2.5L18 7H6l6-2.5zM4 11v9h3v-5h2v5h2v-5h2v5h2v-5h2v5h3v-9H4z" />
        </svg>
      </div>

      {/* Name */}
      <div className="absolute bottom-7 left-0 right-0 z-10 text-center">
        <span className="text-[8px] font-bold text-amber-200/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] px-1">
          {def?.name}
        </span>
      </div>

      {/* Durability counter */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 border-2 border-emerald-300 text-sm font-extrabold text-white shadow-lg z-20">
        {location.durability}
      </div>

      {/* Cooldown overlay */}
      {onCooldown && (
        <div className="absolute inset-0 flex items-center justify-center z-15 rounded-xl bg-black/30">
          <span className="text-[10px] text-blue-300 font-bold">COOLDOWN</span>
        </div>
      )}

      {/* Activated overlay */}
      {activated && !onCooldown && (
        <div className="absolute inset-0 flex items-center justify-center z-15 rounded-xl bg-black/20">
          <span className="text-[10px] text-stone-400 font-bold">USED</span>
        </div>
      )}
    </button>
  );
}

// ─── Hero Portrait (with character SVG art) ───
function HeroPortrait({
  heroClass,
  health,
  maxHealth,
  armor,
  weapon,
  heroPowerUsed,
  isMyHero,
  isMyTurn,
  mana,
  maxMana,
  canUseHeroPower,
  canHeroAttack,
  isValidTarget,
  onHeroPowerClick,
  onHeroClick,
  heroDamage,
  secretCount,
  mySecretCodes,
  heroPowerFlash,
  entityId,
  heroPowerUpgraded,
  upgradeProgress,
  onHeroPointerDown,
  onHeroPowerPointerDown,
  weaponEquipFlash,
  goldenHero,
}: {
  heroClass: HeroClass;
  health: number;
  maxHealth: number;
  armor: number;
  weapon: Weapon | null;
  heroPowerUsed: boolean;
  isMyHero: boolean;
  isMyTurn: boolean;
  mana: number;
  maxMana: number;
  canUseHeroPower: boolean;
  canHeroAttack?: boolean;
  isValidTarget: boolean;
  onHeroPowerClick: () => void;
  onHeroClick: (e?: React.MouseEvent) => void;
  heroDamage?: boolean;
  secretCount?: number;
  mySecretCodes?: string[];
  heroPowerFlash?: boolean;
  entityId?: string;
  heroPowerUpgraded?: boolean;
  upgradeProgress?: number;
  onHeroPointerDown?: (e: React.PointerEvent) => void;
  onHeroPowerPointerDown?: (e: React.PointerEvent) => void;
  weaponEquipFlash?: boolean;
  goldenHero?: boolean;
}) {
  const borderClass = CLASS_BORDER[heroClass];
  const bgClass = CLASS_BG[heroClass];
  const isDamaged = health < maxHealth;

  return (
    <div className="flex items-center gap-2 md:gap-3">
      {/* Secrets (shown as ? badges — own secrets show name on hover, opponent's enlarge on hover) */}
      {secretCount != null && secretCount > 0 && (
        <div className="flex gap-1.5">
          {Array.from({ length: secretCount }).map((_, i) => {
            const secretCardCode = isMyHero && mySecretCodes ? mySecretCodes[i] : undefined;
            const secretDef = secretCardCode ? getCard(secretCardCode) : undefined;
            return (
              <div key={i} className="relative group">
                {isMyHero && secretDef ? (
                  /* Own secret — show card-like display */
                  <div className="w-12 h-14 md:w-14 md:h-16 rounded-lg border-2 border-amber-400 bg-stone-900 overflow-hidden shadow-lg shadow-amber-500/20 relative cursor-default">
                    <CardArt cardCode={secretCardCode!} className="w-full h-full opacity-70" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-amber-500 border border-amber-300 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-white">?</span>
                    </div>
                    <div className="absolute bottom-0.5 left-0 right-0 text-center">
                      <span className="text-[7px] font-bold text-amber-200 drop-shadow-md">{secretDef.name}</span>
                    </div>
                    {/* Full card on hover */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-50 pointer-events-none">
                      <div className="bg-stone-900/95 border border-amber-600/50 rounded-lg p-2 shadow-2xl min-w-[150px]">
                        <div className="text-amber-200 font-bold text-xs">{secretDef.name}</div>
                        <div className="text-[9px] text-amber-400/60 mt-0.5">{secretDef.manaCost} Mana Secret</div>
                        <div className="text-[9px] text-gray-300 mt-1">{secretDef.text}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Opponent secret — mystery "?" */
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 border-2 border-amber-300 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-amber-500/30 animate-pulse">
                    ?
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Weapon (left side) — Hearthstone-style circular with art */}
      {/* key={weapon.cardCode} forces a remount when the equipped weapon
          changes, so the slide-in animation re-fires. Without the key,
          replacing one weapon with another would just snap the art. */}
      {weapon && (
        <div className={`relative group/weapon ${weaponEquipFlash ? 'animate-weapon-slide-in' : ''}`} key={weapon.cardCode}>
          <div className={`relative h-16 w-16 md:h-24 md:w-24 rounded-full overflow-hidden border-[3px] bg-stone-900
            ${canHeroAttack ? 'border-green-400 shadow-[0_0_16px_4px_rgba(34,197,94,0.6)]' : 'border-stone-500'}
            ${weaponEquipFlash ? 'animate-weapon-equip' : ''}`}
            style={{ boxShadow: canHeroAttack ? undefined : 'inset 0 2px 8px rgba(0,0,0,0.6)' }}
          >
            <CardArt cardCode={weapon.cardCode} className="absolute inset-0 w-full h-full object-cover" square />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/15" />
          </div>
          {/* Attack badge — outside overflow, bottom-left */}
          <div className="absolute -bottom-1 -left-1 w-7 h-7 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 border-2 border-amber-300 flex items-center justify-center shadow-lg z-20">
            <span className="text-white font-extrabold text-xs md:text-sm drop-shadow-md">{weapon.currentAttack}</span>
          </div>
          {/* Durability badge — outside overflow, bottom-right */}
          <div className="absolute -bottom-1 -right-1 w-7 h-7 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-stone-400 to-stone-600 border-2 border-stone-300 flex items-center justify-center shadow-lg z-20">
            <span className="text-white font-extrabold text-xs md:text-sm drop-shadow-md">{weapon.durability}</span>
          </div>
          {/* Hover preview: blown-up full card (same pattern as action
               history hover + collection hover). pointer-events-none so
               it never blocks clicks on the weapon circle. */}
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 hidden group-hover/weapon:block z-50 pointer-events-none"
            style={{ transform: 'translateX(-50%) scale(1.3)', transformOrigin: 'bottom center' }}
          >
            <CardComponent cardCode={weapon.cardCode} />
          </div>
        </div>
      )}

      {/* Hero circle with character portrait */}
      {/* When health drops to 5 or below, the portrait wears
          animate-health-critical (a 1s infinite red glow). The hit-flash
          and shake still take precedence the moment damage actually
          lands. Existing CSS keyframe was unused before today. */}
      <div className="relative">
        <button
          onClick={onHeroClick}
          onPointerDown={onHeroPointerDown}
          data-entity-id={entityId}
          className={`relative flex h-24 w-20 md:h-36 md:w-28 items-center justify-center rounded-t-full rounded-b-lg border-4 touch-none ${borderClass} ${bgClass} transition-all overflow-hidden
            ${isValidTarget ? 'shadow-[0_0_16px_4px_rgba(34,197,94,0.6)] cursor-crosshair' : ''}
            ${canHeroAttack ? 'shadow-[0_0_20px_6px_rgba(34,197,94,0.7)] ring-[3px] ring-green-400/80 cursor-pointer' : ''}
            ${!isValidTarget && !canHeroAttack && !isMyHero ? 'cursor-default' : ''}
            ${heroDamage ? 'animate-hero-damage animate-damage-shake' : (health <= 5 && health > 0 ? 'animate-health-critical' : '')}
          `}
        >
          {/* Character portrait. Golden hero variant overlays a warm
               tint + infinite shimmer sweep on the portrait image and
               puts an inset gold ring around the whole button via a
               sibling pointer-events-none div. */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            {HERO_PORTRAIT_PNGS[heroClass] ? (
              <img src={HERO_PORTRAIT_PNGS[heroClass]} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full opacity-80">{HERO_PORTRAIT_SVG[heroClass]}</div>
            )}
            {goldenHero && (
              <>
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.3) 0%, rgba(252,211,77,0.14) 50%, rgba(245,158,11,0.3) 100%)' }} />
                <div className="absolute -inset-y-6 -left-1/2 w-1/3 pointer-events-none animate-[shimmer_3s_linear_infinite]" style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.65) 50%, transparent 70%)' }} />
              </>
            )}
          </div>
          {goldenHero && (
            <div className="absolute inset-0 pointer-events-none rounded-t-full rounded-b-lg" style={{ boxShadow: 'inset 0 0 0 3px #fbbf24, 0 0 16px 2px rgba(251,191,36,0.5)' }} />
          )}
          {/* HP overlay at bottom */}
          <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 text-xl md:text-3xl font-extrabold z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${isDamaged ? 'text-red-400' : 'text-white'}`}>
            {health}
          </span>
        </button>
        {/* Armor badge — outside button so it's not clipped */}
        {armor > 0 && (
          <div className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gray-300 to-gray-500 border-2 border-gray-200 text-xs font-extrabold text-gray-800 z-20 shadow-md pointer-events-none">
            {armor}
          </div>
        )}
      </div>


      {/* Hero Power */}
      <div className="relative group/hp">
        <button
          onClick={onHeroPowerClick}
          onPointerDown={onHeroPowerPointerDown}
          disabled={!canUseHeroPower}
          aria-label={`Hero Power: ${HERO_POWER_DESC[heroClass]}`}
          className={`relative flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full border-[3px] transition-all touch-none
            ${heroPowerUpgraded
              ? (canUseHeroPower
                ? 'border-amber-300 bg-gradient-to-br from-amber-700/60 to-amber-500/40 hover:from-amber-600/80 hover:to-amber-400/60 hover:scale-110 cursor-pointer shadow-[0_0_12px_2px_rgba(245,158,11,0.5)]'
                : 'border-amber-600 bg-amber-800/40 opacity-50 cursor-not-allowed')
              : (canUseHeroPower
                ? 'border-amber-500 bg-amber-900/40 hover:bg-amber-800/60 hover:scale-110 cursor-pointer'
                : 'border-stone-500 bg-stone-700/60 opacity-60 cursor-not-allowed')}
            ${heroPowerFlash ? 'animate-hero-power-flash' : (canUseHeroPower ? 'animate-hero-power-ready' : '')}
          `}
        >
          <span className={`pointer-events-none ${canUseHeroPower ? (heroPowerUpgraded ? 'text-amber-200' : 'text-amber-300') : 'text-stone-500'}`}>
            {HERO_POWER_SVG[heroClass]}
          </span>
          <span className="pointer-events-none absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow">
            {HERO_POWER_COST}
          </span>
          {goldenHero && (
            <>
              <div className="absolute inset-0 rounded-full pointer-events-none overflow-hidden">
                <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.3) 0%, rgba(252,211,77,0.1) 50%, rgba(245,158,11,0.3) 100%)' }} />
                <div className="absolute -inset-y-4 -left-1/2 w-1/3 animate-[shimmer_3s_linear_infinite]" style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.65) 50%, transparent 70%)' }} />
              </div>
              <div className="absolute inset-0 rounded-full pointer-events-none" style={{ boxShadow: 'inset 0 0 0 2px #fbbf24, 0 0 12px 2px rgba(251,191,36,0.5)' }} />
            </>
          )}
          {/* No upgrade badges */}
        </button>
        {/* Styled tooltip on hover */}
        <div className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover/hp:block text-[10px] px-2.5 py-1 rounded-lg whitespace-normal text-center z-50 shadow-lg pointer-events-none max-w-[180px]
          ${heroPowerUpgraded
            ? 'bg-gradient-to-b from-amber-900 to-stone-900 text-amber-100 border border-amber-400/60 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
            : 'bg-stone-900 text-amber-200 border border-amber-600/40'}`}>
          {HERO_POWER_DESC[heroClass]}
        </div>
      </div>
    </div>
  );
}

// ─── Hand Card ───
function HandCard({
  card,
  canPlay,
  isSelected,
  isDragging,
  isNew,
  comboActive,
  onClick,
  onPointerDown,
}: {
  card: ClientCardInstance;
  canPlay: boolean;
  isSelected: boolean;
  isDragging?: boolean;
  isNew?: boolean;
  comboActive?: boolean;
  onClick: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const def = getCard(card.cardCode);
  const isComboCard = !!def && comboActive && def.keywords.includes('COMBO') && canPlay;

  // One-shot pop-in for the combo ring: fires only on the leading edge
  // of isComboCard (i.e. the moment combo becomes active for this card,
  // not every re-render). The 'combo-ring-pop' class self-clears after
  // the keyframe finishes via setTimeout to allow re-trigger next combo.
  const wasCombo = useRef(false);
  const [comboPopping, setComboPopping] = useState(false);
  useEffect(() => {
    if (isComboCard && !wasCombo.current) {
      setComboPopping(true);
      const t = setTimeout(() => setComboPopping(false), 360);
      wasCombo.current = true;
      return () => clearTimeout(t);
    }
    if (!isComboCard && wasCombo.current) {
      wasCombo.current = false;
    }
  }, [isComboCard]);

  if (!def) return null;
  const classColor = CLASS_COLORS[def.heroClass] ?? '#d4a520';
  const rarityColor = RARITY_COLORS[def.rarity];
  const isLocation = def.type === 'LOCATION';

  return (
    <button
      onClick={onClick}
      onPointerDown={onPointerDown}
      // duration-300 ease-out makes the select lift / hover lift smooth
      // instead of snapping. Tailwind's default transition-all is 150ms
      // ease which is too fast to read for a +6 translate + 1.1 scale.
      className={`group relative flex h-44 w-[7.5rem] flex-shrink-0 flex-col items-center rounded-xl border-2 p-1 transition-all duration-300 ease-out overflow-hidden card-frame touch-none
        ${isComboCard
          ? 'ring-2 ring-yellow-400/80 shadow-[0_0_16px_4px_rgba(234,179,8,0.5)] border-yellow-400'
          : ''}
        ${comboPopping ? 'animate-combo-ring-pop' : ''}
        ${isSelected
          ? 'border-green-400 -translate-y-6 scale-110 z-20 shadow-[0_0_20px_4px_rgba(34,197,94,0.5)]'
          : canPlay
            ? 'hover:-translate-y-4 hover:scale-105 hover:z-10 cursor-pointer hover:shadow-[0_0_16px_rgba(245,158,11,0.3)] ring-2 ring-green-400/60 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
            : 'border-stone-500 opacity-60 cursor-not-allowed'}
        ${isDragging ? 'dragging-card' : ''}
        ${isNew ? 'animate-card-draw-in' : ''}
      `}
      style={{
        borderTopColor: classColor,
        borderTopWidth: '3px',
        borderColor: isSelected ? undefined : (canPlay ? rarityColor + '90' : undefined),
      }}
    >
      {/* Mana gem */}
      <div className="absolute -left-1.5 -top-1.5 z-10"><ManaGem value={def.manaCost} size={30} /></div>
      {/* Card Art — larger. Gold overlay + shimmer for foil copies. */}
      <div className={`relative w-full h-24 mt-3 rounded overflow-hidden bg-stone-600/60 flex-shrink-0 ${card.isGolden ? 'shadow-[inset_0_0_0_2px_rgba(251,191,36,0.8)]' : ''}`}>
        <CardArt cardCode={card.cardCode!} className="w-full h-full" golden={card.isGolden} />
        {card.isGolden && (
          <>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.22) 0%, rgba(252,211,77,0.1) 50%, rgba(245,158,11,0.24) 100%)' }} />
            <div className="absolute -inset-y-4 -left-1/2 w-1/3 pointer-events-none animate-[shimmer_3s_linear_infinite]" style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)' }} />
          </>
        )}
      </div>
      {/* Rarity gem — diamond shape centered between art and name */}
      <div className="flex justify-center -mt-1.5 z-10">
        <div
          className="w-3.5 h-3.5 rotate-45 border border-white/30"
          style={{ backgroundColor: rarityColor, boxShadow: `0 0 8px 2px ${rarityColor}90, inset 0 1px 2px rgba(255,255,255,0.3)` }}
        />
      </div>
      {/* Name banner */}
      <div className="w-full card-name-banner px-1 py-0.5 mt-0.5">
        <span className={`font-bold text-amber-100 leading-tight w-full text-center block ${
          def.name.length > 18 ? 'text-[8px]' : def.name.length > 12 ? 'text-[9px]' : 'text-[10px]'
        }`}>
          {def.name}
        </span>
      </div>
      {/* Text area with subtle inner frame */}
      <div className="w-full px-1 flex-1 min-h-0 overflow-hidden bg-black/10 rounded-sm mt-0.5">
        <span className="text-[7px] text-amber-200/60 text-center leading-tight line-clamp-3 block px-0.5">
          {def.text}
        </span>
      </div>
      {/* Stats */}
      {def.type === 'MINION' && (
        <div className="flex w-full justify-between items-center px-0.5 shrink-0 mt-0.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-700 border border-yellow-300 text-xs font-extrabold text-white shadow">
            {def.attack}
          </span>
          {def.minionType && (
            <span className="text-[7px] font-bold text-amber-300/70">{def.minionType}</span>
          )}
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-800 border border-red-400 text-xs font-extrabold text-white shadow">
            {def.health}
          </span>
        </div>
      )}
      {def.type === 'WEAPON' && (
        <div className="flex w-full justify-between px-0.5 shrink-0 mt-0.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-700 border border-yellow-300 text-xs font-extrabold text-white shadow">
            {def.attack}
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 border border-emerald-300 text-xs font-extrabold text-white shadow">
            {def.health}
          </span>
        </div>
      )}
      {isLocation && (
        <div className="flex w-full justify-center px-0.5 shrink-0 mt-0.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 border border-emerald-300 text-xs font-extrabold text-white shadow">
            {def.health}
          </span>
        </div>
      )}
    </button>
  );
}

// ─── Card Backs (opponent hand) ───
function OpponentHand({ count, cardBackId }: { count: number; cardBackId?: string }) {
  const cb = CARD_BACK_STYLES[cardBackId ?? 'default'] ?? CARD_BACK_STYLES['default'];
  return (
    <div className="flex items-center justify-center gap-0.5 md:gap-1">
      {Array.from({ length: count }).map((_, i) => (
        cb?.type === 'image' ? (
          <div key={i} className="h-14 w-10 md:h-24 md:w-16 rounded-lg border-2 border-amber-700 overflow-hidden relative shadow-md transition-transform duration-200 hover:scale-110 hover:-translate-y-2">
            <img src={cb.value} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
        ) : (
          <div
            key={i}
            className={`h-14 w-10 md:h-24 md:w-16 rounded-lg border-2 ${cb?.borderColor ?? 'border-amber-700'} shadow-md transition-transform duration-200 hover:scale-110 hover:-translate-y-2`}
            style={{ background: cb?.value ?? 'linear-gradient(to bottom, #92400e, #1c0f00)' }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full border border-white/15 bg-white/5" />
            </div>
          </div>
        )
      ))}
    </div>
  );
}

// ─── Orra Crystals ───
function ManaCrystals({ current, max }: { current: number; max: number }) {
  const prevMana = useRef(current);
  const prevMax = useRef(max);
  const [drainingIndices, setDrainingIndices] = useState<Set<number>>(new Set());
  // Indices that just became filled (turn refresh OR a new max-mana crystal
  // arrived). Cleared after the cascade finishes so the same slot can
  // animate again next turn.
  const [fillingIndices, setFillingIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (current < prevMana.current) {
      // Crystals at indices [current, prevMana) are draining
      const draining = new Set<number>();
      for (let i = current; i < prevMana.current; i++) draining.add(i);
      setDrainingIndices(draining);
      const timer = setTimeout(() => setDrainingIndices(new Set()), 400);
      prevMana.current = current;
      prevMax.current = max;
      return () => clearTimeout(timer);
    }
    if (current > prevMana.current || max > prevMax.current) {
      // Crystals at indices [prevMana, current) just refreshed.
      // The cascade duration matches the longest per-crystal delay
      // we apply in the render below (max ~10 crystals * 60ms + 550ms anim).
      const filling = new Set<number>();
      for (let i = prevMana.current; i < current; i++) filling.add(i);
      // If max grew, also flag the brand-new slots so they pop in.
      for (let i = prevMax.current; i < max; i++) filling.add(i);
      setFillingIndices(filling);
      const timer = setTimeout(() => setFillingIndices(new Set()), 1200);
      prevMana.current = current;
      prevMax.current = max;
      return () => clearTimeout(timer);
    }
    prevMana.current = current;
    prevMax.current = max;
  }, [current, max]);

  return (
    <div className="flex items-center gap-0.5 md:gap-1">
      {Array.from({ length: max }).map((_, i) => {
        const isFilling = fillingIndices.has(i);
        // Stagger the cascade so crystals refill left-to-right like a
        // wave instead of all popping simultaneously. 60ms per crystal
        // is just enough to read the order without slowing the game.
        const fillDelay = isFilling ? `${i * 60}ms` : undefined;
        return (
          <div
            key={i}
            className={`h-3 w-3 md:h-4 md:w-4 rounded-full border transition-colors
              ${drainingIndices.has(i) ? 'animate-crystal-drain border-blue-400 bg-blue-500' :
                isFilling ? 'animate-crystal-fill border-blue-400 bg-blue-500' :
                i < current
                ? 'border-blue-400 bg-blue-500 shadow-[0_0_6px_1px_rgba(59,130,246,0.5)]'
                : 'border-stone-600 bg-stone-800'}
            `}
            style={fillDelay ? { animationDelay: fillDelay } : undefined}
          />
        );
      })}
      <span className="ml-1 md:ml-2 text-xs md:text-sm font-bold text-blue-400">
        {current}/{max}
      </span>
    </div>
  );
}

// ─── Deck Pile + Graveyard (Hearthstone-style) ───
function DeckPile({ count, graveyardCount }: { count: number; graveyardCount: number }) {
  const [showGraveyard, setShowGraveyard] = useState(false);
  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Deck */}
      <div
        className="relative w-16 h-20 rounded-lg border-2 border-amber-700 bg-gradient-to-br from-amber-950 via-stone-900 to-amber-950 flex items-center justify-center cursor-default group"
        title={`${count} cards remaining`}
      >
        {/* Stacked card visual */}
        {count > 0 && (
          <>
            <div className="absolute inset-0.5 rounded-md border border-stone-700 opacity-30" />
            {count > 5 && <div className="absolute -top-0.5 -left-0.5 w-16 h-20 rounded-lg border border-stone-700 opacity-20" />}
            {count > 15 && <div className="absolute -top-1 -left-1 w-16 h-20 rounded-lg border border-stone-700 opacity-10" />}
          </>
        )}
        <span className={`text-sm font-bold z-10 ${count > 0 ? 'text-stone-300' : 'text-stone-700'}`}>
          {count}
        </span>
        {/* Hover tooltip */}
        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-stone-900 text-stone-300 text-[10px] px-2 py-1 rounded whitespace-nowrap z-50 border border-stone-700">
          {count} cards in deck
        </div>
      </div>
      {/* Graveyard */}
      {graveyardCount > 0 && (
        <button
          onClick={() => setShowGraveyard(!showGraveyard)}
          className="relative w-10 h-5 rounded border border-stone-700 bg-stone-900/80 flex items-center justify-center cursor-pointer hover:border-stone-500 transition-colors group"
          title={`${graveyardCount} cards in graveyard`}
        >
          <span className="text-[9px] text-stone-500 font-medium">{graveyardCount}</span>
          <div className="absolute bottom-full mb-1 hidden group-hover:block bg-stone-900 text-stone-300 text-[10px] px-2 py-1 rounded whitespace-nowrap z-50 border border-stone-700">
            {graveyardCount} cards discarded
          </div>
        </button>
      )}
    </div>
  );
}

// ─── Attack Arrow Overlay ───
function AttackArrow({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  return (
    <svg className="pointer-events-none fixed inset-0 z-40" style={{ width: '100vw', height: '100vh' }}>
      <defs>
        <marker id="arrowhead" markerWidth="14" markerHeight="10" refX="14" refY="5" orient="auto">
          <polygon points="0 0, 14 5, 0 10" fill="#ef4444" />
        </marker>
        <filter id="arrow-shadow">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#ef4444" floodOpacity="0.6" />
        </filter>
      </defs>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="#ef4444"
        strokeWidth="4"
        strokeDasharray="10 5"
        markerEnd="url(#arrowhead)"
        filter="url(#arrow-shadow)"
        className="animate-arrow-march"
      />
    </svg>
  );
}

// ═══════════════════════════════════════════
// ─── Main GameBoard Component ───
// ═══════════════════════════════════════════

export default function GameBoard({
  gameState: gs,
  opponentHovering,
  opponentEmote,
  onLeaveGame,
  uid,
  postGameRewards,
}: GameBoardProps) {
  const actions = useGameActions();
  const cardScale = useCardScale();
  const isMobile = cardScale < 1;

  // ─── State ───
  const [targeting, setTargeting] = useState<TargetingMode>({ type: 'none' });
  const [selectedHandCard, setSelectedHandCard] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [myEmote, setMyEmote] = useState<string | null>(null);
  // Mute toggle — clicking the opponent's hero (outside of an attack or
  // target-resolution context) pops a small bubble with a Mute/Unmute
  // button.
  const [opponentMuted, setOpponentMuted] = useState(false);
  const [showMuteBubble, setShowMuteBubble] = useState(false);
  const emoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-close emote popup after 3 seconds
  useEffect(() => {
    if (emoteOpen) {
      emoteTimerRef.current = setTimeout(() => setEmoteOpen(false), 3000);
      return () => { if (emoteTimerRef.current) clearTimeout(emoteTimerRef.current); };
    }
  }, [emoteOpen]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [attackerPos, setAttackerPos] = useState<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // ─── State diff (animations, floating numbers, deaths, etc.) ───
  const diff = useStateDiff(gs);
  const [entranceIds, setEntranceIds] = useState<Set<string>>(new Set());
  const [damageIds, setDamageIds] = useState<Set<string>>(new Set());
  const [lungeId, setLungeId] = useState<string | null>(null);
  const [defenderLungeId, setDefenderLungeId] = useState<string | null>(null);
  const [myHeroDamage, setMyHeroDamage] = useState(false);
  const [opHeroDamage, setOpHeroDamage] = useState(false);
  const [newCardIds, setNewCardIds] = useState<Set<string>>(new Set());
  const [buffedIds, setBuffedIds] = useState<Set<string>>(new Set());
  const [activeSpell, setActiveSpell] = useState<{ cardCode: string; targetId: string } | null>(null);
  const [heroPowerFlash, setHeroPowerFlash] = useState(false);
  const [opHeroPowerFlash, setOpHeroPowerFlash] = useState(false);
  // Transient ghost card that flies from a drop point toward its target
  // board slot to bridge the visual gap between "released the drag" and
  // "minion appeared on the board". Cleared after the keyframe finishes.
  const [dropSlideGhost, setDropSlideGhost] = useState<{
    cardCode: string;
    fromX: number;
    fromY: number;
    dx: number;
    dy: number;
    key: number;
  } | null>(null);
  // Card showcase: when the opponent plays a card, briefly show it
  // enlarged at center-screen so the player can read what just
  // happened. Driven by detecting new PLAY log entries from the
  // opponent (see useEffect below). Auto-clears after the
  // card-showcase keyframe finishes (~1.6s).
  const [opponentCardShowcase, setOpponentCardShowcase] = useState<{
    cardCode: string;
    key: number;
  } | null>(null);
  const prevLogIdRef = useRef<number>(-1);
  const prevOpHeroPowerUsed = useRef(gs.opponent.heroPowerUsed);
  const [weaponEquipFlash, setWeaponEquipFlash] = useState(false);
  const prevWeaponRef = useRef(gs.myWeapon);

  // ─── Pointer drag state (replaces HTML5 drag-and-drop) ───
  const [ptrDrag, setPtrDrag] = useState<PointerDragState | null>(null);
  const [dropZoneActive, setDropZoneActive] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const justDraggedRef = useRef(false);
  const pendingPlayRef = useRef<Set<string>>(new Set());

  // Derived from ptrDrag for easier access
  const draggingCardId = ptrDrag?.info.kind === 'hand-card' && ptrDrag.activated ? ptrDrag.info.cardInstanceId : null;
  const draggingCardType = ptrDrag?.info.kind === 'hand-card' && ptrDrag.activated ? ptrDrag.info.cardType : null;
  const draggingTargetType = ptrDrag?.info.kind === 'hand-card' && ptrDrag.activated ? ptrDrag.info.targetType : null;
  const draggingAttackerId = ptrDrag?.info.kind === 'attack' && ptrDrag.activated ? ptrDrag.info.attackerInstanceId : null;
  const draggingHeroPower = ptrDrag?.info.kind === 'hero-power' && ptrDrag.activated;

  // ─── Card hover preview state ───
  const [hoveredCard, setHoveredCard] = useState<{ cardCode: string; x: number; y: number } | null>(null);

  const isSpectator = gs.isSpectator === true;
  const isMyTurn = !isSpectator && gs.currentPlayerIndex === gs.myPlayerIndex;
  const isPlaying = gs.phase === 'PLAYING';

  // Clear pending play guard when hand changes or pending interaction arrives
  useEffect(() => { pendingPlayRef.current.clear(); }, [gs.myHand]);
  useEffect(() => { if (gs.pendingInteraction) pendingPlayRef.current.clear(); }, [gs.pendingInteraction]);

  // ─── Stuck-state recovery (refresh-to-click bug fix) ───
  // The user reported that sometimes they have to refresh the page to
  // make clicks work again. The cause is stale targeting state: a
  // play-card targeting flow gets started but the underlying card
  // disappears from gs.myHand (server-side cancel, opponent action,
  // disconnect+reconnect), and `targeting` stays in 'play-card' mode
  // forever, intercepting every click. Same for 'attack' targeting
  // when the attacker is no longer on the board.
  //
  // These effects watch the relevant gs slice and force targeting back
  // to 'none' if the entity it points at is gone. Cheap defensive
  // cleanup, runs on every state update.
  useEffect(() => {
    if (targeting.type === 'play-card') {
      const stillInHand = gs.myHand.some(c => c.instanceId === targeting.cardInstanceId);
      if (!stillInHand) setTargeting({ type: 'none' });
    }
  }, [targeting, gs.myHand]);

  useEffect(() => {
    if (targeting.type === 'attack') {
      const isHero = targeting.attackerInstanceId.startsWith('hero-');
      const stillOnBoard = isHero || gs.myBoard.some(m => m.instanceId === targeting.attackerInstanceId);
      if (!stillOnBoard) {
        setTargeting({ type: 'none' });
        setAttackerPos(null);
      }
    }
  }, [targeting, gs.myBoard]);

  // If the active turn flips to the opponent mid-targeting, clear it.
  useEffect(() => {
    if (gs.currentPlayerIndex !== gs.myPlayerIndex && targeting.type !== 'none') {
      setTargeting({ type: 'none' });
      setAttackerPos(null);
      setSelectedHandCard(null);
    }
  }, [gs.currentPlayerIndex, gs.myPlayerIndex, targeting.type]);

  const isGameOver = gs.winner !== null;
  const myBoard = gs.myBoard;
  const opBoard = gs.opponent.board;

  // ─── Turn banner (remount on turn change) ───
  const [turnBannerKey, setTurnBannerKey] = useState(0);
  const prevTurnRef = useRef(gs.turnNumber);
  useEffect(() => {
    if (gs.turnNumber !== prevTurnRef.current) {
      prevTurnRef.current = gs.turnNumber;
      setTurnBannerKey(k => k + 1);
    }
  }, [gs.turnNumber]);

  // ─── Opponent card showcase (detect new PLAY log entries) ───
  // The server emits one PLAY log entry per card the opponent plays,
  // tagged with cardCode and the opponent's playerIndex. We watch
  // gs.log for new entries since the last render and queue a center-
  // screen showcase for the most recent one. Spectators see both
  // sides' plays; the opponent-vs-self check is skipped in that case
  // since both players are "opponents" from the spectator's view.
  useEffect(() => {
    if (!gs.log || gs.log.length === 0) return;
    // Initialize on first render so we don't replay the entire game
    // log as a flurry of showcases.
    if (prevLogIdRef.current === -1) {
      prevLogIdRef.current = gs.log[gs.log.length - 1].id;
      return;
    }
    let mostRecentPlay: { cardCode: string; id: number } | null = null;
    for (const entry of gs.log) {
      if (entry.id <= prevLogIdRef.current) continue;
      const isOpponentPlay =
        entry.category === 'PLAY' &&
        entry.cardCode &&
        entry.playerIndex !== null &&
        entry.playerIndex !== gs.myPlayerIndex;
      if (isOpponentPlay) {
        mostRecentPlay = { cardCode: entry.cardCode!, id: entry.id };
      }
    }
    prevLogIdRef.current = gs.log[gs.log.length - 1].id;
    if (mostRecentPlay) {
      setOpponentCardShowcase({ cardCode: mostRecentPlay.cardCode, key: Date.now() });
      // 1700ms = card-showcase keyframe duration (1.6s) + a 100ms tail
      // to avoid clipping the trailing fade.
      const t = setTimeout(() => setOpponentCardShowcase(null), 1700);
      return () => clearTimeout(t);
    }
  }, [gs.log, gs.myPlayerIndex]);

  // ─── Turn timer warning (last 20 seconds) ───
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!gs.turnDeadline || isGameOver) {
      setTimeLeft(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((gs.turnDeadline! - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [gs.turnDeadline, isGameOver]);

  // ─── Derive animation state from diff ───
  useEffect(() => {
    if (diff.entranceIds.size > 0) {
      setEntranceIds(diff.entranceIds);
      setTimeout(() => setEntranceIds(new Set()), 400);
    }
    if (diff.damageIds.size > 0) {
      setDamageIds(diff.damageIds);
      setTimeout(() => setDamageIds(new Set()), 400);
    }
    if (diff.myHeroDamaged) {
      setMyHeroDamage(true);
      setTimeout(() => setMyHeroDamage(false), 400);
    }
    if (diff.opHeroDamaged) {
      setOpHeroDamage(true);
      setTimeout(() => setOpHeroDamage(false), 400);
    }
    if (diff.newCardIds.size > 0) {
      setNewCardIds(diff.newCardIds);
      setTimeout(() => setNewCardIds(new Set()), 600);
    }
    if (diff.newlyBuffedIds.size > 0) {
      setBuffedIds(diff.newlyBuffedIds);
      setTimeout(() => setBuffedIds(new Set()), 500);
    }
  }, [diff]);

  // ─── Sound effects ───
  useSoundEffects(diff, gs);

  // ─── Opponent hero power flash detection ───
  useEffect(() => {
    if (gs.opponent.heroPowerUsed && !prevOpHeroPowerUsed.current) {
      setOpHeroPowerFlash(true);
      setTimeout(() => setOpHeroPowerFlash(false), 400);
    }
    prevOpHeroPowerUsed.current = gs.opponent.heroPowerUsed;
  }, [gs.opponent.heroPowerUsed]);

  // ─── Weapon equip flash (my + opponent side) ───
  // Fires whenever the equipped weapon cardCode changes — including
  // swaps (sword→axe) and break→equip cycles. Previous version only
  // triggered on null→weapon, so swaps snapped in with no animation.
  useEffect(() => {
    const prevCode = prevWeaponRef.current?.cardCode ?? null;
    const nextCode = gs.myWeapon?.cardCode ?? null;
    if (nextCode && nextCode !== prevCode) {
      setWeaponEquipFlash(true);
      const t = setTimeout(() => setWeaponEquipFlash(false), 400);
      prevWeaponRef.current = gs.myWeapon;
      return () => clearTimeout(t);
    }
    if (!nextCode && prevCode) {
      // Weapon broke / removed — reset flash so a future equip re-fires.
      setWeaponEquipFlash(false);
    }
    prevWeaponRef.current = gs.myWeapon;
  }, [gs.myWeapon]);

  const [oppWeaponEquipFlash, setOppWeaponEquipFlash] = useState(false);
  const prevOppWeaponRef = useRef<Weapon | null>(null);
  useEffect(() => {
    const prevCode = prevOppWeaponRef.current?.cardCode ?? null;
    const nextCode = gs.opponent.weapon?.cardCode ?? null;
    if (nextCode && nextCode !== prevCode) {
      setOppWeaponEquipFlash(true);
      const t = setTimeout(() => setOppWeaponEquipFlash(false), 400);
      prevOppWeaponRef.current = gs.opponent.weapon;
      return () => clearTimeout(t);
    }
    if (!nextCode && prevCode) {
      setOppWeaponEquipFlash(false);
    }
    prevOppWeaponRef.current = gs.opponent.weapon;
  }, [gs.opponent.weapon]);

  // Track mouse for attack arrows — no longer needs dragover, handled by pointer move
  // mousePos is updated via the pointer drag global handler

  // ─── Pending interaction (server-side targeting) ───
  const pendingTarget = gs.pendingInteraction?.type === 'CHOOSE_TARGET'
    && gs.pendingInteraction.waitingForPlayerId === gs.myPlayerId
    ? gs.pendingInteraction.targetChoice
    : null;

  // Auto-enter targeting mode from pending interactions
  useEffect(() => {
    if (pendingTarget) {
      setTargeting({ type: 'interaction', interactionId: pendingTarget.interactionId });
      setSelectedHandCard(null);
    }
  }, [pendingTarget?.interactionId]);

  // ─── Valid targets computation ───
  const validTargetIds = useMemo<Set<string>>(() => {
    if (pendingTarget) {
      return new Set(pendingTarget.validTargets.map((t) => t.id));
    }
    if (targeting.type === 'attack') {
      // Can attack enemy minions (taunt check) and enemy hero
      const enemyHasTaunt = opBoard.some(
        (m) => !m.isSilenced && getCard(m.cardCode)?.keywords.includes('TAUNT')
      );
      const ids = new Set<string>();
      for (const m of opBoard) {
        if (m.hasStealthUntilAttack) continue;
        if (enemyHasTaunt) {
          const def = getCard(m.cardCode);
          if (!m.isSilenced && def?.keywords.includes('TAUNT')) {
            ids.add(m.instanceId);
          }
        } else {
          ids.add(m.instanceId);
        }
      }
      if (!enemyHasTaunt) {
        ids.add(`hero-${1 - gs.myPlayerIndex}`);
      }
      return ids;
    }
    // Client-side spell targeting
    if (targeting.type === 'play-card') {
      const ids = new Set<string>();
      const tt = targeting.cardDef ? cardNeedsTarget(targeting.cardDef).targetType : null;
      if (tt === 'TARGET_ENEMY_MINION') {
        for (const m of opBoard) { if (!m.hasStealthUntilAttack) ids.add(m.instanceId); }
      } else if (tt === 'TARGET_FRIENDLY_MINION') {
        for (const m of myBoard) ids.add(m.instanceId);
      } else if (tt === 'TARGET_MINION') {
        for (const m of myBoard) ids.add(m.instanceId);
        for (const m of opBoard) { if (!m.hasStealthUntilAttack) ids.add(m.instanceId); }
      } else if (tt === 'TARGET_ANY') {
        for (const m of myBoard) ids.add(m.instanceId);
        for (const m of opBoard) { if (!m.hasStealthUntilAttack) ids.add(m.instanceId); }
        ids.add(`hero-${gs.myPlayerIndex}`);
        ids.add(`hero-${1 - gs.myPlayerIndex}`);
      }
      return ids;
    }
    // Client-side location activation targeting
    if (targeting.type === 'activate-location') {
      const ids = new Set<string>();
      const tt = locationNeedsTarget(targeting.cardDef).targetType;
      if (tt === 'TARGET_MINION') {
        for (const m of myBoard) ids.add(m.instanceId);
        for (const m of opBoard) { if (!m.hasStealthUntilAttack) ids.add(m.instanceId); }
      } else if (tt === 'TARGET_FRIENDLY_MINION') {
        for (const m of myBoard) ids.add(m.instanceId);
      } else if (tt === 'TARGET_ENEMY_MINION') {
        for (const m of opBoard) { if (!m.hasStealthUntilAttack) ids.add(m.instanceId); }
      } else if (tt === 'TARGET_ANY') {
        for (const m of myBoard) ids.add(m.instanceId);
        for (const m of opBoard) { if (!m.hasStealthUntilAttack) ids.add(m.instanceId); }
        ids.add(`hero-${gs.myPlayerIndex}`);
        ids.add(`hero-${1 - gs.myPlayerIndex}`);
      }
      return ids;
    }
    // Hero power drag targeting
    if (draggingHeroPower) {
      const ids = new Set<string>();
      const tt = HERO_POWER_TARGETING[gs.myHeroClass];
      if (tt === 'TARGET_MINION') {
        for (const m of myBoard) ids.add(m.instanceId);
        for (const m of opBoard) { if (!m.hasStealthUntilAttack) ids.add(m.instanceId); }
      } else if (tt === 'TARGET_FRIENDLY_MINION') {
        for (const m of myBoard) { if (!m.hasDivineShield) ids.add(m.instanceId); }
      } else if (tt === 'TARGET_ANY') {
        for (const m of myBoard) ids.add(m.instanceId);
        for (const m of opBoard) { if (!m.hasStealthUntilAttack) ids.add(m.instanceId); }
        ids.add(`hero-${gs.myPlayerIndex}`);
        ids.add(`hero-${1 - gs.myPlayerIndex}`);
      }
      return ids;
    }
    // Spell drag targeting (drag a targeted spell over valid targets)
    if (draggingCardType === 'SPELL' && draggingCardId && draggingTargetType) {
      const ids = new Set<string>();
      if (draggingTargetType === 'TARGET_ENEMY_MINION') {
        for (const m of opBoard) { if (!m.hasStealthUntilAttack) ids.add(m.instanceId); }
      } else if (draggingTargetType === 'TARGET_FRIENDLY_MINION') {
        for (const m of myBoard) ids.add(m.instanceId);
      } else if (draggingTargetType === 'TARGET_MINION') {
        for (const m of myBoard) ids.add(m.instanceId);
        for (const m of opBoard) { if (!m.hasStealthUntilAttack) ids.add(m.instanceId); }
      } else if (draggingTargetType === 'TARGET_ANY') {
        for (const m of myBoard) ids.add(m.instanceId);
        for (const m of opBoard) { if (!m.hasStealthUntilAttack) ids.add(m.instanceId); }
        ids.add(`hero-${gs.myPlayerIndex}`);
        ids.add(`hero-${1 - gs.myPlayerIndex}`);
      }
      return ids;
    }
    // Client-side hero power targeting
    if (targeting.type === 'hero-power') {
      const ids = new Set<string>();
      const tt = HERO_POWER_TARGETING[gs.myHeroClass];
      if (tt === 'TARGET_MINION') {
        for (const m of myBoard) ids.add(m.instanceId);
        for (const m of opBoard) { if (!m.hasStealthUntilAttack) ids.add(m.instanceId); }
      } else if (tt === 'TARGET_FRIENDLY_MINION') {
        for (const m of myBoard) { if (!m.hasDivineShield) ids.add(m.instanceId); }
      } else if (tt === 'TARGET_ANY') {
        for (const m of myBoard) ids.add(m.instanceId);
        for (const m of opBoard) { if (!m.hasStealthUntilAttack) ids.add(m.instanceId); }
        ids.add(`hero-${gs.myPlayerIndex}`);
        ids.add(`hero-${1 - gs.myPlayerIndex}`);
      }
      return ids;
    }
    return new Set();
  }, [targeting, pendingTarget, opBoard, myBoard, gs.myPlayerIndex, gs.myHeroClass, draggingCardType, draggingCardId, draggingTargetType, draggingHeroPower]);

  // ─── Cancel targeting ───
  // cancelTargeting clears the local targeting machinery. The
  // `serverCancel` flag controls whether it ALSO sends a server-side
  // cancelBattlecry. Default true for user-initiated cancels (Escape,
  // right-click, click on empty space). MUST be false when targeting
  // is being cleared after a successful resolve, otherwise the cleanup
  // immediately undoes the play the player just made — the
  // "two-step battlecry: have to play the card after" bug.
  const cancelTargeting = useCallback((opts?: { serverCancel?: boolean }) => {
    const serverCancel = opts?.serverCancel ?? true;
    if (serverCancel && pendingTarget?.context === 'battlecry' && pendingTarget.interactionId.startsWith('needs-target-')) {
      actions.cancelBattlecry();
    }
    setTargeting({ type: 'none' });
    setSelectedHandCard(null);
    setAttackerPos(null);
  }, [pendingTarget, actions]);

  // Right click / Escape to cancel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelTargeting();
    };
    const onContext = (e: MouseEvent) => {
      if (targeting.type !== 'none') {
        e.preventDefault();
        cancelTargeting();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('contextmenu', onContext);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('contextmenu', onContext);
    };
  }, [targeting.type, cancelTargeting]);

  // ─── Handle hand card click (spells/weapons only — minions must be dragged) ───
  const handleHandCardClick = useCallback(
    (card: ClientCardInstance) => {
      // Skip click if a drag just completed or card already being played
      if (justDraggedRef.current) return;
      if (pendingPlayRef.current.has(card.instanceId)) return;
      if (!isMyTurn || !isPlaying || isGameOver) return;
      const def = getCard(card.cardCode);
      if (!def || def.manaCost > gs.myMana) return;

      // Minions must be dragged to the board, not clicked
      if (def.type === 'MINION') return;

      // Location cards play on click (no positioning needed)
      if (def.type === 'LOCATION') {
        pendingPlayRef.current.add(card.instanceId);
        soundManager.play('CARD_PLAY');
        actions.playCard(card.instanceId);
        setSelectedHandCard(null);
        return;
      }

      if (selectedHandCard === card.instanceId) {
        cancelTargeting();
        return;
      }

      setSelectedHandCard(card.instanceId);

      // Check if spell needs client-side targeting
      if (def.type === 'SPELL') {
        const { needsTarget, targetType } = cardNeedsTarget(def);
        if (needsTarget) {
          // Enter client-side targeting mode instead of round-tripping to server
          setTargeting({ type: 'play-card', cardInstanceId: card.instanceId, cardDef: def, position: 0 });
          return;
        }
      }

      // Non-targeted spells and weapons play immediately — server may respond with needs-target
      pendingPlayRef.current.add(card.instanceId);
      if (def.type === 'SPELL') soundManager.play('SPELL_CAST');
      else soundManager.play('CARD_PLAY');
      actions.playCard(card.instanceId);
    },
    [isMyTurn, isPlaying, isGameOver, gs.myMana, selectedHandCard, actions, cancelTargeting]
  );

  // ─── Handle board minion click ───
  const handleMyMinionClick = useCallback(
    (minion: BoardMinion, e: React.MouseEvent) => {
      if (!isMyTurn || !isPlaying || isGameOver) return;

      // Client-side play-card targeting
      if (targeting.type === 'play-card' && validTargetIds.has(minion.instanceId)) {
        pendingPlayRef.current.add(targeting.cardInstanceId);
        soundManager.play('SPELL_CAST');
        actions.playCard(targeting.cardInstanceId, undefined, minion.instanceId);
        cancelTargeting();
        return;
      }
      // Client-side hero-power targeting
      if (targeting.type === 'hero-power' && validTargetIds.has(minion.instanceId)) {
        soundManager.play('AP_GAIN');
        setHeroPowerFlash(true);
        setTimeout(() => setHeroPowerFlash(false), 400);
        actions.heroPower(minion.instanceId);
        cancelTargeting();
        return;
      }
      // Client-side location activation targeting
      if (targeting.type === 'activate-location' && validTargetIds.has(minion.instanceId)) {
        actions.activateLocation(targeting.locationInstanceId, minion.instanceId);
        cancelTargeting();
        return;
      }

      // If in targeting mode from interaction, select this as target
      if (pendingTarget && validTargetIds.has(minion.instanceId)) {
        if (pendingTarget.interactionId === 'needs-target-hero-power') {
          actions.heroPower(minion.instanceId);
        } else if (pendingTarget.interactionId.startsWith('needs-target-')) {
          const cardInstanceId = pendingTarget.interactionId.replace('needs-target-', '');
          actions.playCard(cardInstanceId, undefined, minion.instanceId);
        } else {
          actions.playCard('__resolve_target__', undefined, minion.instanceId);
        }
        cancelTargeting();
        return;
      }

      if (targeting.type === 'attack') {
        cancelTargeting();
        return;
      }
      // Attack is drag-only — no click-to-select-attacker
    },
    [isMyTurn, isPlaying, isGameOver, targeting, pendingTarget, validTargetIds, actions, cancelTargeting]
  );

  // ─── Handle enemy target click ───
  const handleEnemyTargetClick = useCallback(
    (targetId: string) => {
      // Client-side play-card targeting
      if (targeting.type === 'play-card' && validTargetIds.has(targetId)) {
        pendingPlayRef.current.add(targeting.cardInstanceId);
        soundManager.play('SPELL_CAST');
        actions.playCard(targeting.cardInstanceId, undefined, targetId);
        cancelTargeting();
        return;
      }
      // Client-side hero-power targeting
      if (targeting.type === 'hero-power' && validTargetIds.has(targetId)) {
        soundManager.play('AP_GAIN');
        setHeroPowerFlash(true);
        setTimeout(() => setHeroPowerFlash(false), 400);
        actions.heroPower(targetId);
        cancelTargeting();
        return;
      }
      // Client-side location activation targeting
      if (targeting.type === 'activate-location' && validTargetIds.has(targetId)) {
        actions.activateLocation(targeting.locationInstanceId, targetId);
        cancelTargeting();
        return;
      }

      if (pendingTarget && validTargetIds.has(targetId)) {
        if (pendingTarget.interactionId === 'needs-target-hero-power') {
          // Hero power targeting
          actions.heroPower(targetId);
        } else if (pendingTarget.interactionId.startsWith('needs-target-')) {
          // Card replay with target
          const cardInstanceId = pendingTarget.interactionId.replace('needs-target-', '');
          actions.playCard(cardInstanceId, undefined, targetId);
        } else {
          socket.emit('resolve-target', {
            interactionId: pendingTarget.interactionId,
            targetId,
          });
        }
        // serverCancel:false because we just resolved the battlecry
        // successfully — the local cleanup must NOT also send a
        // cancelBattlecry to the server (which would return the
        // minion to hand and undo the play).
        cancelTargeting({ serverCancel: false });
        return;
      }

      // Attack is drag-only — no click-to-complete-attack
    },
    [targeting, pendingTarget, validTargetIds, actions, cancelTargeting]
  );

  // ─── Hero Power ───
  const handleHeroPower = useCallback(() => {
    if (justDraggedRef.current) return;
    if (!isMyTurn || !isPlaying || gs.myHeroPowerUsed || gs.myMana < HERO_POWER_COST) return;
    // Heroes with targeting enter client-side targeting mode
    if (HERO_POWER_TARGETING[gs.myHeroClass]) {
      setTargeting({ type: 'hero-power' });
      return;
    }
    soundManager.play('AP_GAIN');
    setHeroPowerFlash(true);
    setTimeout(() => setHeroPowerFlash(false), 400);
    actions.heroPower();
  }, [isMyTurn, isPlaying, gs.myHeroPowerUsed, gs.myMana, gs.myHeroClass, actions]);

  // ─── Location Click ───
  const handleLocationClick = useCallback((location: BoardLocation) => {
    if (!isMyTurn || !isPlaying || isGameOver) return;
    if (location.cooldownRemaining > 0 || location.activatedThisTurn) return;
    const def = getCard(location.cardCode);
    if (!def) return;
    const { needsTarget } = locationNeedsTarget(def);
    if (needsTarget) {
      setTargeting({ type: 'activate-location', locationInstanceId: location.instanceId, cardDef: def });
    } else {
      actions.activateLocation(location.instanceId);
    }
  }, [isMyTurn, isPlaying, isGameOver, actions]);

  // ─── End Turn ───
  const handleEndTurn = useCallback(() => {
    if (!isMyTurn || !isPlaying) return;
    cancelTargeting();
    actions.endTurn();
  }, [isMyTurn, isPlaying, actions, cancelTargeting]);

  // ─── Concede ───
  const handleConcede = useCallback(() => {
    actions.concede();
    setSettingsOpen(false);
  }, [actions]);

  // ─── Pointer drag handlers (replaces HTML5 drag-and-drop for mobile + desktop) ───

  // Refs to avoid stale closures in the global pointer handlers
  const ptrDragRef = useRef(ptrDrag);
  ptrDragRef.current = ptrDrag;
  const handlePointerDropCardRef = useRef<(e: PointerEvent) => void>(() => {});
  const handlePointerDropAttackRef = useRef<(e: PointerEvent) => void>(() => {});
  const handlePointerDropHeroPowerRef = useRef<(e: PointerEvent) => void>(() => {});

  // Global pointermove / pointerup listener while dragging
  useEffect(() => {
    if (!ptrDrag) return;
    const handleMove = (e: PointerEvent) => {
      e.preventDefault();
      setPtrDrag(prev => {
        if (!prev) return null;
        const dx = e.clientX - prev.startX;
        const dy = e.clientY - prev.startY;
        const activated = prev.activated || Math.sqrt(dx * dx + dy * dy) > 5;
        return { ...prev, curX: e.clientX, curY: e.clientY, activated };
      });
      setMousePos({ x: e.clientX, y: e.clientY });

      // Update drop index if dragging a hand card over the board
      const cur = ptrDragRef.current;
      if (cur?.info.kind === 'hand-card' && cur.activated && boardRef.current) {
        const minionEls = boardRef.current.querySelectorAll('[data-minion-index]');
        let idx = myBoard.length;
        for (let i = 0; i < minionEls.length; i++) {
          const rect = minionEls[i].getBoundingClientRect();
          if (e.clientX < rect.left + rect.width / 2) {
            idx = parseInt(minionEls[i].getAttribute('data-minion-index') || String(i));
            break;
          }
        }
        setDropIndex(idx);
        setDropZoneActive(e.clientY < window.innerHeight * 0.55);
      }
    };

    const handleUp = (e: PointerEvent) => {
      const drag = ptrDragRef.current;
      if (!drag || !drag.activated) {
        setPtrDrag(null);
        return;
      }

      justDraggedRef.current = true;
      setTimeout(() => { justDraggedRef.current = false; }, 100);

      if (drag.info.kind === 'hand-card') {
        handlePointerDropCardRef.current(e);
      } else if (drag.info.kind === 'attack') {
        handlePointerDropAttackRef.current(e);
      } else if (drag.info.kind === 'hero-power') {
        handlePointerDropHeroPowerRef.current(e);
      }

      setPtrDrag(null);
      setDropZoneActive(false);
      setDropIndex(null);
      setAttackerPos(null);
      setTargeting(prev => (prev.type === 'attack' || prev.type === 'hero-power') ? { type: 'none' } : prev);
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ptrDrag !== null]);

  // Hand card pointer down → start drag
  const handleCardPointerDown = useCallback((e: React.PointerEvent, card: ClientCardInstance) => {
    if (!isMyTurn || !isPlaying || isGameOver) return;
    const def = getCard(card.cardCode);
    if (!def || def.manaCost > gs.myMana) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const targetType = def.type === 'SPELL' ? cardNeedsTarget(def).targetType : null;
    setPtrDrag({
      info: { kind: 'hand-card', cardInstanceId: card.instanceId, cardType: def.type, targetType },
      startX: e.clientX, startY: e.clientY,
      curX: e.clientX, curY: e.clientY,
      activated: false,
    });
  }, [isMyTurn, isPlaying, isGameOver, gs.myMana]);

  // Minion pointer down → start attack drag
  const handleMinionPointerDown = useCallback((e: React.PointerEvent, minion: BoardMinion) => {
    if (!isMyTurn || !isPlaying || isGameOver) return;
    if (!minion.canAttack || minion.attacksRemaining <= 0 || minion.currentAttack <= 0) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setAttackerPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    setTargeting({ type: 'attack', attackerInstanceId: minion.instanceId });
    setPtrDrag({
      info: { kind: 'attack', attackerInstanceId: minion.instanceId },
      startX: e.clientX, startY: e.clientY,
      curX: e.clientX, curY: e.clientY,
      activated: false,
    });
  }, [isMyTurn, isPlaying, isGameOver]);

  // Hero pointer down → start attack drag
  const handleHeroPointerDown = useCallback((e: React.PointerEvent) => {
    if (!isMyTurn || !isPlaying || isGameOver) return;
    // Hero needs a weapon or temporary attack to attack
    const heroAtk = (gs.myWeapon?.currentAttack ?? 0) + (gs.myHeroAttackThisTurn ?? 0);
    if (heroAtk <= 0) return;
    if ((gs.myHeroAttacksRemaining ?? 1) <= 0) return;
    const heroId = `hero-${gs.myPlayerIndex}`;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setAttackerPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    setTargeting({ type: 'attack', attackerInstanceId: heroId });
    setPtrDrag({
      info: { kind: 'attack', attackerInstanceId: heroId },
      startX: e.clientX, startY: e.clientY,
      curX: e.clientX, curY: e.clientY,
      activated: false,
    });
  }, [isMyTurn, isPlaying, isGameOver, gs.myPlayerIndex]);

  // Hero power pointer down → start hero power drag (for targeting hero powers)
  const handleHeroPowerPointerDown = useCallback((e: React.PointerEvent) => {
    if (!isMyTurn || !isPlaying || isGameOver) return;
    if (gs.myHeroPowerUsed || gs.myMana < HERO_POWER_COST) return;
    if (!HERO_POWER_TARGETING[gs.myHeroClass]) return; // non-targeting hero powers don't drag
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setAttackerPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    setTargeting({ type: 'hero-power' });
    setPtrDrag({
      info: { kind: 'hero-power' },
      startX: e.clientX, startY: e.clientY,
      curX: e.clientX, curY: e.clientY,
      activated: false,
    });
  }, [isMyTurn, isPlaying, isGameOver, gs.myHeroPowerUsed, gs.myMana, gs.myHeroClass]);

  // Resolve hand card drop (called on pointerup)
  const handlePointerDropCard = useCallback((e: PointerEvent) => {
    const drag = ptrDragRef.current;
    if (!drag || drag.info.kind !== 'hand-card') return;
    const { cardInstanceId, cardType, targetType } = drag.info;

    const card = gs.myHand.find(c => c.instanceId === cardInstanceId);
    if (!card) return;
    const def = getCard(card.cardCode);
    if (!def || def.manaCost > gs.myMana) return;
    const totalBoard = myBoard.length + (gs.myLocations?.length ?? 0);

    if (pendingPlayRef.current.has(cardInstanceId)) return;

    // Check if dropped on a target entity (minion or hero)
    const targetEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-entity-id]');
    const targetId = targetEl?.getAttribute('data-entity-id') ?? null;

    if (cardType === 'SPELL' && targetType && targetId) {
      // Spell dropped on a target
      pendingPlayRef.current.add(cardInstanceId);
      soundManager.play('SPELL_CAST');
      setActiveSpell({ cardCode: card.cardCode!, targetId });
      actions.playCard(cardInstanceId, undefined, targetId);
      return;
    }

    if (cardType === 'WEAPON' && targetId) {
      pendingPlayRef.current.add(cardInstanceId);
      soundManager.play('CARD_PLAY');
      actions.playCard(cardInstanceId, undefined, targetId);
      return;
    }

    // Card dropped on the board area
    if (cardType === 'MINION') {
      if (totalBoard >= MAX_BOARD_SIZE) return;
      pendingPlayRef.current.add(cardInstanceId);
      const pos = dropIndex ?? myBoard.length;
      soundManager.play('CARD_PLAY');
      // Capture the destination point: if we have a board ref, target the
      // approximate slot center based on insertion position; otherwise fall
      // back to the board's geometric center. The ghost is rendered fixed
      // so all coordinates are viewport-relative.
      const board = boardRef.current?.getBoundingClientRect();
      let toX = e.clientX;
      let toY = e.clientY - 80; // a little above the drop point as a safe default
      if (board) {
        const slotCount = Math.max(1, myBoard.length + 1);
        const slotWidth = board.width / slotCount;
        toX = board.left + slotWidth * (pos + 0.5);
        toY = board.top + board.height / 2;
      }
      setDropSlideGhost({
        cardCode: card.cardCode!,
        fromX: e.clientX,
        fromY: e.clientY,
        dx: toX - e.clientX,
        dy: toY - e.clientY,
        key: Date.now(),
      });
      // Auto-clear after the keyframe finishes (slightly longer than the
      // 0.4s animation to avoid clipping the trailing fade).
      setTimeout(() => setDropSlideGhost(null), 450);
      actions.playCard(cardInstanceId, pos);
    } else {
      // Spells/weapons dropped on board play without target
      pendingPlayRef.current.add(cardInstanceId);
      if (cardType === 'SPELL') soundManager.play('SPELL_CAST');
      else soundManager.play('CARD_PLAY');
      actions.playCard(cardInstanceId);
    }
  }, [gs.myHand, gs.myMana, myBoard.length, gs.myLocations?.length, actions, dropIndex]);
  handlePointerDropCardRef.current = handlePointerDropCard;

  // Resolve attack drop (called on pointerup)
  const handlePointerDropAttack = useCallback((e: PointerEvent) => {
    const drag = ptrDragRef.current;
    if (!drag || drag.info.kind !== 'attack') return;
    const { attackerInstanceId } = drag.info;

    // Find target under pointer
    const targetEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-entity-id]');
    const targetId = targetEl?.getAttribute('data-entity-id') ?? null;
    if (!targetId || !validTargetIds.has(targetId)) return;

    const isHeroAttack = attackerInstanceId.startsWith('hero-');
    if (!isHeroAttack && !myBoard.find(m => m.instanceId === attackerInstanceId)) return;

    soundManager.play('ATTACK_WHOOSH');
    setLungeId(attackerInstanceId);
    setDefenderLungeId(targetId);
    setTargeting({ type: 'none' });
    setAttackerPos(null);
    setTimeout(() => {
      actions.attackTarget(attackerInstanceId, targetId);
      setLungeId(null);
      setDefenderLungeId(null);
    }, 180);
  }, [validTargetIds, myBoard, actions]);
  handlePointerDropAttackRef.current = handlePointerDropAttack;

  // Resolve hero power drop (called on pointerup)
  const handlePointerDropHeroPower = useCallback((e: PointerEvent) => {
    const drag = ptrDragRef.current;
    if (!drag || drag.info.kind !== 'hero-power') return;

    const targetEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-entity-id]');
    const targetId = targetEl?.getAttribute('data-entity-id') ?? null;
    if (!targetId || !validTargetIds.has(targetId)) return;

    soundManager.play('AP_GAIN');
    setHeroPowerFlash(true);
    setTimeout(() => setHeroPowerFlash(false), 400);
    actions.heroPower(targetId);
    setTargeting({ type: 'none' });
    setAttackerPos(null);
  }, [validTargetIds, actions]);
  handlePointerDropHeroPowerRef.current = handlePointerDropHeroPower;

  // ─── Get animation class for a minion ───
  const getMinionAnim = useCallback((instanceId: string, isMyMinion: boolean): string | undefined => {
    if (entranceIds.has(instanceId)) return 'animate-minion-entrance';
    if (damageIds.has(instanceId)) return 'animate-damage-shake';
    if (lungeId === instanceId) return isMyMinion ? 'animate-attack-lunge-up' : 'animate-attack-lunge-down';
    if (defenderLungeId === instanceId) return isMyMinion ? 'animate-attack-lunge-down' : 'animate-attack-lunge-up';
    return undefined;
  }, [entranceIds, damageIds, lungeId, defenderLungeId]);

  // ─── Convert server animation params to CSS custom properties ───
  const getAnimStyle = useCallback((cardCode: string): Record<string, string | number> | undefined => {
    const ap = gs.animParams?.[cardCode];
    if (!ap) return undefined;
    const style: Record<string, string | number> = {};
    if (ap.entrance_duration) style['--anim-entrance-duration'] = `${ap.entrance_duration}s`;
    if (ap.entrance_scale_from != null) style['--anim-entrance-scale-from'] = ap.entrance_scale_from;
    if (ap.entrance_scale_to != null) style['--anim-entrance-scale-to'] = ap.entrance_scale_to;
    if (ap.entrance_opacity_from != null) style['--anim-entrance-opacity-from'] = ap.entrance_opacity_from;
    if (ap.entrance_translate_y) style['--anim-entrance-translate-y'] = `${ap.entrance_translate_y}px`;
    if (ap.attack_lunge_dist) style['--anim-attack-lunge-dist'] = `${ap.attack_lunge_dist}px`;
    if (ap.attack_lunge_dur) style['--anim-attack-lunge-dur'] = `${ap.attack_lunge_dur}s`;
    if (ap.death_fade_dur) style['--anim-death-fade-dur'] = `${ap.death_fade_dur}s`;
    if (ap.death_scale_to != null) style['--anim-death-scale-to'] = ap.death_scale_to;
    if (ap.dmg_flash_dur) style['--anim-dmg-flash-dur'] = `${ap.dmg_flash_dur}s`;
    if (ap.dmg_shake_amp) style['--anim-dmg-shake-amp'] = `${ap.dmg_shake_amp}px`;
    if (ap.buff_pulse_scale) style['--anim-buff-pulse-scale'] = ap.buff_pulse_scale;
    if (ap.buff_pulse_dur) style['--anim-buff-pulse-dur'] = `${ap.buff_pulse_dur}s`;
    if (ap.buff_glow_intensity != null) style['--anim-buff-glow-intensity'] = ap.buff_glow_intensity;
    if (ap.spell_proj_dur) style['--anim-spell-proj-dur'] = `${ap.spell_proj_dur}s`;
    if (ap.spell_impact_scale) style['--anim-spell-impact-scale'] = ap.spell_impact_scale;
    if (ap.spell_impact_dur) style['--anim-spell-impact-dur'] = `${ap.spell_impact_dur}s`;
    if (ap.draw_slide_dur) style['--anim-draw-slide-dur'] = `${ap.draw_slide_dur}s`;
    if (ap.draw_slide_dist) style['--anim-draw-slide-dist'] = `${ap.draw_slide_dist}px`;
    return Object.keys(style).length > 0 ? style : undefined;
  }, [gs.animParams]);

  // ─── Dynamic board gap + per-board scale ───
  // Old version returned a NEGATIVE gap (-0.5rem) when the board hit 7
  // minions, which made them overlap and look "crammed" — the user's
  // word. New version: always positive gap, and a per-board scale
  // factor that gently shrinks each minion when the board is full so
  // the row stays inside the available width without overlap.
  //
  // With max-w 72rem and a 9rem-wide minion, 7 minions take 63rem of
  // width on their own, leaving 9rem / 6 gaps = 1.5rem per gap. With
  // a scale of 0.92 the minions take 58rem leaving 14rem / 6 gaps =
  // ~2.3rem each. Plenty of breathing room and nothing overlaps.
  const getBoardGap = (count: number) =>
    count <= 4 ? '0.85rem' :
    count <= 5 ? '0.6rem' :
    count <= 6 ? '0.4rem' :
                 '0.3rem';
  const getBoardScaleFactor = (count: number) =>
    count <= 5 ? 1.0 :
    count <= 6 ? 0.96 :
                 0.92;
  const myBoardGap = getBoardGap(myBoard.length);
  const opBoardGap = getBoardGap(opBoard.length);
  const myBoardScale = getBoardScaleFactor(myBoard.length);
  const opBoardScale = getBoardScaleFactor(opBoard.length);

  // ─── Spell effect callback (must be before any early return) ───
  const clearSpell = useCallback(() => setActiveSpell(null), []);

  // ─── Mulligan ───
  if (gs.phase === 'MULLIGAN') {
    const alreadyConfirmed = gs.mulliganConfirmed[gs.myPlayerIndex];
    return (
      <div className="relative h-screen w-screen bg-stone-950">
        <MulliganScreen
          hand={gs.myHand}
          confirmed={alreadyConfirmed}
          onConfirm={(replacements) => {
            actions.confirmMulligan(replacements);
          }}
          deadlineAt={gs.turnDeadline}
        />
      </div>
    );
  }

  // ─── Game Over overlay ───
  const GameOverOverlay = isGameOver ? (
    <GameOver
      winnerName={gs.winner === gs.myPlayerId ? gs.myPlayerName : gs.opponent.playerName}
      isMe={gs.winner === gs.myPlayerId}
      onPlayAgain={onLeaveGame}
      gameState={gs}
      onLeaveGame={onLeaveGame}
      rewards={postGameRewards}
    />
  ) : null;

  // ─── Interaction overlay (pending target) ───
  const InteractionOverlay = pendingTarget ? (
    <div className="fixed left-1/2 top-4 z-40 -translate-x-1/2 rounded-lg bg-amber-900/90 px-6 py-3 text-center shadow-lg animate-slide-down">
      <p className="text-lg font-bold text-amber-300">{pendingTarget.prompt}</p>
      <p className="text-sm text-amber-200/70">Click a valid target (glowing green)</p>
      {pendingTarget.allowSkip && (
        <button
          onClick={() => {
            socket.emit('resolve-target', {
              interactionId: pendingTarget.interactionId,
              targetId: null,
            });
            cancelTargeting();
          }}
          className="mt-2 rounded bg-stone-600 px-4 py-1 text-sm text-white hover:bg-stone-500"
        >
          Skip
        </button>
      )}
    </div>
  ) : null;

  // ─── Client-side targeting overlay (play-card / hero-power) ───
  const ClientTargetingOverlay = (targeting.type === 'play-card' || targeting.type === 'hero-power' || targeting.type === 'activate-location') ? (
    <div className="fixed left-1/2 top-4 z-40 -translate-x-1/2 rounded-lg bg-amber-900/90 px-6 py-3 text-center shadow-lg animate-slide-down">
      <p className="text-lg font-bold text-amber-300">Choose a target</p>
      <p className="text-sm text-amber-200/70">Click a valid target (glowing green)</p>
      <button
        onClick={() => cancelTargeting()}
        className="mt-2 rounded bg-stone-600 px-4 py-1 text-sm text-white hover:bg-stone-500"
      >
        Cancel
      </button>
    </div>
  ) : null;

  return (
    <div
      ref={boardRef}
      className="relative flex h-dvh w-screen flex-col overflow-hidden select-none"
      style={{ background: 'linear-gradient(to bottom, #1a0f05, #2d1e0e 6%, #4a3520 15%, #5c4528 30%, #6b5232 45%, #725838 50%, #6b5232 55%, #5c4528 70%, #4a3520 85%, #2d1e0e 94%, #1a0f05)' }}
    >
      {GameOverOverlay}
      {isPlaying && !isGameOver && <TurnBanner key={turnBannerKey} isMyTurn={isMyTurn} />}
      {InteractionOverlay}
      {ClientTargetingOverlay}

      {/* ═══ Left sidebar: Action History (card art thumbnails) ═══ */}
      {/* overflow-visible on the outer container so the hover popup can
           escape the 14px-wide sidebar. Inner scroller keeps its
           overflow-y-auto so the thumbnails still scroll. */}
      <div className="hidden md:flex absolute left-0 top-0 bottom-0 w-14 z-10 flex-col bg-stone-950/50 overflow-visible">
        <div className="flex-1 overflow-y-auto overflow-x-visible flex flex-col-reverse">
          <div className="py-1 space-y-1 px-1">
            {gs.log.slice(-25).filter(e => e.category === 'PLAY' || e.category === 'COMBAT' || e.category === 'EFFECT').map(entry => {
              const isMe = entry.playerIndex === gs.myPlayerIndex;
              const cardCode = (entry as any).cardCode;
              const glowColor = entry.category === 'COMBAT' ? 'shadow-red-500/40' : entry.category === 'EFFECT' ? 'shadow-purple-500/40' : isMe ? 'shadow-amber-500/40' : 'shadow-gray-400/30';
              return (
                <div key={entry.id} className="relative group">
                  <div className={`w-12 h-12 rounded overflow-hidden border-2 shadow-md ${glowColor} ${
                    isMe ? 'border-amber-500/70' : 'border-gray-500/50'
                  }`}>
                    {cardCode ? (
                      <CardArt cardCode={cardCode} className="w-full h-full" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center text-xs font-bold ${
                        entry.category === 'COMBAT' ? 'bg-red-900/60 text-red-300' : 'bg-stone-800 text-stone-400'
                      }`}>
                        {entry.category === 'COMBAT' ? '⚔' : '•'}
                      </div>
                    )}
                  </div>
                  {/* Hover tooltip — show the full card when the log
                       entry has a cardCode (so you can see what actually
                       happened), fall back to text for COMBAT-only
                       entries that don't reference a specific card. */}
                  <div className="absolute left-full ml-2 top-0 hidden group-hover:block z-50 pointer-events-none">
                    {cardCode ? (
                      <div className="flex flex-col gap-1">
                        <div style={{ transform: 'scale(1.5)', transformOrigin: 'top left' }}>
                          <CardComponent cardCode={cardCode} />
                        </div>
                        <div className="bg-stone-900/95 border border-amber-700/40 rounded px-2 py-1 mt-[88px] shadow-xl max-w-[220px]">
                          <span className="text-[10px] text-amber-100 leading-tight">{entry.message}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-stone-900/95 border border-stone-600 rounded px-2 py-1 whitespace-nowrap shadow-lg">
                        <span className="text-[10px] text-gray-300">{entry.message}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ Animation overlays ═══ */}
      <FloatingNumbers numbers={diff.floatingNumbers} />
      <DeathAnimation deadMinions={diff.deadMinions} />
      <SpellCastEffect spell={activeSpell} onComplete={clearSpell} />

      {/* Opponent card showcase — center-screen card spotlight when
          opponent plays a card. Reads gs.log for new PLAY entries and
          renders the card def with art + name + cost so the player
          knows exactly what just happened. */}
      {opponentCardShowcase && (() => {
        const def = getCard(opponentCardShowcase.cardCode);
        if (!def) return null;
        return (
          <div
            key={opponentCardShowcase.key}
            className="pointer-events-none fixed top-1/2 left-1/2 z-[60] animate-card-showcase"
          >
            <div className="w-56 h-72 rounded-2xl border-4 border-amber-300 shadow-[0_0_60px_16px_rgba(245,158,11,0.7)] bg-gradient-to-b from-stone-800 via-stone-900 to-black overflow-hidden flex flex-col">
              <div className="absolute top-2 left-2 z-10"><ManaGem value={def.manaCost} size={40} /></div>
              <div className="w-full h-44 mt-3 mx-auto rounded overflow-hidden bg-stone-700">
                <CardArt cardCode={opponentCardShowcase.cardCode} className="w-full h-full" />
              </div>
              <div className="px-3 pt-2 text-center">
                <div className="text-amber-200 font-extrabold text-base leading-tight drop-shadow">{def.name}</div>
                <div className="text-amber-100/70 text-[11px] leading-tight mt-1 line-clamp-3">{def.text}</div>
              </div>
              {def.type === 'MINION' && (
                <div className="flex justify-between px-4 pb-2 mt-auto">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-700 border-2 border-yellow-300 text-sm font-extrabold text-white shadow">
                    {def.attack}
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-800 border-2 border-red-300 text-sm font-extrabold text-white shadow">
                    {def.health}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Drop slide ghost — bridges hand→board on minion plays */}
      {dropSlideGhost && (
        <div
          key={dropSlideGhost.key}
          className="pointer-events-none fixed z-50 animate-drop-slide-ghost"
          style={{
            left: dropSlideGhost.fromX,
            top: dropSlideGhost.fromY,
            // CSS custom properties consumed by the drop-slide-ghost keyframe
            ['--dx' as string]: `${dropSlideGhost.dx}px`,
            ['--dy' as string]: `${dropSlideGhost.dy}px`,
          }}
        >
          <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-amber-300 shadow-[0_0_24px_8px_rgba(245,158,11,0.5)] bg-stone-900">
            <CardArt cardCode={dropSlideGhost.cardCode} className="w-full h-full" />
          </div>
        </div>
      )}

      {/* Spectator banner */}
      {isSpectator && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-purple-600/90 text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          Spectating {gs.myPlayerName} vs {gs.opponent.playerName}
          {gs.spectatorCount > 1 && <span className="text-purple-200 text-xs ml-1">+{gs.spectatorCount - 1} watching</span>}
        </div>
      )}

      {/* Spectator count (for players) */}
      {gs.spectatorCount > 0 && !isSpectator && (
        <div className="absolute top-2 right-28 z-40 bg-slate-800/80 text-purple-300 px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          {gs.spectatorCount} watching
        </div>
      )}

      {/* Attack arrow */}
      {(targeting.type === 'attack' || targeting.type === 'hero-power') && attackerPos && (
        <AttackArrow from={attackerPos} to={mousePos} />
      )}

      {/* Spell targeting arrow — shown when dragging a targeted spell */}
      {draggingCardType === 'SPELL' && draggingTargetType && ptrDrag?.activated && (
        <svg className="pointer-events-none fixed inset-0 z-40" style={{ width: '100vw', height: '100vh' }}>
          <defs>
            <marker id="spell-arrowhead" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto">
              <polygon points="0 0, 12 4, 0 8" fill="#8b5cf6" />
            </marker>
            <filter id="spell-arrow-shadow">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#8b5cf6" floodOpacity="0.6" />
            </filter>
          </defs>
          <line
            x1={ptrDrag.startX}
            y1={ptrDrag.startY}
            x2={ptrDrag.curX}
            y2={ptrDrag.curY}
            stroke="#8b5cf6"
            strokeWidth="3"
            strokeDasharray="8 4"
            markerEnd="url(#spell-arrowhead)"
            filter="url(#spell-arrow-shadow)"
          />
        </svg>
      )}

      {/* Opponent Emote (hidden when muted) */}
      {opponentEmote && !opponentMuted && (
        <div className="fixed right-8 top-24 z-30 animate-bounce rounded-lg bg-stone-800 px-4 py-2 text-2xl shadow-lg border border-stone-600">
          {opponentEmote}
        </div>
      )}
      {/* Mute bubble — pops up when you click the opponent hero. Speech-
           bubble tail points down toward the hero portrait area. Click
           toggles muted state, then auto-closes. */}
      {showMuteBubble && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMuteBubble(false)} />
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce-in">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpponentMuted(m => !m);
                setShowMuteBubble(false);
              }}
              className="relative rounded-2xl bg-stone-800 border-2 border-amber-500/70 px-5 py-3 text-sm font-bold text-amber-100 shadow-xl hover:bg-stone-700 cursor-pointer"
            >
              {opponentMuted ? '🔊 Unmute Opponent' : '🔇 Mute Opponent'}
              <span className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-amber-500/70" />
            </button>
          </div>
        </>
      )}

      {/* My Emote */}
      {myEmote && (
        <div className="fixed right-8 bottom-24 z-30 animate-bounce rounded-lg bg-amber-900/90 border border-amber-600 px-4 py-2 text-lg text-amber-100 shadow-lg">
          {myEmote}
        </div>
      )}

      {/* ═══ Top-right controls: Settings ═══ */}
      <div className="absolute right-4 top-4 z-30">
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="rounded-lg bg-stone-800/80 px-3 py-2 text-sm text-stone-300 hover:bg-stone-700"
        >
          ⚙️
        </button>
      </div>
      {settingsOpen && (
        <Settings onConcede={handleConcede} onClose={() => setSettingsOpen(false)} />
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* OPPONENT AREA (top half) */}
      {/* ═══════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 flex-col items-center px-2 md:px-4 pt-0.5 md:pt-1 pb-0">
        {/* Opponent hand */}
        <OpponentHand count={gs.opponent.handCount} cardBackId={(gs as any).opponentCardBack} />

        {/* Opponent hero row */}
        <div className="flex items-center justify-center w-full gap-2 md:gap-4 relative">
          {/* Opponent name + mode badge — left side */}
          <div className="absolute left-16 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-start gap-0.5">
            <span className="text-sm text-gray-200 font-bold drop-shadow-md bg-black/40 rounded px-2 py-0.5">{gs.opponent.playerName}</span>
            {(gs as any).gameMode === 'ranked' && (
              <span className="text-[9px] text-purple-300 font-bold bg-black/30 rounded px-1.5 py-0.5">RANKED</span>
            )}
          </div>
          <HeroPortrait
            heroClass={gs.opponent.heroClass}
            health={gs.opponent.health}
            maxHealth={gs.opponent.maxHealth}
            armor={gs.opponent.armor}
            weapon={gs.opponent.weapon}
            heroPowerUsed={gs.opponent.heroPowerUsed}
            isMyHero={false}
            isMyTurn={!isMyTurn}
            mana={gs.opponent.mana}
            maxMana={gs.opponent.maxMana}
            canUseHeroPower={false}
            isValidTarget={validTargetIds.has(`hero-${1 - gs.myPlayerIndex}`)}
            onHeroPowerClick={() => {}}
            onHeroClick={() => {
              // If there's an active click-targeting flow (play-card or
              // hero-power), let that claim the click. Otherwise pop the
              // mute bubble.
              if (targeting.type === 'play-card' || targeting.type === 'hero-power') {
                handleEnemyTargetClick(`hero-${1 - gs.myPlayerIndex}`);
                return;
              }
              setShowMuteBubble(s => !s);
            }}
            heroDamage={opHeroDamage}
            secretCount={gs.opponent.secretCount}
            entityId={`hero-${1 - gs.myPlayerIndex}`}
            heroPowerFlash={opHeroPowerFlash}
            heroPowerUpgraded={gs.opponent.heroPowerUpgraded}
            upgradeProgress={gs.opponent.upgradeProgress}
            weaponEquipFlash={oppWeaponEquipFlash}
            goldenHero={!!gs.opponent.isGoldenHero}
          />
          {/* Opponent mana */}
          <ManaCrystals current={gs.opponent.mana} max={gs.opponent.maxMana} />
        </div>

        {/* Spacer — pushes board toward center divider */}
        <div className="flex-1" />

        {/* Opponent locations */}
        {gs.opponent?.locations && gs.opponent.locations.length > 0 && (
          <div className="flex items-center justify-center gap-3 mb-0.5">
            {gs.opponent.locations.map((loc) => (
              <div
                key={loc.instanceId}
                onMouseEnter={(e) => setHoveredCard({ cardCode: loc.cardCode, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <BoardLocationCard
                  location={loc}
                  isMyLocation={false}
                  canActivate={false}
                  isSelected={false}
                  onClick={() => {}}
                />
              </div>
            ))}
          </div>
        )}

        {/* Opponent board */}
        <div className="flex min-h-[5.5rem] mb-1 items-center justify-center board-field">
          <div
            className="flex items-center justify-center max-w-[72rem] w-full px-2"
            style={{ gap: opBoardGap }}
          >
            {opBoard.map((m, idx) => {
              const count = opBoard.length;
              const mid = (count - 1) / 2;
              const arcAngle = count > 1 ? (idx - mid) * 3 : 0;
              const arcY = Math.abs(idx - mid) * 3;
              const zIdx = count - Math.abs(idx - Math.floor(mid));
              return (
              <div
                key={m.instanceId}
                data-entity-id={m.instanceId}
                style={{ flex: '0 1 9rem', transform: `scale(${cardScale * opBoardScale}) rotate(${arcAngle}deg) translateY(${arcY}px)`, transformOrigin: 'center center', zIndex: zIdx }}
                onMouseEnter={(e) => setHoveredCard({ cardCode: m.cardCode, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <BoardMinionCard
                  minion={m}
                  isMyMinion={false}
                  canAct={false}
                  hasSummoningSickness={false}
                  isValidTarget={validTargetIds.has(m.instanceId)}
                  isSelected={false}
                  onClick={() => handleEnemyTargetClick(m.instanceId)}
                  animationClass={getMinionAnim(m.instanceId, false)}
                  isBuffed={buffedIds.has(m.instanceId)}
                  animStyle={getAnimStyle(m.cardCode)}
                />
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* GOLD DIVIDER (absolutely centered) */}
      {/* ═══════════════════════════════════════════ */}
      <div className="absolute left-0 right-0 md:right-24 top-1/2 -translate-y-1/2 z-10 px-4 md:px-8">
        <div className="h-[3px] bg-gradient-to-r from-amber-700/20 via-amber-500/80 to-amber-700/20 shadow-[0_0_6px_rgba(245,158,11,0.3)]" />
      </div>

      {/* Spell drag-to-target hint */}
      {draggingCardType === 'SPELL' && draggingTargetType && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="bg-green-600/90 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg animate-pulse">
            Drag to a target
          </div>
        </div>
      )}

      {/* Hero power drag hint */}
      {draggingHeroPower && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="bg-amber-600/90 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg animate-pulse">
            Drag to a target
          </div>
        </div>
      )}

      {/* Minion attack drag hint */}
      {draggingAttackerId && (
        <div className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="bg-red-600/90 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg animate-pulse">
            Drop on enemy to attack
          </div>
        </div>
      )}

      {/* ═══ Right sidebar: Deck → End Turn → Timer → Deck ═══ */}
      {/* Desktop: absolutely positioned right side; Mobile: End Turn at bottom-center */}
      <div className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 flex-col items-center gap-3">
        {/* Opponent deck — slightly tilted */}
        <div style={{ transform: 'rotate(3deg)' }}>
          <DeckPile count={gs.opponentDeckCount} graveyardCount={gs.opponent.graveyardCount} />
        </div>
        {/* End Turn — Hearthstone-style wide pill */}
        {/* When the timer drops to <=5s on my turn, swap to a red urgent
            pulse so the player has unmissable peripheral feedback that
            they're about to time out. */}
        <button
          onClick={handleEndTurn}
          disabled={!isMyTurn || !isPlaying}
          className={`w-28 h-14 rounded-xl font-bold text-sm text-center transition-all border-2
            ${isMyTurn && isPlaying
              ? (timeLeft !== null && timeLeft <= 5
                ? 'bg-gradient-to-b from-red-500 to-red-700 text-white border-red-300 hover:from-red-400 hover:to-red-600 active:scale-95 cursor-pointer animate-end-turn-urgent'
                : 'bg-gradient-to-b from-amber-400 to-yellow-600 text-stone-900 border-amber-300 shadow-[0_0_24px_rgba(234,179,8,0.5)] hover:from-amber-300 hover:to-yellow-500 active:scale-95 cursor-pointer')
              : 'bg-stone-700/80 text-stone-500 border-stone-600 cursor-not-allowed'}
          `}
        >
          {isMyTurn ? 'END TURN' : 'ENEMY TURN'}
        </button>
        {isMyTurn && timeLeft !== null && timeLeft <= 20 && (
          <div className="w-20 h-1.5 rounded-full bg-stone-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                timeLeft <= 5 ? 'bg-red-500 animate-timer-urgent' : timeLeft <= 10 ? 'bg-orange-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${(timeLeft / 20) * 100}%` }}
            />
          </div>
        )}
        {/* My deck — slightly tilted opposite */}
        <div style={{ transform: 'rotate(-3deg)' }}>
          <DeckPile count={gs.deckCount} graveyardCount={gs.myGraveyardCount} />
        </div>
      </div>
      {/* Mobile: End Turn button at bottom-center + decks in corners */}
      <div className="md:hidden absolute bottom-1 left-1/2 -translate-x-1/2 z-30">
        <button
          onClick={handleEndTurn}
          disabled={!isMyTurn || !isPlaying}
          className={`w-14 h-14 rounded-xl font-bold text-[10px] leading-tight text-center transition-all
            ${isMyTurn && isPlaying
              ? 'bg-gradient-to-b from-amber-500 to-yellow-600 text-black shadow-[0_0_12px_rgba(234,179,8,0.4)] active:scale-95 animate-end-turn-glow'
              : 'bg-stone-700 text-stone-500 cursor-not-allowed'}
          `}
        >
          {isMyTurn ? <>END{'\n'}TURN</> : <>ENEMY{'\n'}TURN</>}
        </button>
      </div>
      <div className="md:hidden absolute top-1 right-1 z-20">
        <DeckPile count={gs.opponentDeckCount} graveyardCount={gs.opponent.graveyardCount} />
      </div>
      <div className="md:hidden absolute bottom-16 right-1 z-20">
        <DeckPile count={gs.deckCount} graveyardCount={gs.myGraveyardCount} />
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* MY AREA (entire bottom half is drop zone) */}
      {/* ═══════════════════════════════════════════ */}
      <div
        className={`flex flex-1 min-h-0 flex-col items-center px-2 md:px-4 pt-0 pb-1 transition-all ${dropZoneActive ? 'animate-drop-zone-pulse ring-2 ring-inset ring-green-400/40' : ''}`}
      >
        {/* My locations */}
        {gs.myLocations && gs.myLocations.length > 0 && (
          <div className="flex items-center justify-center gap-3 mt-0.5">
            {gs.myLocations.map((loc) => {
              const locDef = getCard(loc.cardCode);
              const canActivate = isMyTurn && isPlaying && !isGameOver && loc.cooldownRemaining === 0 && !loc.activatedThisTurn;
              return (
                <div
                  key={loc.instanceId}
                  onMouseEnter={(e) => setHoveredCard({ cardCode: loc.cardCode, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <BoardLocationCard
                    location={loc}
                    isMyLocation={true}
                    canActivate={canActivate}
                    isSelected={targeting.type === 'activate-location' && targeting.locationInstanceId === loc.instanceId}
                    onClick={() => handleLocationClick(loc)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* My board (minion positions) */}
        <div
          className="flex min-h-[5.5rem] mt-1 items-center justify-center rounded-lg board-field border-2 border-transparent"
        >
          <div
            className="flex items-center justify-center max-w-[72rem] w-full px-2"
            style={{ gap: myBoardGap }}
          >
            {(() => {
              const isDraggingMinion = ptrDrag?.info.kind === 'hand-card' && ptrDrag.activated && draggingCardType === 'MINION' && dropZoneActive;
              const insertAt = isDraggingMinion && dropIndex != null ? dropIndex : -1;
              const items: React.ReactNode[] = [];
              const count = myBoard.length;
              for (let i = 0; i <= count; i++) {
                if (i === insertAt) {
                  items.push(
                    <div key="drop-spacer" className="w-[4rem] h-[10.5rem] transition-all duration-200" />
                  );
                }
                if (i < count) {
                  const m = myBoard[i];
                  const mid = (count - 1) / 2;
                  const arcAngle = count > 1 ? (i - mid) * 3 : 0;
                  const arcY = Math.abs(i - mid) * 3;
                  items.push(
                    <div
                      key={m.instanceId}
                      data-minion-index={i}
                      data-entity-id={m.instanceId}
                      style={{ flex: '0 1 9rem', transform: `scale(${cardScale * myBoardScale}) rotate(${arcAngle}deg) translateY(${arcY}px)`, transformOrigin: 'bottom center', transition: 'all 0.2s ease' }}
                      onMouseEnter={(e) => setHoveredCard({ cardCode: m.cardCode, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      <BoardMinionCard
                        minion={m}
                        isMyMinion={true}
                        canAct={isMyTurn && m.canAttack && m.attacksRemaining > 0 && m.currentAttack > 0}
                        hasSummoningSickness={isMyTurn && !m.canAttack && m.currentAttack > 0 && !m.isFrozen}
                        isValidTarget={validTargetIds.has(m.instanceId)}
                        isSelected={targeting.type === 'attack' && targeting.attackerInstanceId === m.instanceId}
                        onClick={(e?: any) => handleMyMinionClick(m, e)}
                        animationClass={getMinionAnim(m.instanceId, true)}
                        isBuffed={buffedIds.has(m.instanceId)}
                        onPointerDown={(e) => handleMinionPointerDown(e, m)}
                        animStyle={getAnimStyle(m.cardCode)}
                      />
                    </div>
                  );
                }
              }
              // If insertAt is at the end (== count), it's already added
              if (insertAt === count) {
                // Already inserted above in the loop
              }
              return items;
            })()}
          </div>
        </div>

        {/* Spacer — pushes board toward center, hero+hand toward bottom */}
        <div className="flex-1" />

        {/* My hero row */}
        <div className="flex items-center justify-center w-full gap-2 md:gap-4 relative">
          {/* My name + mode badge — left side */}
          <div className="absolute left-16 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-start gap-0.5">
            <span className="text-sm text-amber-100 font-bold drop-shadow-md bg-black/40 rounded px-2 py-0.5">{gs.myPlayerName}</span>
            {(gs as any).gameMode === 'ranked' && (
              <span className="text-[9px] text-purple-300 font-bold bg-black/30 rounded px-1.5 py-0.5">RANKED</span>
            )}
          </div>
          <HeroPortrait
            heroClass={gs.myHeroClass}
            health={gs.myHealth}
            maxHealth={gs.myMaxHealth}
            armor={gs.myArmor}
            weapon={gs.myWeapon}
            heroPowerUsed={gs.myHeroPowerUsed}
            isMyHero={true}
            isMyTurn={isMyTurn}
            mana={gs.myMana}
            maxMana={gs.myMaxMana}
            canUseHeroPower={isMyTurn && !gs.myHeroPowerUsed && gs.myMana >= HERO_POWER_COST}
            canHeroAttack={isMyTurn && isPlaying && (gs.myHeroAttacksRemaining ?? 1) > 0 && ((!!gs.myWeapon && gs.myWeapon.currentAttack > 0) || (gs.myHeroAttackThisTurn ?? 0) > 0)}
            isValidTarget={validTargetIds.has(`hero-${gs.myPlayerIndex}`)}
            onHeroPowerClick={handleHeroPower}
            onHeroClick={(e?: React.MouseEvent) => {
              if (validTargetIds.has(`hero-${gs.myPlayerIndex}`)) {
                handleEnemyTargetClick(`hero-${gs.myPlayerIndex}`);
                return;
              }
            }}
            heroDamage={myHeroDamage}
            secretCount={gs.mySecrets?.length ?? 0}
            mySecretCodes={gs.mySecrets?.map(s => s.cardCode)}
            heroPowerFlash={heroPowerFlash}
            entityId={`hero-${gs.myPlayerIndex}`}
            heroPowerUpgraded={gs.myHeroPowerUpgraded}
            upgradeProgress={gs.myUpgradeProgress}
            onHeroPointerDown={handleHeroPointerDown}
            onHeroPowerPointerDown={handleHeroPowerPointerDown}
            weaponEquipFlash={weaponEquipFlash}
            goldenHero={!!gs.myIsGoldenHero}
          />

          {/* My mana */}
          <ManaCrystals current={gs.myMana} max={gs.myMaxMana} />

          {/* Emote button */}
          <div className="relative">
            <button
              onClick={() => setEmoteOpen(!emoteOpen)}
              className="rounded-full bg-stone-800/80 border border-stone-600 w-9 h-9 flex items-center justify-center text-stone-300 hover:bg-stone-700 hover:text-white transition-colors"
              title="Send emote"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            {/* Emote popup */}
            {emoteOpen && (
              <>
              <div className="fixed inset-0 z-40" onClick={() => setEmoteOpen(false)} />
              <div className="absolute bottom-12 right-0 z-50 bg-stone-900/95 border border-stone-600 rounded-xl p-1.5 shadow-2xl flex flex-col gap-0.5 animate-fade-in min-w-[180px] backdrop-blur-sm"
              >
                {(() => {
                  const heroLines: Record<string, Record<string, string>> = {
                    JIMMY: { Greetings: "Let's light it up!", Thanks: "Much appreciated!", 'Well Played': "You fought well!", Wow: "Whoa, hot stuff!", Oops: "That wasn't supposed to explode...", Threaten: "I'll burn everything you love!" },
                    TALA: { Greetings: "Nature guides us!", Thanks: "The forest thanks you.", 'Well Played': "A beautiful game.", Wow: "By the World Root!", Oops: "Even flowers have thorns...", Threaten: "Nature will reclaim you." },
                    DEREK: { Greetings: "Systems online!", Thanks: "Data received!", 'Well Played': "Impressive algorithms.", Wow: "Processing... wow!", Oops: "Critical error detected.", Threaten: "You're about to be scrapped." },
                    ANDERS: { Greetings: "The ice speaks.", Thanks: "Cool. Literally.", 'Well Played': "A worthy opponent.", Wow: "Frozen in awe!", Oops: "That was... cold of me.", Threaten: "Winter is coming for you." },
                    DES: { Greetings: "Darkness rises.", Thanks: "Your suffering pleases me.", 'Well Played': "You delayed the inevitable.", Wow: "Even I'm impressed.", Oops: "A minor setback.", Threaten: "Your soul will serve the Dominion." },
                    ASTRID: { Greetings: "Shield up!", Thanks: "For the Academy!", 'Well Played': "Honor in battle.", Wow: "By the peak!", Oops: "My shield slipped.", Threaten: "You shall not pass!" },
                    AVA: { Greetings: "Deploying drones!", Thanks: "Input appreciated!", 'Well Played': "Great engineering!", Wow: "That's innovative!", Oops: "Calibration error.", Threaten: "Initiating offensive protocol." },
                    LUCAS: { Greetings: "Catch me if you can!", Thanks: "I owe you one. Maybe.", 'Well Played': "Not bad... for you.", Wow: "Didn't see that coming!", Oops: "That was on purpose. Totally.", Threaten: "You'll never see me coming." },
                    IZZY: { Greetings: "Adventure awaits!", Thanks: "Sparkle thanks!", 'Well Played': "What a journey!", Wow: "Sparkling!", Oops: "Slight navigational error.", Threaten: "I'll chart a course through you!" },
                  };
                  const myHero = gs.myHeroClass || 'JIMMY';
                  const lines = heroLines[myHero] || heroLines.JIMMY;
                  return [
                    { id: 'Greetings', label: lines.Greetings },
                    { id: 'Well Played', label: lines['Well Played'] },
                    { id: 'Thanks', label: lines.Thanks },
                    { id: 'Wow', label: lines.Wow },
                    { id: 'Oops', label: lines.Oops },
                    { id: 'Threaten', label: lines.Threaten },
                  ];
                })().map(emote => (
                  <button
                    key={emote.id}
                    onClick={() => {
                      actions.emitEmote(emote.id);
                      setMyEmote(emote.label);
                      setTimeout(() => setMyEmote(null), 3000);
                      setEmoteOpen(false);
                    }}
                    className="w-full px-3 py-2 text-[11px] text-stone-200 hover:bg-amber-700/30 rounded-lg whitespace-nowrap transition-colors text-left cursor-pointer"
                  >
                    {emote.label}
                  </button>
                ))}
              </div>
              </>
            )}
          </div>
        </div>

        {/* My hand — fanned arc layout, expands on hover */}
        <div
          className="flex items-end justify-center pb-0 group/hand transition-transform duration-300 hover:scale-110 hover:-translate-y-4 overflow-visible"
          style={{
            gap: gs.myHand.length > 6 ? (isMobile ? '-1rem' : '-0.5rem') : (isMobile ? '-0.25rem' : '0.25rem'),
            transform: isMobile ? `scale(${cardScale})` : undefined,
            transformOrigin: 'bottom center',
          }}
        >
          {gs.myHand.map((card, i) => {
            const def = getCard(card.cardCode);
            const boardFull = myBoard.length + (gs.myLocations?.length ?? 0) >= MAX_BOARD_SIZE;
            const canPlay = isMyTurn && isPlaying && !isGameOver && (def?.manaCost ?? 99) <= gs.myMana
              && (def?.type !== 'MINION' || !boardFull) && (def?.type !== 'LOCATION' || !boardFull);
            const handSize = gs.myHand.length;
            const maxAngle = Math.min(handSize * (isMobile ? 2 : 3), isMobile ? 15 : 20);
            const angleStep = handSize > 1 ? (maxAngle * 2) / (handSize - 1) : 0;
            const angle = handSize > 1 ? -maxAngle + i * angleStep : 0;
            const yOffset = Math.abs(angle) * 0.8;
            const isHovered = hoveredCard?.cardCode === card.cardCode;
            const isDrag = draggingCardId === card.instanceId;
            return (
              <div
                key={card.instanceId}
                className="transition-all duration-200 hover:z-30 hover:!rotate-0 hover:!translate-y-[-1.5rem] hover:scale-110"
                style={{
                  transform: isDrag ? 'scale(0.95) opacity(0.5)' : `rotate(${angle}deg)`,
                  marginBottom: `-${yOffset}px`,
                  transformOrigin: 'bottom center',
                  zIndex: isHovered ? 30 : i,
                  opacity: isDrag ? 0.5 : 1,
                }}
                onMouseEnter={(e) => setHoveredCard({ cardCode: card.cardCode!, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => hoveredCard && setHoveredCard({ cardCode: card.cardCode!, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <HandCard
                  card={card}
                  canPlay={canPlay}
                  isSelected={selectedHandCard === card.instanceId}
                  isDragging={isDrag}
                  isNew={newCardIds.has(card.instanceId)}
                  comboActive={((gs as any).cardsPlayedThisTurn ?? 0) > 0}
                  onClick={() => handleHandCardClick(card)}
                  onPointerDown={(e) => handleCardPointerDown(e, card)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Opponent hovering indicator */}
      {opponentHovering && (
        <div className="fixed left-4 bottom-4 z-20 rounded bg-stone-800/80 px-3 py-1 text-xs text-stone-400">
          Opponent is thinking...
        </div>
      )}

      {/* Card hover preview — enlarged card on hover */}
      {hoveredCard && (() => {
        const def = getCard(hoveredCard.cardCode);
        if (!def) return null;
        const isMinion = def.type === 'MINION';
        const isWeapon = def.type === 'WEAPON';
        const isSpell = def.type === 'SPELL';
        const isLoc = def.type === 'LOCATION';
        const rColor = RARITY_COLORS[def.rarity];
        // Position: show to the left or right of cursor, above if near bottom
        const previewX = hoveredCard.x > window.innerWidth / 2 ? hoveredCard.x - 220 : hoveredCard.x + 20;
        const previewY = Math.min(hoveredCard.y - 60, window.innerHeight - 320);
        return (
          <div
            className="fixed z-[60] pointer-events-none"
            style={{ left: previewX, top: Math.max(8, previewY) }}
          >
            <div className={`w-[200px] rounded-xl border-2 overflow-hidden shadow-2xl
              ${isSpell ? 'bg-gradient-to-b from-indigo-900 via-violet-950 to-indigo-900'
                : isWeapon ? 'bg-gradient-to-b from-stone-800 via-stone-900 to-stone-800'
                : isLoc ? 'bg-gradient-to-b from-green-900 via-green-950 to-green-900'
                : 'bg-gradient-to-b from-stone-600 via-stone-700 to-stone-600'}`}
              style={{ borderColor: rColor }}
            >
              {/* Mana gem */}
              <div className="absolute top-1 left-1 z-10"><ManaGem value={def.manaCost} size={30} /></div>
              {/* Art */}
              <div className="w-full h-[120px] overflow-hidden">
                <CardArt cardCode={hoveredCard.cardCode} className="w-full h-full" />
              </div>
              {/* Name + rarity gem */}
              <div className="px-3 py-1.5 bg-black/30 border-y border-gray-600/30">
                <div className="flex items-center gap-1.5">
                  {def.rarity !== 'COMMON' && (
                    <div className="w-2.5 h-2.5 rotate-45 flex-shrink-0" style={{ backgroundColor: rColor, boxShadow: `0 0 4px ${rColor}80` }} />
                  )}
                  <span className="text-white font-bold text-sm block truncate">{def.name}</span>
                </div>
                <span className="text-gray-400 text-[10px]">
                  {def.type}
                  {def.rarity !== 'COMMON' ? ` · ` : ''}
                  {def.rarity !== 'COMMON' && <span style={{ color: rColor }}>{def.rarity}</span>}
                  {isMinion && def.minionType ? ` · ${def.minionType}` : ''}
                </span>
              </div>
              {/* Text */}
              {def.text && (
                <div className="px-3 py-2 bg-black/20 max-h-[80px] overflow-y-auto">
                  <p className="text-gray-200 text-xs leading-snug">{def.text}</p>
                </div>
              )}
              {def.flavor && (
                <div className="px-3 py-1 bg-black/10">
                  <p className="text-gray-500 text-[10px] italic leading-snug">{def.flavor}</p>
                </div>
              )}
              {/* Stats */}
              {(isMinion || isWeapon) && (
                <div className="flex justify-between px-3 py-1.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 border border-yellow-400 text-xs font-extrabold text-white">
                    {def.attack}
                  </span>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-extrabold text-white
                    ${isWeapon ? 'bg-gradient-to-br from-emerald-400 to-emerald-700 border-emerald-300' : 'bg-gradient-to-br from-red-500 to-red-800 border-red-400'}`}>
                    {def.health}
                  </span>
                </div>
              )}
              {/* Location durability */}
              {isLoc && (
                <div className="flex justify-center px-3 py-1.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 border border-emerald-300 text-xs font-extrabold text-white">
                    {def.health}
                  </span>
                </div>
              )}
            </div>
            {/* Keyword tooltips */}
            {def.keywords && def.keywords.length > 0 && (() => {
              const KW_DESC: Record<string, string> = {
                TAUNT: 'Enemies must attack this minion first.',
                CHARGE: 'Can attack immediately when played.',
                DIVINE_SHIELD: 'The first damage this minion takes is ignored.',
                BATTLECRY: 'Does something when you play it from your hand.',
                DEATHRATTLE: 'Does something when this minion dies.',
                FREEZE: 'Frozen characters lose their next attack.',
                WINDFURY: 'Can attack twice each turn.',
                STEALTH: 'Cannot be targeted until it attacks.',
                SECRET: 'Hidden until a specific action triggers it.',
                COMBO: 'A bonus if you already played a card this turn.',
                BOND: 'Gets a bonus when its partner is on the board.',
                ORRA_CHARGE: 'Gains a charge each turn. Triggers at max charges.',
                END_OF_TURN: 'Triggers at the end of your turn.',
              };
              const kws = def.keywords.filter((k: string) => KW_DESC[k]);
              if (kws.length === 0) return null;
              return (
                <div className="mt-1.5 bg-stone-900/95 border border-amber-700/40 rounded-lg px-3 py-2 max-w-[200px] shadow-xl">
                  {kws.map((kw: string) => (
                    <div key={kw} className="mb-1 last:mb-0">
                      <span className="text-amber-300 font-bold text-[10px]">
                        {kw === 'DIVINE_SHIELD' ? 'Divine Shield' :
                         kw === 'END_OF_TURN' ? 'End of Turn' :
                         kw === 'ORRA_CHARGE' ? 'Orra Charge' :
                         kw.charAt(0) + kw.slice(1).toLowerCase()}
                      </span>
                      <span className="text-gray-400 text-[9px] ml-1">
                        {KW_DESC[kw]}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* ═══ Pointer drag ghost — floating card/attack indicator ═══ */}
      {ptrDrag && ptrDrag.activated && (() => {
        const dragInfo = ptrDrag.info;
        if (dragInfo.kind === 'hand-card') {
          const card = gs.myHand.find(c => c.instanceId === dragInfo.cardInstanceId);
          const def = card ? getCard(card.cardCode) : undefined;
          return (
            <div
              className="pointer-events-none fixed z-[70]"
              style={{ left: ptrDrag.curX - 50, top: ptrDrag.curY - 70 }}
            >
              <div
                className="w-[100px] h-[140px] rounded-[10px] flex flex-col items-center overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.6)] relative"
                style={{
                  background: 'linear-gradient(to bottom, #3d2a14, #4a3520, #2a1a08)',
                  border: `3px solid ${def ? CLASS_COLORS[def.heroClass] || '#d4a520' : '#d4a520'}`,
                }}
              >
                {/* Card art fills the ghost */}
                {card?.cardCode && (
                  <div className="absolute inset-0 overflow-hidden rounded-[7px]">
                    <CardArt cardCode={card.cardCode} className="w-full h-full" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  </div>
                )}
                {/* Mana cost badge */}
                <div className="absolute -top-0.5 -left-0.5 z-10"><ManaGem value={def?.manaCost ?? 0} size={28} /></div>
                {/* Card name */}
                <div className="absolute bottom-5 left-0 right-0 text-[9px] font-bold text-white text-center px-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                  {def?.name ?? 'Card'}
                </div>
                {/* Minion stats */}
                {def?.type === 'MINION' && (
                  <>
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-700 border-2 border-yellow-300 text-[11px] font-black text-white flex items-center justify-center z-10">
                      {def.attack}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-red-800 border-2 border-red-400 text-[11px] font-black text-white flex items-center justify-center z-10">
                      {def.health}
                    </div>
                  </>
                )}
                {/* Weapon stats */}
                {def?.type === 'WEAPON' && (
                  <>
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 border-2 border-amber-300 text-[11px] font-black text-white flex items-center justify-center z-10">
                      {def.attack}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-stone-400 to-stone-600 border-2 border-stone-300 text-[11px] font-black text-white flex items-center justify-center z-10">
                      {def.health}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        } else {
          // Attack drag — no ghost, the attack arrow line provides visual feedback
          return null;
        }
      })()}
    </div>
  );
}
