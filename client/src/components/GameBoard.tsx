import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import type {
  ClientGameState,
  ClientCardInstance,
  BoardMinion,
  Weapon,
  CardDef,
  HeroClass,
  PendingInteraction,
  TargetOption,
} from '../../../shared/types';
import { HERO_POWER_COST, MAX_BOARD_SIZE } from '../../../shared/types';
import { useGameActions } from '../hooks/useGameActions';
import { CardArt } from '../utils/cardArt';
import cardsJson from '../../../data/cards.json';

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

// ─── Hero Power Descriptions ───
const HERO_POWER_DESC: Record<HeroClass, string> = {
  JIMMY: 'Fireblast: Deal 2 damage to any target',
  TALA: "Nature's Touch: Restore 2 health to any target",
  DEREK: 'Tinker: Draw a card',
  ANDERS: 'Frost Bolt: Deal 1 damage to a minion and Freeze it',
  DES: 'Dark Command: Deal 2 damage to a random enemy',
  ASTRID: 'Mighty Guard: Give a friendly minion Divine Shield',
  AVA: 'Deploy Drone: Summon a 1/1 Gadget Drone',
  LUCAS: 'Coyote Trick: Return a random enemy minion to hand',
  IZZY: 'Chart Course: Gain 2 Armor',
  NEUTRAL: 'Hero Power',
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

// ─── Hero Portrait SVGs ───
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
}

// ─── Targeting modes ───
type TargetingMode =
  | { type: 'none' }
  | { type: 'play-card'; cardInstanceId: string; cardDef: CardDef; position: number }
  | { type: 'attack'; attackerInstanceId: string }
  | { type: 'hero-power' }
  | { type: 'interaction'; interactionId: string };

// ─── Mulligan Screen ───
function MulliganScreen({
  hand,
  onConfirm,
  confirmed,
}: {
  hand: ClientCardInstance[];
  onConfirm: (replacements: boolean[]) => void;
  confirmed: boolean;
}) {
  const [replacing, setReplacing] = useState<boolean[]>(hand.map(() => false));

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
      <h2 className="mb-1 text-4xl font-extrabold text-amber-400 drop-shadow-lg tracking-wide">MULLIGAN</h2>
      <p className="mb-8 text-amber-200/60 text-sm">Click cards you want to replace</p>
      <div className="flex gap-5">
        {hand.map((c, i) => {
          const def = getCard(c.cardCode);
          return (
            <button
              key={c.instanceId}
              onClick={() => toggle(i)}
              className={`relative flex h-56 w-40 flex-col items-center rounded-xl border-2 overflow-hidden transition-all duration-200
                ${replacing[i]
                  ? 'border-red-500 opacity-40 grayscale scale-95'
                  : 'border-amber-500/70 hover:border-amber-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]'}
              `}
              style={{ background: 'linear-gradient(to bottom, #3d2a14, #2a1a08)' }}
            >
              {/* Mana gem */}
              <div className="absolute -left-1 -top-1 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-700 border-2 border-blue-300 text-sm font-extrabold text-white shadow-lg">
                {def?.manaCost ?? '?'}
              </div>
              {/* Card art — large */}
              <div className="w-full h-28 mt-1 overflow-hidden">
                {c.cardCode && <CardArt cardCode={c.cardCode} className="w-full h-full" />}
              </div>
              {/* Name */}
              <span className="text-[11px] font-bold text-amber-100 text-center leading-tight truncate w-full px-2 mt-1">
                {def?.name ?? 'Unknown'}
              </span>
              {/* Text */}
              <span className="text-[8px] text-amber-200/50 text-center leading-tight line-clamp-2 px-2 flex-1">{def?.text}</span>
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
              {/* Replace overlay */}
              {replacing[i] && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10">
                  <span className="text-5xl text-red-400 font-black">{'\u2715'}</span>
                  <span className="text-xs text-red-300 mt-1">REPLACING</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
      <button
        disabled={confirmed}
        onClick={() => onConfirm(replacing)}
        className={`mt-8 rounded-xl px-10 py-3 text-lg font-extrabold tracking-wide transition-all
          ${confirmed
            ? 'bg-stone-700 text-stone-500 cursor-not-allowed'
            : 'bg-gradient-to-b from-amber-400 to-amber-600 text-black hover:from-amber-300 hover:to-amber-500 hover:scale-105 shadow-[0_0_20px_rgba(245,158,11,0.3)] cursor-pointer'}
        `}
      >
        {confirmed ? 'Waiting for opponent...' : 'CONFIRM'}
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
  onDragStart,
  onDragEnd,
  onDrop,
  onDragOver,
}: {
  minion: BoardMinion;
  isMyMinion: boolean;
  canAct: boolean;
  hasSummoningSickness: boolean;
  isValidTarget: boolean;
  isSelected: boolean;
  onClick: () => void;
  animationClass?: string;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
}) {
  const def = getCard(minion.cardCode);
  const isDamaged = minion.currentHealth < minion.maxHealth;
  const isSilenced = minion.isSilenced;
  const hasTaunt = !isSilenced && def?.keywords.includes('TAUNT');
  const hasDivine = minion.hasDivineShield;
  const isFrozen = minion.isFrozen;
  const isStealth = minion.hasStealthUntilAttack;

  return (
    <button
      onClick={onClick}
      className={`relative w-[6.5rem] h-[7.5rem] select-none transition-all
        ${hasTaunt ? 'minion-oval-taunt' : 'minion-oval'}
        ${hasDivine && !isSilenced ? 'ring-2 ring-yellow-300 animate-pulse ring-offset-1 ring-offset-transparent' : ''}
        ${isFrozen ? 'brightness-75 saturate-50' : ''}
        ${isStealth ? 'opacity-40' : ''}
        ${canAct && isMyMinion ? 'shadow-[0_0_20px_6px_rgba(34,197,94,0.7)] cursor-pointer hover:scale-110 ring-[3px] ring-green-400/80' : ''}
        ${isMyMinion && !canAct && !isFrozen ? 'opacity-80' : ''}
        ${isValidTarget ? 'shadow-[0_0_12px_2px_rgba(34,197,94,0.7)] cursor-crosshair' : ''}
        ${isSelected ? 'ring-2 ring-green-400' : ''}
        ${animationClass ?? ''}
      `}
    >
      {/* Art fills entire oval — clip to oval shape */}
      <div className="absolute inset-0 bg-amber-900/80 overflow-hidden" style={{ borderRadius: '42%' }}>
        {minion.cardCode && <CardArt cardCode={minion.cardCode} className="w-full h-full" />}
      </div>

      {/* Frozen overlay */}
      {isFrozen && <div className="absolute inset-0 bg-blue-400/30 z-10" style={{ borderRadius: '42%' }} />}

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

      {/* Attack circle — bottom-left */}
      <div className="absolute -bottom-2 -left-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-700 border-2 border-yellow-300 text-sm font-extrabold text-white shadow-lg z-20">
        {minion.currentAttack}
      </div>
      {/* Health circle — bottom-right */}
      <div className={`absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-white shadow-lg z-20 border-2
        ${isDamaged ? 'bg-gradient-to-br from-red-500 to-red-700 border-red-300' : 'bg-gradient-to-br from-red-700 to-red-900 border-red-400'}
      `}>
        {minion.currentHealth}
      </div>
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
}) {
  const borderClass = CLASS_BORDER[heroClass];
  const bgClass = CLASS_BG[heroClass];
  const isDamaged = health < maxHealth;

  return (
    <div className="flex items-center gap-3">
      {/* Secrets (shown as ? badges above hero) */}
      {secretCount != null && secretCount > 0 && (
        <div className="flex gap-0.5">
          {Array.from({ length: secretCount }).map((_, i) => (
            <div key={i} className="w-7 h-7 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 border-2 border-amber-300 flex items-center justify-center text-white font-bold text-xs shadow-md">
              ?
            </div>
          ))}
        </div>
      )}
      {/* Weapon (left side) */}
      {weapon && (
        <div className={`flex h-16 w-16 flex-col items-center justify-center rounded-lg border-2 bg-stone-800
          ${canHeroAttack ? 'border-green-400 shadow-[0_0_12px_3px_rgba(34,197,94,0.6)]' : 'border-stone-600'}`}>
          <span className="text-xs text-stone-400">Weapon</span>
          <div className="flex gap-2 text-sm">
            <span className="font-bold text-amber-400">{weapon.currentAttack}</span>
            <span className="font-bold text-stone-300">{weapon.durability}</span>
          </div>
        </div>
      )}

      {/* Hero circle with character portrait */}
      <div className="relative">
        <button
          onClick={onHeroClick}
          className={`relative flex h-24 w-24 items-center justify-center rounded-full border-4 ${borderClass} ${bgClass} transition-all overflow-hidden
            ${isValidTarget ? 'shadow-[0_0_16px_4px_rgba(34,197,94,0.6)] cursor-crosshair' : ''}
            ${canHeroAttack ? 'shadow-[0_0_20px_6px_rgba(34,197,94,0.7)] ring-[3px] ring-green-400/80 cursor-pointer' : ''}
            ${!isValidTarget && !canHeroAttack && !isMyHero ? 'cursor-default' : ''}
            ${heroDamage ? 'animate-hero-damage animate-damage-shake' : ''}
          `}
        >
          {/* Character SVG portrait */}
          <div className="absolute inset-1 rounded-full overflow-hidden opacity-80">
            {HERO_PORTRAIT_SVG[heroClass]}
          </div>
          {/* HP overlay at bottom */}
          <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 text-lg font-bold z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${isDamaged ? 'text-red-400' : 'text-white'}`}>
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
      <button
        onClick={onHeroPowerClick}
        disabled={!canUseHeroPower}
        className={`group/hp relative flex h-14 w-14 items-center justify-center rounded-lg border-2 transition-all
          ${canUseHeroPower
            ? 'border-amber-500 bg-amber-900/40 hover:bg-amber-800/60 hover:scale-110 cursor-pointer'
            : 'border-stone-600 bg-stone-800 opacity-40 cursor-not-allowed'}
        `}
        title={HERO_POWER_DESC[heroClass]}
      >
        <span className={`pointer-events-none ${canUseHeroPower ? 'text-amber-300' : 'text-stone-500'}`}>
          {HERO_POWER_SVG[heroClass]}
        </span>
        <span className="pointer-events-none absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow">
          {HERO_POWER_COST}
        </span>
      </button>
    </div>
  );
}

// ─── Hand Card ───
function HandCard({
  card,
  canPlay,
  isSelected,
  isDragging,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  card: ClientCardInstance;
  canPlay: boolean;
  isSelected: boolean;
  isDragging?: boolean;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}) {
  const def = getCard(card.cardCode);
  if (!def) return null;

  return (
    <button
      onClick={onClick}
      draggable={canPlay}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group relative flex h-48 w-32 flex-shrink-0 flex-col items-center rounded-lg border-2 p-1 transition-all overflow-hidden
        ${isSelected
          ? 'border-green-400 bg-stone-600 -translate-y-6 scale-110 z-20 shadow-[0_0_20px_4px_rgba(34,197,94,0.5)]'
          : canPlay
            ? 'border-amber-500/70 bg-stone-700 hover:-translate-y-4 hover:scale-105 hover:z-10 cursor-pointer'
            : 'border-stone-500 bg-stone-700/60 opacity-60 cursor-not-allowed'}
        ${isDragging ? 'dragging-card' : ''}
      `}
    >
      {/* Mana cost */}
      <div className="absolute -left-1 -top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow">
        {def.manaCost}
      </div>
      {/* Card Art */}
      <div className="w-full h-16 mt-4 rounded overflow-hidden bg-stone-600/60 flex-shrink-0">
        <CardArt cardCode={card.cardCode!} className="w-full h-full" />
      </div>
      {/* Name */}
      <span className="text-[9px] font-semibold text-white leading-tight truncate w-full text-center mt-0.5 px-0.5">
        {def.name}
      </span>
      {/* Text */}
      <span className="text-[7px] text-stone-400 text-center leading-tight line-clamp-2 px-0.5 flex-1 min-h-0 overflow-hidden">
        {def.text}
      </span>
      {/* Stats */}
      {def.type === 'MINION' && (
        <div className="flex w-full justify-between px-0.5 shrink-0">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-700 border border-yellow-300 text-xs font-extrabold text-white shadow">
            {def.attack}
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-800 border border-red-400 text-xs font-extrabold text-white shadow">
            {def.health}
          </span>
        </div>
      )}
      {def.type === 'WEAPON' && (
        <div className="flex w-full justify-between px-0.5 shrink-0">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-700 border border-yellow-300 text-xs font-extrabold text-white shadow">
            {def.attack}
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 border border-emerald-300 text-xs font-extrabold text-white shadow">
            {def.health}
          </span>
        </div>
      )}
    </button>
  );
}

// ─── Card Backs (opponent hand) ───
function OpponentHand({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-center gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-24 w-16 rounded-lg border-2 border-amber-700 bg-gradient-to-b from-amber-800 to-amber-950 shadow-inner"
        />
      ))}
    </div>
  );
}

// ─── Orra Crystals ───
function ManaCrystals({ current, max }: { current: number; max: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-4 w-4 rounded-full border transition-colors
            ${i < current
              ? 'border-blue-400 bg-blue-500 shadow-[0_0_6px_1px_rgba(59,130,246,0.5)]'
              : 'border-stone-600 bg-stone-800'}
          `}
        />
      ))}
      <span className="ml-2 text-sm font-bold text-blue-400">
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
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
        </marker>
      </defs>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="#ef4444"
        strokeWidth="3"
        strokeDasharray="8 4"
        markerEnd="url(#arrowhead)"
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
}: GameBoardProps) {
  const actions = useGameActions();

  // ─── State ───
  const [targeting, setTargeting] = useState<TargetingMode>({ type: 'none' });
  const [selectedHandCard, setSelectedHandCard] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [attackerPos, setAttackerPos] = useState<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // ─── Animation state ───
  const [entranceIds, setEntranceIds] = useState<Set<string>>(new Set());
  const [damageIds, setDamageIds] = useState<Set<string>>(new Set());
  const [lungeId, setLungeId] = useState<string | null>(null);
  const [myHeroDamage, setMyHeroDamage] = useState(false);
  const [opHeroDamage, setOpHeroDamage] = useState(false);
  const prevMyBoardIds = useRef<Set<string>>(new Set());
  const prevOpBoardIds = useRef<Set<string>>(new Set());
  const prevHealthMap = useRef<Map<string, number>>(new Map());
  const prevMyHeroHp = useRef<number | null>(null);
  const prevOpHeroHp = useRef<number | null>(null);

  // ─── Drag-and-drop state ───
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [draggingCardType, setDraggingCardType] = useState<string | null>(null);
  const [dropZoneActive, setDropZoneActive] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const justDraggedRef = useRef(false);
  const pendingPlayRef = useRef<Set<string>>(new Set());

  // ─── Card hover preview state ───
  const [hoveredCard, setHoveredCard] = useState<{ cardCode: string; x: number; y: number } | null>(null);

  const isMyTurn = gs.currentPlayerIndex === gs.myPlayerIndex;
  const isPlaying = gs.phase === 'PLAYING';

  // Clear pending play guard when hand changes or pending interaction arrives
  useEffect(() => { pendingPlayRef.current.clear(); }, [gs.myHand]);
  useEffect(() => { if (gs.pendingInteraction) pendingPlayRef.current.clear(); }, [gs.pendingInteraction]);
  const isGameOver = gs.winner !== null;
  const myBoard = gs.myBoard;
  const opBoard = gs.opponent.board;

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

  // ─── Animation detection: new minions, damage, hero damage ───
  useEffect(() => {
    // Detect new minions on board → entrance animation
    const newEntrance = new Set<string>();
    for (const m of myBoard) {
      if (!prevMyBoardIds.current.has(m.instanceId)) newEntrance.add(m.instanceId);
    }
    for (const m of opBoard) {
      if (!prevOpBoardIds.current.has(m.instanceId)) newEntrance.add(m.instanceId);
    }
    if (newEntrance.size > 0) {
      setEntranceIds(newEntrance);
      setTimeout(() => setEntranceIds(new Set()), 400);
    }

    // Detect minion damage → shake animation
    const newDamage = new Set<string>();
    for (const m of [...myBoard, ...opBoard]) {
      const prev = prevHealthMap.current.get(m.instanceId);
      if (prev !== undefined && m.currentHealth < prev) {
        newDamage.add(m.instanceId);
      }
    }
    if (newDamage.size > 0) {
      setDamageIds(newDamage);
      setTimeout(() => setDamageIds(new Set()), 400);
    }

    // Detect hero damage → flash animation
    if (prevMyHeroHp.current !== null && gs.myHealth < prevMyHeroHp.current) {
      setMyHeroDamage(true);
      setTimeout(() => setMyHeroDamage(false), 400);
    }
    if (prevOpHeroHp.current !== null && gs.opponent.health < prevOpHeroHp.current) {
      setOpHeroDamage(true);
      setTimeout(() => setOpHeroDamage(false), 400);
    }

    // Update previous state refs
    prevMyBoardIds.current = new Set(myBoard.map(m => m.instanceId));
    prevOpBoardIds.current = new Set(opBoard.map(m => m.instanceId));
    const hMap = new Map<string, number>();
    for (const m of [...myBoard, ...opBoard]) hMap.set(m.instanceId, m.currentHealth);
    prevHealthMap.current = hMap;
    prevMyHeroHp.current = gs.myHealth;
    prevOpHeroHp.current = gs.opponent.health;
  }, [myBoard, opBoard, gs.myHealth, gs.opponent.health]);

  // Track mouse for attack arrows
  useEffect(() => {
    if (targeting.type !== 'attack') return;
    const handler = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [targeting.type]);

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
    return new Set();
  }, [targeting, pendingTarget, opBoard, gs.myPlayerIndex]);

  // ─── Cancel targeting ───
  const cancelTargeting = useCallback(() => {
    setTargeting({ type: 'none' });
    setSelectedHandCard(null);
    setAttackerPos(null);
  }, []);

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

      if (selectedHandCard === card.instanceId) {
        cancelTargeting();
        return;
      }

      setSelectedHandCard(card.instanceId);

      // Spells and weapons play on click — server may respond with needs-target
      pendingPlayRef.current.add(card.instanceId);
      actions.playCard(card.instanceId);
    },
    [isMyTurn, isPlaying, isGameOver, gs.myMana, selectedHandCard, actions, cancelTargeting]
  );

  // ─── Handle board minion click ───
  const handleMyMinionClick = useCallback(
    (minion: BoardMinion, e: React.MouseEvent) => {
      if (!isMyTurn || !isPlaying || isGameOver) return;

      // If in targeting mode from interaction, select this as target
      if (pendingTarget && validTargetIds.has(minion.instanceId)) {
        if (pendingTarget.interactionId.startsWith('needs-target-')) {
          const cardInstanceId = pendingTarget.interactionId.replace('needs-target-', '');
          actions.playCard(cardInstanceId, undefined, minion.instanceId);
        } else {
          actions.playCard('__resolve_target__', undefined, minion.instanceId);
        }
        cancelTargeting();
        return;
      }

      if (targeting.type === 'attack') {
        // Can't attack own minion
        cancelTargeting();
        return;
      }

      if (minion.canAttack && minion.attacksRemaining > 0 && minion.currentAttack > 0) {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setAttackerPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        setTargeting({ type: 'attack', attackerInstanceId: minion.instanceId });
      }
    },
    [isMyTurn, isPlaying, isGameOver, targeting, pendingTarget, validTargetIds, actions, cancelTargeting]
  );

  // ─── Handle enemy target click ───
  const handleEnemyTargetClick = useCallback(
    (targetId: string) => {
      if (pendingTarget && validTargetIds.has(targetId)) {
        // Check if this is a needs-target interaction (card replay with target)
        if (pendingTarget.interactionId.startsWith('needs-target-')) {
          const cardInstanceId = pendingTarget.interactionId.replace('needs-target-', '');
          actions.playCard(cardInstanceId, undefined, targetId);
        } else {
          import('../socket').then(({ socket }) => {
            socket.emit('resolve-target', {
              interactionId: pendingTarget.interactionId,
              targetId,
            });
          });
        }
        cancelTargeting();
        return;
      }

      if (targeting.type === 'attack' && validTargetIds.has(targetId)) {
        const attackerId = targeting.attackerInstanceId;
        // Show lunge animation, then send attack after short delay
        setLungeId(attackerId);
        cancelTargeting();
        setTimeout(() => {
          actions.attackTarget(attackerId, targetId);
          setLungeId(null);
        }, 250);
      }
    },
    [targeting, pendingTarget, validTargetIds, actions, cancelTargeting]
  );

  // ─── Hero Power ───
  const handleHeroPower = useCallback(() => {
    if (!isMyTurn || !isPlaying || gs.myHeroPowerUsed || gs.myMana < HERO_POWER_COST) return;
    actions.heroPower();
    // Server may respond with pendingInteraction if it needs a target
  }, [isMyTurn, isPlaying, gs.myHeroPowerUsed, gs.myMana, actions]);

  // ─── End Turn ───
  const handleEndTurn = useCallback(() => {
    if (!isMyTurn || !isPlaying) return;
    cancelTargeting();
    actions.endTurn();
  }, [isMyTurn, isPlaying, actions, cancelTargeting]);

  // ─── Concede ───
  const handleConcede = useCallback(() => {
    actions.concede();
    setMenuOpen(false);
  }, [actions]);

  // ─── Drag-and-drop handlers (with position tracking) ───
  const handleDragStart = useCallback((e: React.DragEvent, card: ClientCardInstance) => {
    const def = getCard(card.cardCode);
    e.dataTransfer.setData('text/plain', card.instanceId);
    e.dataTransfer.setData('card-type', def?.type ?? '');
    e.dataTransfer.effectAllowed = 'move';
    setDraggingCardId(card.instanceId);
    setDraggingCardType(def?.type ?? null);
  }, []);

  const handleDragEnd = useCallback(() => {
    justDraggedRef.current = true;
    setTimeout(() => { justDraggedRef.current = false; }, 100);
    setDraggingCardId(null);
    setDraggingCardType(null);
    setDropZoneActive(false);
    setDropIndex(null);
  }, []);

  const handleBoardDragOver = useCallback((e: React.DragEvent) => {
    if (!draggingCardId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropZoneActive(true);

    // Compute drop index from cursor position relative to existing minions
    const container = e.currentTarget;
    const minionEls = container.querySelectorAll('[data-minion-index]');
    let idx = myBoard.length;
    for (let i = 0; i < minionEls.length; i++) {
      const rect = minionEls[i].getBoundingClientRect();
      if (e.clientX < rect.left + rect.width / 2) {
        idx = parseInt(minionEls[i].getAttribute('data-minion-index') || String(i));
        break;
      }
    }
    setDropIndex(idx);
  }, [draggingCardId, myBoard.length]);

  const handleBoardDragLeave = useCallback(() => {
    setDropZoneActive(false);
    setDropIndex(null);
  }, []);

  const handleBoardDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropZoneActive(false);
    // Only process if we initiated a drag from our hand
    if (!draggingCardId) return;
    const cardId = e.dataTransfer.getData('text/plain');
    if (!cardId) return;

    const card = gs.myHand.find(c => c.instanceId === cardId);
    if (!card) return;

    const def = getCard(card.cardCode);
    if (!def || def.manaCost > gs.myMana) return;
    if (def.type === 'MINION' && myBoard.length >= MAX_BOARD_SIZE) return;

    if (pendingPlayRef.current.has(card.instanceId)) return;
    pendingPlayRef.current.add(card.instanceId);

    if (def.type === 'MINION') {
      if (myBoard.length >= MAX_BOARD_SIZE) return;
      const pos = dropIndex ?? myBoard.length;
      actions.playCard(card.instanceId, pos);
    } else {
      // Spells/weapons dropped on the board play without a target
      actions.playCard(card.instanceId);
    }
    setDraggingCardId(null);
    setDraggingCardType(null);
    setDropIndex(null);
  }, [gs.myHand, gs.myMana, myBoard.length, actions, dropIndex]);

  // ─── Drop spell/weapon on a target (minion or hero) ───
  const handleTargetDragOver = useCallback((e: React.DragEvent) => {
    if (!draggingCardId || draggingCardType === 'MINION') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, [draggingCardId, draggingCardType]);

  const handleTargetDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const cardId = e.dataTransfer.getData('text/plain');
    if (!cardId) return;

    // Prevent double-play
    if (pendingPlayRef.current.has(cardId)) return;

    const card = gs.myHand.find(c => c.instanceId === cardId);
    if (!card) return;

    const def = getCard(card.cardCode);
    if (!def || def.manaCost > gs.myMana) return;
    // Only spells and weapons can be drag-targeted
    if (def.type === 'MINION') return;

    pendingPlayRef.current.add(cardId);
    actions.playCard(card.instanceId, undefined, targetId);
    setDraggingCardId(null);
    setDraggingCardType(null);
    setDropIndex(null);
  }, [gs.myHand, gs.myMana, actions]);

  // ─── Get animation class for a minion ───
  const getMinionAnim = useCallback((instanceId: string, isMyMinion: boolean): string | undefined => {
    if (entranceIds.has(instanceId)) return 'animate-minion-entrance';
    if (damageIds.has(instanceId)) return 'animate-damage-shake';
    if (lungeId === instanceId) return isMyMinion ? 'animate-attack-lunge-up' : 'animate-attack-lunge-down';
    return undefined;
  }, [entranceIds, damageIds, lungeId]);

  // ─── Dynamic board scaling ───
  const myBoardScale = myBoard.length <= 5 ? 1 : Math.max(0.7, 5.5 / myBoard.length);
  const opBoardScale = opBoard.length <= 5 ? 1 : Math.max(0.7, 5.5 / opBoard.length);

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
        />
      </div>
    );
  }

  // ─── Game Over overlay ───
  const GameOverOverlay = isGameOver ? (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
      <h1
        className={`mb-4 text-5xl font-bold animate-victory-title ${gs.winner === gs.myPlayerId ? 'text-amber-400' : 'text-red-500'}`}
      >
        {gs.winner === gs.myPlayerId ? 'VICTORY' : 'DEFEAT'}
      </h1>
      <p className="mb-2 text-stone-300">
        {gs.winReason === 'concede'
          ? 'Opponent conceded'
          : gs.winReason === 'fatigue'
            ? 'Death by fatigue'
            : 'Hero destroyed'}
      </p>
      <div className="mt-6">
        <button
          onClick={onLeaveGame}
          className="rounded-lg bg-amber-500 px-8 py-3 font-bold text-black hover:bg-amber-400 transition-all hover:scale-105"
        >
          Leave
        </button>
      </div>
    </div>
  ) : null;

  // ─── Interaction overlay (pending target) ───
  const InteractionOverlay = pendingTarget ? (
    <div className="fixed left-1/2 top-4 z-40 -translate-x-1/2 rounded-lg bg-amber-900/90 px-6 py-3 text-center shadow-lg">
      <p className="text-lg font-bold text-amber-300">{pendingTarget.prompt}</p>
      <p className="text-sm text-amber-200/70">Click a valid target (glowing green)</p>
      {pendingTarget.allowSkip && (
        <button
          onClick={() => {
            import('../socket').then(({ socket }) => {
              socket.emit('resolve-target', {
                interactionId: pendingTarget.interactionId,
                targetId: null,
              });
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

  // ─── Drop zone placeholder ───
  const dropPlaceholder = (
    <div className="w-4 h-[5.5rem] rounded-lg bg-green-500/20 border-2 border-dashed border-green-400/60 animate-pulse flex-shrink-0" />
  );

  return (
    <div
      ref={boardRef}
      className="relative flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: 'linear-gradient(to bottom, #1a0f05, #2d1e0e 6%, #4a3520 15%, #5c4528 30%, #6b5232 45%, #725838 50%, #6b5232 55%, #5c4528 70%, #4a3520 85%, #2d1e0e 94%, #1a0f05)' }}
    >
      {GameOverOverlay}
      {InteractionOverlay}

      {/* Attack arrow */}
      {targeting.type === 'attack' && attackerPos && (
        <AttackArrow from={attackerPos} to={mousePos} />
      )}

      {/* Opponent Emote */}
      {opponentEmote && (
        <div className="fixed right-8 top-24 z-30 animate-bounce rounded-lg bg-stone-800 px-4 py-2 text-2xl shadow-lg">
          {opponentEmote}
        </div>
      )}

      {/* ═══ Top-right controls: Menu ═══ */}
      <div className="absolute right-4 top-4 z-30">
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg bg-stone-800/80 px-3 py-2 text-sm text-stone-300 hover:bg-stone-700"
          >
            Menu
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-40 rounded-lg border border-stone-700 bg-stone-800 py-1 shadow-xl">
              <button
                onClick={() => { setMuted(!muted); }}
                className="w-full px-4 py-2 text-left text-sm text-stone-300 hover:bg-stone-700"
              >
                {muted ? '\uD83D\uDD07 Unmute' : '\uD83D\uDD0A Mute'}
              </button>
              <button
                onClick={handleConcede}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-stone-700"
              >
                Concede
              </button>
              <button
                onClick={() => setMenuOpen(false)}
                className="w-full px-4 py-2 text-left text-sm text-stone-400 hover:bg-stone-700"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* OPPONENT AREA (top half) */}
      {/* ═══════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col items-center px-4 pt-2 pb-0">
        {/* Opponent hand */}
        <OpponentHand count={gs.opponent.handCount} />

        {/* Opponent hero row: [Mana] [Hero+Power] — right under hand */}
        <div
          className="flex items-center justify-center w-full gap-4"
          onDragOver={handleTargetDragOver}
          onDrop={(e) => handleTargetDrop(e, `hero-${1 - gs.myPlayerIndex}`)}
        >
          <ManaCrystals current={gs.opponent.mana} max={gs.opponent.maxMana} />
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
            onHeroClick={() => handleEnemyTargetClick(`hero-${1 - gs.myPlayerIndex}`)}
            heroDamage={opHeroDamage}
            secretCount={gs.opponent.secretCount}
          />
        </div>

        {/* Spacer — pushes board toward center divider */}
        <div className="flex-1" />

        {/* Opponent board — dynamic scaling */}
        <div className="flex min-h-[7rem] items-center justify-center board-field">
          <div
            className="flex items-center justify-center gap-1 max-w-[52rem]"
            style={opBoardScale < 1 ? { transform: `scale(${opBoardScale})`, transformOrigin: 'center center' } : undefined}
          >
            {opBoard.map((m) => (
              <div
                key={m.instanceId}
                style={{ flex: '0 1 7rem' }}
                onDragOver={handleTargetDragOver}
                onDrop={(e) => handleTargetDrop(e, m.instanceId)}
                onMouseEnter={(e) => setHoveredCard({ cardCode: m.cardCode, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <BoardMinionCard
                  minion={m}
                  isMyMinion={false}
                  canAct={false}
                  hasSummoningSickness={false}
                  isValidTarget={validTargetIds.has(m.instanceId) || (draggingCardType === 'SPELL' && !!draggingCardId)}
                  isSelected={false}
                  onClick={() => handleEnemyTargetClick(m.instanceId)}
                  animationClass={getMinionAnim(m.instanceId, false)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* GOLD DIVIDER (absolutely centered) */}
      {/* ═══════════════════════════════════════════ */}
      <div className="absolute left-0 right-24 top-1/2 -translate-y-1/2 z-10 px-8">
        <div className="h-[3px] bg-gradient-to-r from-amber-700/20 via-amber-500/80 to-amber-700/20 shadow-[0_0_6px_rgba(245,158,11,0.3)]" />
      </div>

      {/* ═══ Right sidebar: Deck → End Turn → Timer → Deck (absolutely positioned) ═══ */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2">
        {/* Opponent deck (above) */}
        <DeckPile count={gs.opponentDeckCount} graveyardCount={gs.opponent.graveyardCount} />

        {/* End Turn button */}
        <button
          onClick={handleEndTurn}
          disabled={!isMyTurn || !isPlaying}
          className={`w-20 h-20 rounded-xl font-bold text-[11px] leading-tight text-center transition-all
            ${isMyTurn && isPlaying
              ? 'bg-gradient-to-b from-amber-500 to-yellow-600 text-black shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:from-amber-400 hover:to-yellow-500 active:scale-95 animate-end-turn-glow'
              : 'bg-stone-700 text-stone-500 cursor-not-allowed'}
          `}
        >
          {isMyTurn ? <>END{'\n'}TURN</> : <>ENEMY{'\n'}TURN</>}
        </button>

        {/* Timer bar */}
        {isMyTurn && timeLeft !== null && timeLeft <= 20 && (
          <div className="w-16 h-1.5 rounded-full bg-stone-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                timeLeft <= 5 ? 'bg-red-500 animate-pulse' : timeLeft <= 10 ? 'bg-orange-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${(timeLeft / 20) * 100}%` }}
            />
          </div>
        )}

        {/* My deck (below) */}
        <DeckPile count={gs.deckCount} graveyardCount={gs.myGraveyardCount} />
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* MY AREA (entire bottom half is drop zone) */}
      {/* ═══════════════════════════════════════════ */}
      <div
        className={`flex flex-1 flex-col items-center px-4 pt-0 pb-2 transition-all ${dropZoneActive ? 'bg-green-500/5' : ''}`}
        onDragOver={handleBoardDragOver}
        onDragLeave={handleBoardDragLeave}
        onDrop={handleBoardDrop}
      >
        {/* My board (minion positions) */}
        <div
          className={`flex min-h-[7rem] items-center justify-center rounded-lg board-field ${dropZoneActive ? 'drop-zone-active border-2 border-dashed border-green-500/40' : 'border-2 border-transparent'}`}
        >
          <div
            className="flex items-center justify-center gap-1 max-w-[52rem]"
            style={myBoardScale < 1 ? { transform: `scale(${myBoardScale})`, transformOrigin: 'bottom center' } : undefined}
          >
            {myBoard.map((m, i) => (
              <Fragment key={m.instanceId}>
                {dropIndex === i && dropPlaceholder}
                <div
                  data-minion-index={i}
                  style={{ flex: '0 1 7rem' }}
                  onDragOver={draggingCardType === 'SPELL' ? handleTargetDragOver : undefined}
                  onDrop={draggingCardType === 'SPELL' ? (e) => handleTargetDrop(e, m.instanceId) : undefined}
                  onMouseEnter={(e) => setHoveredCard({ cardCode: m.cardCode, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <BoardMinionCard
                    minion={m}
                    isMyMinion={true}
                    canAct={isMyTurn && m.canAttack && m.attacksRemaining > 0 && m.currentAttack > 0}
                    hasSummoningSickness={isMyTurn && !m.canAttack && m.currentAttack > 0 && !m.isFrozen}
                    isValidTarget={validTargetIds.has(m.instanceId) || (draggingCardType === 'SPELL' && !!draggingCardId)}
                    isSelected={targeting.type === 'attack' && targeting.attackerInstanceId === m.instanceId}
                    onClick={(e?: any) => handleMyMinionClick(m, e)}
                    animationClass={getMinionAnim(m.instanceId, true)}
                  />
                </div>
              </Fragment>
            ))}
            {dropIndex === myBoard.length && dropPlaceholder}
          </div>
        </div>

        {/* Spacer — pushes board toward center, hero+hand toward bottom */}
        <div className="flex-1" />

        {/* My hero row: [Mana] [Hero+Power] — right above hand */}
        <div
          className="flex items-center justify-center w-full gap-4"
          onDragOver={handleTargetDragOver}
          onDrop={(e) => handleTargetDrop(e, `hero-${gs.myPlayerIndex}`)}
        >
          <ManaCrystals current={gs.myMana} max={gs.myMaxMana} />
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
            canHeroAttack={isMyTurn && isPlaying && !!gs.myWeapon && gs.myWeapon.currentAttack > 0}
            isValidTarget={validTargetIds.has(`hero-${gs.myPlayerIndex}`)}
            onHeroPowerClick={handleHeroPower}
            onHeroClick={(e?: React.MouseEvent) => {
              // If being targeted by a spell/attack interaction, handle as target
              if (validTargetIds.has(`hero-${gs.myPlayerIndex}`)) {
                handleEnemyTargetClick(`hero-${gs.myPlayerIndex}`);
                return;
              }
              // If I have a weapon and it's my turn, initiate hero attack
              if (isMyTurn && isPlaying && gs.myWeapon && gs.myWeapon.currentAttack > 0) {
                if (targeting.type === 'attack') {
                  cancelTargeting();
                  return;
                }
                const el = e?.currentTarget as HTMLElement | undefined;
                if (el) {
                  const rect = el.getBoundingClientRect();
                  setAttackerPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                }
                setTargeting({ type: 'attack', attackerInstanceId: `hero-${gs.myPlayerIndex}` });
              }
            }}
            heroDamage={myHeroDamage}
            secretCount={gs.mySecrets?.length ?? 0}
          />
        </div>

        {/* My hand */}
        <div className="flex items-end justify-center gap-1 pb-1">
          {gs.myHand.map((card) => {
            const def = getCard(card.cardCode);
            const canPlay = isMyTurn && isPlaying && !isGameOver && (def?.manaCost ?? 99) <= gs.myMana
              && (def?.type !== 'MINION' || myBoard.length < MAX_BOARD_SIZE);
            return (
              <div
                key={card.instanceId}
                onMouseEnter={(e) => setHoveredCard({ cardCode: card.cardCode!, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => hoveredCard && setHoveredCard({ cardCode: card.cardCode!, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <HandCard
                  card={card}
                  canPlay={canPlay}
                  isSelected={selectedHandCard === card.instanceId}
                  isDragging={draggingCardId === card.instanceId}
                  onClick={() => handleHandCardClick(card)}
                  onDragStart={(e) => handleDragStart(e, card)}
                  onDragEnd={handleDragEnd}
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
        // Position: show to the left or right of cursor, above if near bottom
        const previewX = hoveredCard.x > window.innerWidth / 2 ? hoveredCard.x - 220 : hoveredCard.x + 20;
        const previewY = Math.min(hoveredCard.y - 60, window.innerHeight - 320);
        return (
          <div
            className="fixed z-[60] pointer-events-none"
            style={{ left: previewX, top: Math.max(8, previewY) }}
          >
            <div className={`w-[200px] rounded-xl border-2 overflow-hidden shadow-2xl
              ${isSpell ? 'border-violet-500 bg-gradient-to-b from-indigo-900 via-violet-950 to-indigo-900'
                : isWeapon ? 'border-amber-500 bg-gradient-to-b from-stone-800 via-stone-900 to-stone-800'
                : 'border-amber-500/70 bg-gradient-to-b from-stone-600 via-stone-700 to-stone-600'}`}
            >
              {/* Mana gem */}
              <div className="absolute top-1 left-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-700 border-2 border-blue-300 text-sm font-extrabold text-white shadow-lg">
                {def.manaCost}
              </div>
              {/* Art */}
              <div className="w-full h-[120px] overflow-hidden">
                <CardArt cardCode={hoveredCard.cardCode} className="w-full h-full" />
              </div>
              {/* Name */}
              <div className="px-3 py-1.5 bg-black/30 border-y border-gray-600/30">
                <span className="text-white font-bold text-sm block truncate">{def.name}</span>
                <span className="text-gray-400 text-[10px]">{def.type}{def.rarity !== 'COMMON' ? ` · ${def.rarity}` : ''}</span>
              </div>
              {/* Text */}
              {def.text && (
                <div className="px-3 py-2 bg-black/20">
                  <p className="text-gray-200 text-xs leading-snug">{def.text}</p>
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
            </div>
          </div>
        );
      })()}
    </div>
  );
}
