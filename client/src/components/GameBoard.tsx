import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

// ─── Props ───
interface GameBoardProps {
  gameState: ClientGameState;
  opponentHovering: boolean;
  opponentEmote: string | null;
  rematchState: string;
  onRematchStateChange: (s: string) => void;
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
      <h2 className="mb-2 text-3xl font-bold text-amber-400">Mulligan Phase</h2>
      <p className="mb-8 text-gray-300">Click cards to replace them, then confirm.</p>
      <div className="flex gap-4">
        {hand.map((c, i) => {
          const def = getCard(c.cardCode);
          return (
            <button
              key={c.instanceId}
              onClick={() => toggle(i)}
              className={`relative flex h-52 w-36 flex-col items-center justify-between rounded-lg border-2 p-3 transition-all
                ${replacing[i]
                  ? 'border-red-500 bg-gray-800/60 opacity-50 grayscale'
                  : 'border-amber-500 bg-gray-800 hover:border-amber-300 hover:scale-105'}
              `}
            >
              {/* Mana */}
              <div className="absolute -left-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {def?.manaCost ?? '?'}
              </div>
              <span className="mt-4 text-center text-sm font-semibold text-white">
                {def?.name ?? 'Unknown'}
              </span>
              <span className="text-xs text-gray-400 text-center px-1">{def?.text}</span>
              {def?.type === 'MINION' && (
                <div className="flex w-full justify-between px-1 text-sm">
                  <span className="font-bold text-amber-400">{def.attack}</span>
                  <span className="font-bold text-red-400">{def.health}</span>
                </div>
              )}
              {replacing[i] && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl text-red-400">✕</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
      <button
        disabled={confirmed}
        onClick={() => onConfirm(replacing)}
        className={`mt-8 rounded-lg px-8 py-3 text-lg font-bold transition-all
          ${confirmed
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-amber-500 text-black hover:bg-amber-400 hover:scale-105'}
        `}
      >
        {confirmed ? 'Waiting for opponent...' : 'Confirm Mulligan'}
      </button>
    </div>
  );
}

// ─── Minion Card on Board ───
function BoardMinionCard({
  minion,
  isMyMinion,
  canAct,
  isValidTarget,
  isSelected,
  onClick,
}: {
  minion: BoardMinion;
  isMyMinion: boolean;
  canAct: boolean;
  isValidTarget: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const def = getCard(minion.cardCode);
  const isDamaged = minion.currentHealth < minion.maxHealth;
  const isSilenced = minion.isSilenced;
  const hasTaunt = !isSilenced && def?.keywords.includes('TAUNT');
  const hasDivine = minion.hasDivineShield;
  const isFrozen = minion.isFrozen;
  const isStealth = minion.hasStealthUntilAttack;
  const hasDeathrattle = !isSilenced && def?.keywords.includes('DEATHRATTLE');
  const hasWindfury = !isSilenced && def?.keywords.includes('WINDFURY');

  return (
    <button
      onClick={onClick}
      className={`relative flex h-28 w-22 flex-col items-center rounded-lg border-2 p-1 transition-all select-none overflow-hidden
        ${hasTaunt ? 'border-[3px] border-amber-600 rounded-xl shadow-[inset_0_0_6px_rgba(217,119,6,0.4)]' : 'border-gray-600'}
        ${hasDivine && !isSilenced ? 'ring-2 ring-yellow-300 animate-pulse ring-offset-1 ring-offset-transparent' : ''}
        ${isFrozen ? 'bg-blue-900/70' : 'bg-gray-800'}
        ${isStealth ? 'opacity-40 shadow-[0_0_8px_2px_rgba(0,0,0,0.8)]' : ''}
        ${canAct && isMyMinion ? 'shadow-[0_0_12px_2px_rgba(34,197,94,0.5)] cursor-pointer hover:scale-110' : ''}
        ${isValidTarget ? 'shadow-[0_0_12px_2px_rgba(34,197,94,0.7)] cursor-crosshair' : ''}
        ${isSelected ? 'ring-2 ring-green-400' : ''}
      `}
    >
      {/* Frozen overlay */}
      {isFrozen && (
        <div className="absolute inset-0 bg-blue-400/20 pointer-events-none z-10 flex items-start justify-center">
          <span className="text-[10px] mt-0.5 opacity-80">❄</span>
        </div>
      )}

      {/* Silenced overlay */}
      {isSilenced && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <span className="text-red-500 text-2xl font-black opacity-60 leading-none">✕</span>
        </div>
      )}

      {/* Windfury indicator */}
      {hasWindfury && (
        <span className="absolute top-0.5 right-0.5 text-[10px] z-10 opacity-80" title="Windfury">≈</span>
      )}

      {/* Card art area */}
      <div className="w-full h-10 rounded overflow-hidden bg-gray-700/50 flex-shrink-0">
        {minion.cardCode && (
          <CardArt cardCode={minion.cardCode} className="w-full h-full" />
        )}
      </div>

      {/* Minion name */}
      <span className={`text-[9px] font-bold text-center leading-tight truncate w-full mt-0.5 ${isSilenced ? 'text-gray-500' : 'text-gray-200'}`}>
        {def?.name ?? '??'}
      </span>

      {/* Spacer to push stats to bottom */}
      <div className="flex-1" />

      {/* Attack / Health stat circles */}
      <div className="flex w-full justify-between px-0.5 pb-0.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-700 text-xs font-bold text-white shadow-md">
          {minion.currentAttack}
        </span>

        {/* Deathrattle indicator (bottom center) */}
        {hasDeathrattle && (
          <span className="flex items-end text-[10px] opacity-80" title="Deathrattle">☠</span>
        )}

        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow-md
            ${isDamaged ? 'bg-red-600' : 'bg-red-800'}
          `}
        >
          {minion.currentHealth}
        </span>
      </div>
    </button>
  );
}

// ─── Hero Portrait ───
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
  isValidTarget,
  onHeroPowerClick,
  onHeroClick,
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
  isValidTarget: boolean;
  onHeroPowerClick: () => void;
  onHeroClick: () => void;
}) {
  const borderClass = CLASS_BORDER[heroClass];
  const bgClass = CLASS_BG[heroClass];
  const isDamaged = health < maxHealth;

  return (
    <div className="flex items-center gap-3">
      {/* Weapon (left side) */}
      {weapon && (
        <div className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border-2 border-gray-500 bg-gray-800">
          <span className="text-xs text-gray-400">Weapon</span>
          <div className="flex gap-2 text-sm">
            <span className="font-bold text-amber-400">{weapon.currentAttack}</span>
            <span className="font-bold text-gray-300">{weapon.durability}</span>
          </div>
        </div>
      )}

      {/* Hero circle */}
      <button
        onClick={onHeroClick}
        className={`relative flex h-20 w-20 flex-col items-center justify-center rounded-full border-4 ${borderClass} ${bgClass} transition-all
          ${isValidTarget ? 'shadow-[0_0_16px_4px_rgba(34,197,94,0.6)] cursor-crosshair' : ''}
          ${!isValidTarget && !isMyHero ? 'cursor-default' : ''}
        `}
      >
        <span className="text-[10px] font-medium text-gray-300 uppercase tracking-wide">
          {heroClass}
        </span>
        <span className={`text-2xl font-bold ${isDamaged ? 'text-red-400' : 'text-white'}`}>
          {health}
        </span>
        {armor > 0 && (
          <div className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-gray-500 text-xs font-bold text-white">
            {armor}
          </div>
        )}
      </button>

      {/* Hero Power */}
      <button
        onClick={onHeroPowerClick}
        disabled={!canUseHeroPower}
        className={`flex h-14 w-14 flex-col items-center justify-center rounded-lg border-2 transition-all
          ${canUseHeroPower
            ? 'border-amber-500 bg-amber-900/40 hover:bg-amber-800/60 hover:scale-110 cursor-pointer'
            : 'border-gray-600 bg-gray-800 opacity-40 cursor-not-allowed'}
        `}
      >
        <span className="text-[9px] text-gray-300">Power</span>
        <span className="text-sm font-bold text-blue-400">{HERO_POWER_COST}</span>
      </button>
    </div>
  );
}

// ─── Hand Card ───
function HandCard({
  card,
  canPlay,
  isSelected,
  onClick,
}: {
  card: ClientCardInstance;
  canPlay: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const def = getCard(card.cardCode);
  if (!def) return null;

  return (
    <button
      onClick={onClick}
      className={`group relative flex h-44 w-28 flex-shrink-0 flex-col items-center justify-between rounded-lg border-2 p-2 transition-all
        ${isSelected
          ? 'border-green-400 bg-gray-700 -translate-y-6 scale-110 z-20 shadow-[0_0_20px_4px_rgba(34,197,94,0.5)]'
          : canPlay
            ? 'border-amber-500/70 bg-gray-800 hover:-translate-y-4 hover:scale-105 hover:z-10 cursor-pointer'
            : 'border-gray-600 bg-gray-800/60 opacity-60 cursor-not-allowed'}
      `}
    >
      {/* Mana cost */}
      <div className="absolute -left-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow">
        {def.manaCost}
      </div>
      {/* Name */}
      <span className="mt-3 text-center text-[11px] font-semibold text-white leading-tight">
        {def.name}
      </span>
      {/* Text */}
      <span className="text-[9px] text-gray-400 text-center leading-tight line-clamp-3 px-0.5">
        {def.text}
      </span>
      {/* Type badge */}
      <span className="text-[8px] uppercase tracking-wider text-gray-500">{def.type}</span>
      {/* Stats */}
      {def.type === 'MINION' && (
        <div className="flex w-full justify-between px-0.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-700 text-xs font-bold text-white">
            {def.attack}
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-800 text-xs font-bold text-white">
            {def.health}
          </span>
        </div>
      )}
      {def.type === 'WEAPON' && (
        <div className="flex w-full justify-between px-0.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-700 text-xs font-bold text-white">
            {def.attack}
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-500 text-xs font-bold text-white">
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
          className="h-16 w-11 rounded border border-gray-600 bg-gradient-to-b from-indigo-900 to-indigo-950 shadow-inner"
        />
      ))}
    </div>
  );
}

// ─── Mana Crystals ───
function ManaCrystals({ current, max }: { current: number; max: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-4 w-4 rounded-full border transition-colors
            ${i < current
              ? 'border-blue-400 bg-blue-500 shadow-[0_0_6px_1px_rgba(59,130,246,0.5)]'
              : 'border-gray-600 bg-gray-800'}
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
        className="relative w-12 h-16 rounded-lg border-2 border-gray-600 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 flex items-center justify-center cursor-default group"
        title={`${count} cards remaining`}
      >
        {/* Stacked card visual */}
        {count > 0 && (
          <>
            <div className="absolute inset-0.5 rounded-md border border-gray-700 opacity-30" />
            {count > 5 && <div className="absolute -top-0.5 -left-0.5 w-12 h-16 rounded-lg border border-gray-700 opacity-20" />}
            {count > 15 && <div className="absolute -top-1 -left-1 w-12 h-16 rounded-lg border border-gray-700 opacity-10" />}
          </>
        )}
        <span className={`text-sm font-bold z-10 ${count > 0 ? 'text-gray-300' : 'text-gray-700'}`}>
          {count}
        </span>
        {/* Hover tooltip */}
        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-gray-300 text-[10px] px-2 py-1 rounded whitespace-nowrap z-50 border border-gray-700">
          {count} cards in deck
        </div>
      </div>
      {/* Graveyard */}
      {graveyardCount > 0 && (
        <button
          onClick={() => setShowGraveyard(!showGraveyard)}
          className="relative w-10 h-5 rounded border border-gray-700 bg-gray-900/80 flex items-center justify-center cursor-pointer hover:border-gray-500 transition-colors group"
          title={`${graveyardCount} cards in graveyard`}
        >
          <span className="text-[9px] text-gray-500 font-medium">{graveyardCount}</span>
          <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-gray-300 text-[10px] px-2 py-1 rounded whitespace-nowrap z-50 border border-gray-700">
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

// ─── Action Log Sidebar (Hearthstone-style) ───
function ActionLogSidebar({
  log,
  myPlayerIndex,
  isOpen,
  onToggle,
}: {
  log: { id: number; turnNumber: number; playerIndex: 0 | 1 | null; message: string; category: string }[];
  myPlayerIndex: 0 | 1;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length, isOpen]);

  // Show last 8 actions in collapsed mode
  const recentActions = log.slice(-8);

  const categoryIcon: Record<string, string> = {
    PLAY: '▶',
    COMBAT: '⚔',
    EFFECT: '✦',
    TURN: '↻',
    GAME: '★',
  };

  return (
    <>
      {/* Toggle button — left side */}
      <button
        onClick={onToggle}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-20 bg-gray-800/90 hover:bg-gray-700 text-gray-400 hover:text-white px-1.5 py-6 rounded-r-lg transition-all border-r border-t border-b border-gray-700"
        title="Action History"
      >
        <span className="text-[10px] font-bold writing-vertical" style={{ writingMode: 'vertical-rl' }}>
          {isOpen ? '◀ LOG' : 'LOG ▶'}
        </span>
      </button>

      {/* Sidebar panel */}
      <div
        className={`fixed left-0 top-0 h-full z-20 bg-gray-900/95 border-r border-gray-700 transition-all duration-200 flex flex-col ${
          isOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full'
        }`}
      >
        {isOpen && (
          <>
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Action History</span>
              <button onClick={onToggle} className="text-gray-600 hover:text-gray-300 text-sm cursor-pointer">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-1">
              {log.map((entry) => {
                const isMe = entry.playerIndex === myPlayerIndex;
                const isSystem = entry.playerIndex === null;
                return (
                  <div
                    key={entry.id}
                    className={`flex items-start gap-1.5 py-1 border-b border-gray-800/50 ${
                      isSystem ? 'opacity-60' : ''
                    }`}
                  >
                    <span className="text-[9px] text-gray-600 mt-0.5 shrink-0 w-3">
                      {categoryIcon[entry.category] || '·'}
                    </span>
                    <span className={`text-[11px] leading-tight ${
                      isSystem ? 'text-gray-500 italic' : isMe ? 'text-blue-300' : 'text-red-300'
                    }`}>
                      {entry.message}
                    </span>
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          </>
        )}
      </div>

      {/* Mini action feed — always visible collapsed on left side (latest actions) */}
      {!isOpen && (
        <div className="fixed left-6 top-1/2 -translate-y-1/2 z-10 pointer-events-none max-h-[300px] overflow-hidden">
          <div className="flex flex-col gap-0.5">
            {recentActions.map((entry, i) => {
              const isMe = entry.playerIndex === myPlayerIndex;
              const isSystem = entry.playerIndex === null;
              const opacity = 0.3 + (i / recentActions.length) * 0.7;
              return (
                <div
                  key={entry.id}
                  className="animate-action-slide"
                  style={{ opacity }}
                >
                  <span className={`text-[10px] ${
                    isSystem ? 'text-gray-600' : isMe ? 'text-blue-400/70' : 'text-red-400/70'
                  }`}>
                    {entry.message.length > 35 ? entry.message.substring(0, 35) + '...' : entry.message}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════
// ─── Main GameBoard Component ───
// ═══════════════════════════════════════════

export default function GameBoard({
  gameState: gs,
  opponentHovering,
  opponentEmote,
  rematchState,
  onRematchStateChange,
  onLeaveGame,
  uid,
}: GameBoardProps) {
  const actions = useGameActions();

  // ─── State ───
  const [targeting, setTargeting] = useState<TargetingMode>({ type: 'none' });
  const [selectedHandCard, setSelectedHandCard] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [attackerPos, setAttackerPos] = useState<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const isMyTurn = gs.currentPlayerIndex === gs.myPlayerIndex;
  const isPlaying = gs.phase === 'PLAYING';
  const isGameOver = gs.winner !== null;
  const myBoard = gs.myBoard;
  const opBoard = gs.opponent.board;

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

  // ─── Handle hand card click ───
  const handleHandCardClick = useCallback(
    (card: ClientCardInstance) => {
      if (!isMyTurn || !isPlaying || isGameOver) return;
      const def = getCard(card.cardCode);
      if (!def || def.manaCost > gs.myMana) return;

      if (selectedHandCard === card.instanceId) {
        // Deselect
        cancelTargeting();
        return;
      }

      // If it's a minion without a targeted battlecry, or a non-targeted spell:
      const needsTarget =
        (def.type === 'MINION' && def.battlecryEffect?.target &&
          !['NONE', 'SELF', 'ALL_ENEMY_MINIONS', 'ALL_FRIENDLY_MINIONS', 'ALL_MINIONS', 'RANDOM_ENEMY', 'RANDOM_ENEMY_MINION'].includes(def.battlecryEffect.target)) ||
        (def.type === 'SPELL' && def.spellEffect?.target &&
          !['NONE', 'ALL_ENEMY_MINIONS', 'ALL_FRIENDLY_MINIONS', 'ALL_MINIONS', 'RANDOM_ENEMY', 'RANDOM_ENEMY_MINION'].includes(def.spellEffect.target));

      if (def.type === 'MINION' && myBoard.length >= MAX_BOARD_SIZE) return;

      setSelectedHandCard(card.instanceId);

      if (!needsTarget) {
        // Play immediately (minion goes to rightmost position)
        const pos = def.type === 'MINION' ? myBoard.length : undefined;
        actions.playCard(card.instanceId, pos);
        cancelTargeting();
      } else {
        // Enter targeting mode - server will send pendingInteraction
        const pos = def.type === 'MINION' ? myBoard.length : undefined;
        actions.playCard(card.instanceId, pos);
        setSelectedHandCard(null);
        // Server will respond with pendingInteraction if target needed
      }
    },
    [isMyTurn, isPlaying, isGameOver, gs.myMana, selectedHandCard, myBoard.length, actions, cancelTargeting]
  );

  // ─── Handle board minion click ───
  const handleMyMinionClick = useCallback(
    (minion: BoardMinion, e: React.MouseEvent) => {
      if (!isMyTurn || !isPlaying || isGameOver) return;

      // If in targeting mode from interaction, select this as target
      if (pendingTarget && validTargetIds.has(minion.instanceId)) {
        actions.playCard('__resolve_target__', undefined, minion.instanceId);
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
        // Resolve server-side interaction
        const socket = (actions as any); // We emit via socket
        // Use the socket directly for target resolution
        import('../socket').then(({ socket }) => {
          socket.emit('resolve-target', {
            interactionId: pendingTarget.interactionId,
            targetId,
          });
        });
        cancelTargeting();
        return;
      }

      if (targeting.type === 'attack' && validTargetIds.has(targetId)) {
        actions.attackTarget(targeting.attackerInstanceId, targetId);
        cancelTargeting();
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

  // ─── Mulligan ───
  if (gs.phase === 'MULLIGAN') {
    const alreadyConfirmed = gs.mulliganConfirmed[gs.myPlayerIndex];
    return (
      <div className="relative h-screen w-screen bg-gray-950">
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
        className={`mb-4 text-5xl font-bold ${gs.winner === gs.myPlayerId ? 'text-amber-400' : 'text-red-500'}`}
      >
        {gs.winner === gs.myPlayerId ? 'VICTORY' : 'DEFEAT'}
      </h1>
      <p className="mb-2 text-gray-300">
        {gs.winReason === 'concede'
          ? 'Opponent conceded'
          : gs.winReason === 'fatigue'
            ? 'Death by fatigue'
            : 'Hero destroyed'}
      </p>
      <div className="mt-6 flex gap-4">
        <button
          onClick={() => {
            actions.requestRematch();
            onRematchStateChange('requested');
          }}
          disabled={rematchState === 'requested'}
          className={`rounded-lg px-6 py-3 font-bold transition-all
            ${rematchState === 'requested'
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-amber-500 text-black hover:bg-amber-400'}
          `}
        >
          {rematchState === 'requested' ? 'Rematch Requested...' : 'Rematch'}
        </button>
        <button
          onClick={onLeaveGame}
          className="rounded-lg border border-gray-500 px-6 py-3 font-bold text-gray-300 hover:bg-gray-700"
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
          className="mt-2 rounded bg-gray-600 px-4 py-1 text-sm text-white hover:bg-gray-500"
        >
          Skip
        </button>
      )}
    </div>
  ) : null;

  return (
    <div
      ref={boardRef}
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950"
    >
      {GameOverOverlay}
      {InteractionOverlay}

      {/* Attack arrow */}
      {targeting.type === 'attack' && attackerPos && (
        <AttackArrow from={attackerPos} to={mousePos} />
      )}

      {/* ═══ Opponent Emote ═══ */}
      {opponentEmote && (
        <div className="fixed right-8 top-24 z-30 animate-bounce rounded-lg bg-gray-800 px-4 py-2 text-2xl shadow-lg">
          {opponentEmote}
        </div>
      )}

      {/* ═══ Menu dropdown ═══ */}
      <div className="absolute right-4 top-4 z-30">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700"
        >
          Menu
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 w-40 rounded-lg border border-gray-700 bg-gray-800 py-1 shadow-xl">
            <button
              onClick={handleConcede}
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700"
            >
              Concede
            </button>
            <button
              onClick={onLeaveGame}
              className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
            >
              Leave Game
            </button>
            <button
              onClick={() => setMenuOpen(false)}
              className="w-full px-4 py-2 text-left text-sm text-gray-400 hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* OPPONENT AREA */}
      {/* ═══════════════════════════════════════════ */}
      <div className="flex flex-col items-center gap-2 px-4 pt-3">
        {/* Opponent hand */}
        <OpponentHand count={gs.opponent.handCount} />

        {/* Opponent hero row */}
        <div className="flex items-center gap-6">
          <DeckPile count={gs.opponentDeckCount} graveyardCount={gs.opponent.graveyardCount} />
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
          />
          <ManaCrystals current={gs.opponent.mana} max={gs.opponent.maxMana} />
        </div>

        {/* Opponent board */}
        <div className="flex min-h-[6.5rem] items-center justify-center gap-2">
          {opBoard.length === 0 ? (
            <div className="text-sm text-gray-700">No minions</div>
          ) : (
            opBoard.map((m) => (
              <BoardMinionCard
                key={m.instanceId}
                minion={m}
                isMyMinion={false}
                canAct={false}
                isValidTarget={validTargetIds.has(m.instanceId)}
                isSelected={false}
                onClick={() => handleEnemyTargetClick(m.instanceId)}
              />
            ))
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* CENTER DIVIDER */}
      {/* ═══════════════════════════════════════════ */}
      <div className="flex items-center justify-center gap-6 py-3">
        {/* Turn info */}
        <div className="text-sm text-gray-500">
          Turn {gs.turnNumber}
        </div>

        {/* End Turn button */}
        <button
          onClick={handleEndTurn}
          disabled={!isMyTurn || !isPlaying}
          className={`rounded-lg px-8 py-3 text-lg font-bold tracking-wide transition-all
            ${isMyTurn && isPlaying
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-[0_0_20px_4px_rgba(234,179,8,0.4)] hover:from-amber-400 hover:to-yellow-400 hover:scale-105 active:scale-95'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'}
          `}
        >
          {isMyTurn ? 'End Turn' : "Opponent's Turn"}
        </button>

        {/* Game log toggle */}
        <button
          onClick={() => setLogOpen(!logOpen)}
          className="rounded bg-gray-800 px-3 py-1 text-xs text-gray-400 hover:bg-gray-700"
        >
          Log
        </button>
      </div>

      {/* Last action text */}
      {gs.lastAction && (
        <div className="mx-auto mb-1 max-w-md text-center text-xs text-gray-500 italic">
          {gs.lastAction}
        </div>
      )}

      {/* Collapsible game log */}
      {logOpen && (
        <div className="absolute left-4 top-1/2 z-30 max-h-60 w-72 -translate-y-1/2 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/95 p-3 shadow-xl">
          <h3 className="mb-2 text-sm font-bold text-gray-300">Game Log</h3>
          <div className="space-y-1">
            {gs.log
              .slice(-20)
              .reverse()
              .map((entry) => (
                <div key={entry.id} className="text-[11px] text-gray-400">
                  <span className="text-gray-600">T{entry.turnNumber}</span>{' '}
                  {entry.message}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* MY AREA */}
      {/* ═══════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col items-center justify-end gap-2 px-4 pb-3">
        {/* My board */}
        <div className="flex min-h-[6.5rem] items-center justify-center gap-2">
          {myBoard.length === 0 ? (
            <div className="text-sm text-gray-700">
              {isMyTurn ? 'Play minions here' : 'No minions'}
            </div>
          ) : (
            myBoard.map((m) => (
              <BoardMinionCard
                key={m.instanceId}
                minion={m}
                isMyMinion={true}
                canAct={isMyTurn && m.canAttack && m.attacksRemaining > 0 && m.currentAttack > 0}
                isValidTarget={validTargetIds.has(m.instanceId)}
                isSelected={targeting.type === 'attack' && targeting.attackerInstanceId === m.instanceId}
                onClick={(e?: any) => handleMyMinionClick(m, e)}
              />
            ))
          )}
        </div>

        {/* My hero row */}
        <div className="flex items-center gap-6">
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
            isValidTarget={validTargetIds.has(`hero-${gs.myPlayerIndex}`)}
            onHeroPowerClick={handleHeroPower}
            onHeroClick={() => {
              if (validTargetIds.has(`hero-${gs.myPlayerIndex}`)) {
                handleEnemyTargetClick(`hero-${gs.myPlayerIndex}`);
              }
            }}
          />
          <DeckPile count={gs.deckCount} graveyardCount={gs.myGraveyardCount} />
        </div>

        {/* My hand */}
        <div className="flex items-end justify-center gap-1 pb-1">
          {gs.myHand.map((card) => {
            const def = getCard(card.cardCode);
            const canPlay = isMyTurn && isPlaying && !isGameOver && (def?.manaCost ?? 99) <= gs.myMana
              && (def?.type !== 'MINION' || myBoard.length < MAX_BOARD_SIZE);
            return (
              <HandCard
                key={card.instanceId}
                card={card}
                canPlay={canPlay}
                isSelected={selectedHandCard === card.instanceId}
                onClick={() => handleHandCardClick(card)}
              />
            );
          })}
        </div>
      </div>

      {/* Opponent hovering indicator */}
      {opponentHovering && (
        <div className="fixed left-4 bottom-4 z-20 rounded bg-gray-800/80 px-3 py-1 text-xs text-gray-400">
          Opponent is thinking...
        </div>
      )}

      {/* ═══ Action Log Sidebar (Hearthstone-style left panel) ═══ */}
      <ActionLogSidebar log={gs.log} myPlayerIndex={gs.myPlayerIndex} isOpen={logOpen} onToggle={() => setLogOpen(!logOpen)} />
    </div>
  );
}
