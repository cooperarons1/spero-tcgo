import { useState, useEffect, useCallback } from 'react';
import type { ClientGameState, ClientCardInstance } from '../../../shared/types';
import { AP_TO_WIN } from '../../../shared/types';
import { useGameActions } from '../hooks/useGameActions';
import { useGameAnimations, type GameEffect } from '../hooks/useGameAnimations';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { useOnboardingHints } from '../hooks/useOnboardingHints';
import { getCardDef } from '../utils/stackHelpers';
import { OpponentField } from './OpponentField';
import { Battlefield } from './Battlefield';
import { Hand } from './Hand';
import { DeckDiscard } from './DeckDiscard';
import { CombatModal } from './CombatModal';
import { GameOver } from './GameOver';
import { TurnTimer } from './TurnTimer';
import { TurnBanner } from './TurnBanner';
import { EmotePanel, type EmoteId } from './EmotePanel';
import { EmoteBubble } from './EmoteBubble';
import { TargetingModal } from './TargetingModal';
import { HintOverlay } from './HintOverlay';
import { GameLog } from './GameLog';

import { Settings } from './Settings';
import { DragOverlay } from './DragOverlay';
import { useDragCard } from '../hooks/useDragCard';
import { HeroPortrait } from './HeroPortrait';
import { Friends } from './Friends';
import { getCardImagePath } from '../utils/cardImages';

type RematchState = 'default' | 'proposed' | 'received' | 'declined';

interface GameBoardProps {
  gameState: ClientGameState;
  opponentHovering?: boolean;
  opponentEmote?: string | null;
  rematchState: RematchState;
  onRematchStateChange: (state: RematchState) => void;
  onLeaveGame?: () => void;
  uid?: string;
}

type UIMode =
  | { type: 'idle' }
  | { type: 'choose-drag-build-mode'; cardInstanceId: string; targetStackId: string | undefined }
  | { type: 'select-stack-for-card'; cardInstanceId: string; faceDown: boolean }
  | { type: 'select-duel-target'; attackerStackId: string }
  | { type: 'select-action-stack'; cardInstanceId: string }
  | { type: 'select-mission-type'; stackId: string };

// ─── Responsive sizing hook ───
function useLayoutSize() {
  const [size, setSize] = useState(() => computeSize());

  function computeSize() {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const h = typeof window !== 'undefined' ? window.innerHeight : 1080;
    if (w < 1024) {
      return { boardScale: 'sm' as const, handCardSize: 'sm' as const, sidebarWidth: 'w-40', handHeight: 'h-[150px]', oppHandBase: { w: 56, h: 77 }, oppHandContainer: 'h-20' };
    }
    if (w <= 1440 || h < 900) {
      return { boardScale: 'sm' as const, handCardSize: 'md' as const, sidebarWidth: 'w-40', handHeight: 'h-[160px]', oppHandBase: { w: 64, h: 88 }, oppHandContainer: 'h-20 md:h-24' };
    }
    return { boardScale: 'md' as const, handCardSize: 'md' as const, sidebarWidth: 'w-48', handHeight: 'h-[220px]', oppHandBase: { w: 72, h: 100 }, oppHandContainer: 'h-24' };
  }

  useEffect(() => {
    const onResize = () => setSize(computeSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return size;
}

export function GameBoard({ gameState, opponentHovering, opponentEmote, rematchState, onRematchStateChange, onLeaveGame, uid }: GameBoardProps) {
  const [uiMode, setUIMode] = useState<UIMode>({ type: 'idle' });
  const [showSettings, setShowSettings] = useState(false);
  const [hoveredDropTarget, setHoveredDropTarget] = useState<string | null>(null);
  const [stackOrder, setStackOrder] = useState<string[]>([]);
  const [pendingInsertIndex, setPendingInsertIndex] = useState<number | null>(null);
  const [showEmotePanel, setShowEmotePanel] = useState(false);
  const [myEmote, setMyEmote] = useState<string | null>(null);
  const [showTurnBanner, setShowTurnBanner] = useState(false);
  const [turnBannerIsMyTurn, setTurnBannerIsMyTurn] = useState(false);
  const [animatingBuilds, setAnimatingBuilds] = useState<Set<string>>(new Set());
  const [handExpanded, setHandExpanded] = useState(false);
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const [showGameLog, setShowGameLog] = useState(false);
  const [inspectedCard, setInspectedCard] = useState<string | null>(null);
  const [stackDrag, setStackDrag] = useState<{
    sourceStackId: string;
    cardInstanceId: string;
    cursorX: number;
    cursorY: number;
    startX: number;
    startY: number;
    activated: boolean;
  } | null>(null);

  const layout = useLayoutSize();
  const effects = useGameAnimations(gameState);
  useSoundEffects(effects);
  const { activeHint, dismissHint } = useOnboardingHints(gameState);

  useEffect(() => {
    setUIMode({ type: 'idle' });
  }, [gameState.turnPhase, gameState.currentPlayerIndex]);

  // Global Escape key handler — closes modals in priority order
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (inspectedCard) { setInspectedCard(null); return; }
      if (showSettings) { setShowSettings(false); return; }
      if (showFriendsPanel) { setShowFriendsPanel(false); return; }
      if (handExpanded) { setHandExpanded(false); return; }
      if (uiMode.type !== 'idle') { setUIMode({ type: 'idle' }); return; }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [inspectedCard, showSettings, showFriendsPanel, handExpanded, uiMode]);

  // Track turn changes for banner
  useEffect(() => {
    for (const e of effects) {
      if (e.type === 'turn-start') {
        setShowTurnBanner(true);
        setTurnBannerIsMyTurn(e.isMyTurn);
        setTimeout(() => setShowTurnBanner(false), 1500);
      }
      if (e.type === 'card-built') {
        setAnimatingBuilds(prev => new Set([...prev, e.cardInstanceId]));
        setTimeout(() => {
          setAnimatingBuilds(prev => {
            const next = new Set(prev);
            next.delete(e.cardInstanceId);
            return next;
          });
        }, 400);
      }
    }
  }, [effects]);

  const actions = useGameActions();

  // Get active effect for a given stack
  const getStackEffect = (stackId: string): GameEffect | null => {
    for (const e of effects) {
      if ('stackId' in e && (e as any).stackId === stackId) return e;
    }
    return null;
  };

  // Sync stackOrder when stacks change — append new stacks, remove deleted ones
  useEffect(() => {
    setStackOrder(prev => {
      const currentIds = new Set(gameState.myStacks.map(s => s.stackId));
      // Remove stacks that no longer exist
      const filtered = prev.filter(id => currentIds.has(id));
      // Find new stacks not in order
      const existingIds = new Set(filtered);
      const newIds = gameState.myStacks
        .map(s => s.stackId)
        .filter(id => !existingIds.has(id));

      if (newIds.length === 0 && filtered.length === prev.length) {
        return prev; // No changes
      }

      // Insert new stacks at pending index or append
      if (newIds.length > 0 && pendingInsertIndex !== null) {
        const result = [...filtered];
        result.splice(pendingInsertIndex, 0, ...newIds);
        setPendingInsertIndex(null);
        return result;
      }

      return [...filtered, ...newIds];
    });
  }, [gameState.myStacks, pendingInsertIndex]);

  const drag = useDragCard();

  // Handle drag end — show face-up/down modal when dropped on a valid target
  const handleDragEnd = () => {
    const result = drag.endDrag();
    if (!result) return;

    const { cardInstanceId } = result;
    const elements = document.elementsFromPoint(result.cursorX, result.cursorY);

    for (const el of elements) {
      const stackId = (el as HTMLElement).dataset?.dropStack;
      if (stackId) {
        setUIMode({ type: 'choose-drag-build-mode', cardInstanceId, targetStackId: stackId });
        setHoveredDropTarget(null);
        setTimeout(() => setHandExpanded(false), 200);
        return;
      }
      const lane = (el as HTMLElement).dataset?.dropLane;
      if (lane === 'new') {
        const dropIndex = (el as HTMLElement).dataset?.dropIndex;
        if (dropIndex !== undefined) {
          setPendingInsertIndex(parseInt(dropIndex, 10));
        }
        setUIMode({ type: 'choose-drag-build-mode', cardInstanceId, targetStackId: undefined });
        setHoveredDropTarget(null);
        setTimeout(() => setHandExpanded(false), 200);
        return;
      }
      const zone = (el as HTMLElement).dataset?.dropZone;
      if (zone === 'my-field') {
        setUIMode({ type: 'choose-drag-build-mode', cardInstanceId, targetStackId: undefined });
        setHoveredDropTarget(null);
        setTimeout(() => setHandExpanded(false), 200);
        return;
      }
    }
    setHoveredDropTarget(null);
    setTimeout(() => setHandExpanded(false), 200);
  };

  // Update hovered drop target during drag
  const handleDragMove = (e: React.PointerEvent | PointerEvent) => {
    drag.updateDrag(e as PointerEvent);
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    for (const el of elements) {
      const stackId = (el as HTMLElement).dataset?.dropStack;
      if (stackId) {
        setHoveredDropTarget(stackId);
        return;
      }
      const lane = (el as HTMLElement).dataset?.dropLane;
      if (lane === 'new') {
        const dropIndex = (el as HTMLElement).dataset?.dropIndex;
        setHoveredDropTarget(dropIndex !== undefined ? `gap-${dropIndex}` : 'new');
        return;
      }
      const zone = (el as HTMLElement).dataset?.dropZone;
      if (zone === 'my-field') {
        setHoveredDropTarget('my-field');
        return;
      }
    }
    setHoveredDropTarget(null);
  };

  // ─── Stack-drag handlers (split from stack) ───
  const handleStackDragStart = useCallback((stackId: string, cardInstanceId: string, e: React.PointerEvent) => {
    document.body.style.cursor = 'grabbing';
    setStackDrag({
      sourceStackId: stackId,
      cardInstanceId,
      cursorX: e.clientX,
      cursorY: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      activated: false,
    });
  }, []);

  const handleStackDragMove = useCallback((e: PointerEvent) => {
    setStackDrag((prev) => {
      if (!prev) return null;
      const dx = e.clientX - prev.startX;
      const dy = e.clientY - prev.startY;
      const activated = prev.activated || Math.sqrt(dx * dx + dy * dy) > 5;
      return { ...prev, cursorX: e.clientX, cursorY: e.clientY, activated };
    });
    // Update hovered drop target
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    for (const el of elements) {
      const stackId = (el as HTMLElement).dataset?.dropStack;
      if (stackId) {
        setHoveredDropTarget(stackId);
        return;
      }
      const lane = (el as HTMLElement).dataset?.dropLane;
      if (lane === 'new') {
        const dropIndex = (el as HTMLElement).dataset?.dropIndex;
        setHoveredDropTarget(dropIndex !== undefined ? `gap-${dropIndex}` : 'new');
        return;
      }
    }
    setHoveredDropTarget(null);
  }, []);

  const handleStackDragEnd = useCallback(() => {
    document.body.style.cursor = '';
    const current = stackDrag;
    setStackDrag(null);
    setHoveredDropTarget(null);
    if (!current || !current.activated) return;

    const elements = document.elementsFromPoint(current.cursorX, current.cursorY);
    for (const el of elements) {
      // Drop on another own stack → combine
      const targetStackId = (el as HTMLElement).dataset?.dropStack;
      if (targetStackId && targetStackId !== current.sourceStackId) {
        actions.combineStacks(current.sourceStackId, targetStackId);
        return;
      }
      // Drop on empty lane → split
      const lane = (el as HTMLElement).dataset?.dropLane;
      if (lane === 'new') {
        const dropIndex = (el as HTMLElement).dataset?.dropIndex;
        if (dropIndex !== undefined) {
          setPendingInsertIndex(parseInt(dropIndex, 10));
        }
        actions.splitStack(current.sourceStackId, [current.cardInstanceId]);
        return;
      }
    }
  }, [stackDrag, actions]);

  // Document-level pointer listeners for stack-drag
  useEffect(() => {
    if (!stackDrag) return;
    const onMove = (e: PointerEvent) => handleStackDragMove(e);
    const onUp = () => handleStackDragEnd();
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  });

  // Check if we can drag (build phase, my turn, builds remaining)
  const canDrag = gameState.myPlayerIndex === gameState.currentPlayerIndex
    && gameState.turnPhase === 'BUILD'
    && gameState.buildsRemaining > 0;

  // Document-level pointer listeners for drag
  useEffect(() => {
    if (!drag.isDragging) return;

    const onMove = (e: PointerEvent) => handleDragMove(e);
    const onUp = () => handleDragEnd();

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  });

  const amICurrentPlayer = gameState.myPlayerIndex === gameState.currentPlayerIndex;
  const combat = gameState.combatState;

  const winnerName = gameState.winner
    ? (gameState.winner === gameState.myPlayerId ? 'You' : gameState.opponent.playerName)
    : null;

  // ─── Combat: compute valid blocker IDs ───
  const validBlockerIds: string[] = [];
  if (combat?.phase === 'AWAITING_BLOCK' && gameState.pendingInteraction?.waitingForPlayerId === gameState.myPlayerId) {
    for (const s of gameState.myStacks) {
      if (s.tapped) continue;
      const stat = combat.missionType === 'POWER'
        ? s.cards.reduce((sum, c) => {
            if (!c.faceUp || !c.cardCode) return sum;
            const def = getCardDef(c.cardCode);
            return sum + (def && (def.typeA === 'CHARACTER' || def.typeA === 'EQUIPMENT') ? def.power : 0);
          }, 0)
        : s.cards.reduce((sum, c) => {
            if (!c.faceUp || !c.cardCode) return sum;
            const def = getCardDef(c.cardCode);
            return sum + (def && (def.typeA === 'CHARACTER' || def.typeA === 'EQUIPMENT') ? def.smarts : 0);
          }, 0);
      if (stat >= Math.ceil(combat.attackerStat / 2)) {
        validBlockerIds.push(s.stackId);
      }
    }
  }

  // ─── Combat: check if in trick phase ───
  const isMyTrickPhase = combat
    && (combat.phase === 'AWAITING_DEFENDER_TRICK' || combat.phase === 'AWAITING_ATTACKER_TRICK')
    && gameState.pendingInteraction?.waitingForPlayerId === gameState.myPlayerId;

  // Auto-open hand during combat trick phase
  useEffect(() => {
    if (isMyTrickPhase) setHandExpanded(true);
  }, [isMyTrickPhase]);

  // ─── Build Phase: Card Click → Play to Stack ───

  const handleHandCardClick = (instanceId: string) => {
    if (!amICurrentPlayer) return;

    // Combat trick: click a highlighted combat trick card in hand
    if (isMyTrickPhase) {
      const card = gameState.myHand.find((c) => c.instanceId === instanceId);
      if (!card?.cardCode) return;
      const def = getCardDef(card.cardCode);
      if (def?.typeA === 'COMBAT TRICK') {
        actions.playCombatTrick(instanceId);
        setTimeout(() => setHandExpanded(false), 200);
        return;
      }
    }

    if (gameState.turnPhase === 'BUILD') {
      setUIMode({ type: 'select-stack-for-card', cardInstanceId: instanceId, faceDown: false });
      setTimeout(() => setHandExpanded(false), 200);
    } else if (gameState.turnPhase === 'ACTION') {
      const card = gameState.myHand.find((c) => c.instanceId === instanceId);
      if (!card?.cardCode) return;
      const def = getCardDef(card.cardCode);
      if (def?.typeA === 'ACTION') {
        setUIMode({ type: 'select-action-stack', cardInstanceId: instanceId });
        setTimeout(() => setHandExpanded(false), 200);
      }
    }
  };

  const handleMyStackClick = (stackId: string) => {
    // Block phase: click a valid blocker stack
    if (validBlockerIds.length > 0 && validBlockerIds.includes(stackId)) {
      actions.blockDecision(stackId);
      return;
    }

    if (uiMode.type === 'select-stack-for-card') {
      actions.buildCard(uiMode.cardInstanceId, stackId, uiMode.faceDown);
      setUIMode({ type: 'idle' });
      return;
    }
    if (uiMode.type === 'select-action-stack') {
      actions.playActionCard(uiMode.cardInstanceId, stackId);
      setUIMode({ type: 'idle' });
      return;
    }
    // Action phase: click a ready stack → open mission type chooser popover
    if (isActionPhase && uiMode.type === 'idle') {
      const stack = gameState.myStacks.find(s => s.stackId === stackId);
      if (stack && !stack.tapped && !gameState.actedStacks.includes(stackId)) {
        const hasSummoningSickness = stack.createdOnTurn === gameState.turnNumber;
        if (!hasSummoningSickness) {
          setUIMode({ type: 'select-mission-type', stackId });
        }
      }
      return;
    }
  };

  const handleNewStack = () => {
    if (uiMode.type === 'select-stack-for-card') {
      actions.buildCard(uiMode.cardInstanceId, undefined, uiMode.faceDown);
      setUIMode({ type: 'idle' });
    }
  };

  const handleNewStackAtIndex = useCallback((index: number) => {
    if (uiMode.type === 'select-stack-for-card') {
      setPendingInsertIndex(index);
      actions.buildCard(uiMode.cardInstanceId, undefined, uiMode.faceDown);
      setUIMode({ type: 'idle' });
    }
  }, [uiMode, actions]);

  const handleOpponentStackClick = (stackId: string) => {
    if (uiMode.type === 'select-duel-target') {
      actions.duel(uiMode.attackerStackId, stackId);
      setUIMode({ type: 'idle' });
    }
  };

  // ─── Hand highlight filter ───

  const handHighlight = (card: ClientCardInstance): boolean => {
    if (!amICurrentPlayer) return false;
    if (!card.cardCode) return false;
    const def = getCardDef(card.cardCode);
    if (!def) return false;

    // Highlight combat trick cards during trick phases
    if (isMyTrickPhase && def.typeA === 'COMBAT TRICK') {
      return true;
    }

    if (gameState.turnPhase === 'BUILD' && gameState.buildsRemaining > 0) {
      return true;
    }
    if (gameState.turnPhase === 'ACTION') {
      return def.typeA === 'ACTION';
    }
    return false;
  };

  // ─── Action labels for stacks ───

  const actionLabels: Record<string, string> = {};
  const readyStackIds: string[] = [];
  if (amICurrentPlayer && gameState.turnPhase === 'ACTION' && !gameState.combatState) {
    for (const s of gameState.myStacks) {
      if (!s.tapped && !gameState.actedStacks.includes(s.stackId)) {
        const hasSummoningSickness = s.createdOnTurn === gameState.turnNumber;
        if (!hasSummoningSickness) {
          actionLabels[s.stackId] = 'Ready';
          readyStackIds.push(s.stackId);
        }
      }
    }
  }

  const isActionPhase = amICurrentPlayer && gameState.turnPhase === 'ACTION' && !gameState.combatState;
  const hasPlayableCards = amICurrentPlayer && gameState.myHand.some(c => handHighlight(c));

  // Determine battlefield highlighted stacks and style
  let battlefieldHighlightedIds: string[] = [];
  let battlefieldHighlightStyle: 'default' | 'block' = 'default';
  if (validBlockerIds.length > 0) {
    battlefieldHighlightedIds = validBlockerIds;
    battlefieldHighlightStyle = 'block';
  } else if (uiMode.type === 'select-stack-for-card' || uiMode.type === 'select-action-stack') {
    battlefieldHighlightedIds = gameState.myStacks.map((s) => s.stackId);
  }

  const myAP = gameState.apScores[gameState.myPlayerIndex];
  const oppAP = gameState.apScores[gameState.myPlayerIndex === 0 ? 1 : 0];

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 50%, #1e2240 0%, #1a1a2e 70%)' }}>
      {/* Modals (above everything) */}
      {(gameState.combatState || gameState.combatResult) && (
        <CombatModal
          gameState={gameState}
          onBlock={actions.blockDecision}
          onCombatTrick={actions.playCombatTrick}
          onDismissCombatResult={actions.dismissCombatResult}
        />
      )}
      {gameState.pendingInteraction?.type === 'CHOOSE_TARGET' && (
        <TargetingModal
          interaction={gameState.pendingInteraction}
          onChooseTarget={actions.chooseTarget}
          onInspect={setInspectedCard}
        />
      )}
      {winnerName && (
        <GameOver
          winnerName={winnerName}
          isMe={gameState.winner === gameState.myPlayerId}
          onPlayAgain={actions.playAgain}
          onRequestRematch={() => { actions.requestRematch(); onRematchStateChange('proposed'); }}
          onDeclineRematch={() => { actions.declineRematch(); onRematchStateChange('declined'); }}
          gameState={gameState}
          rematchState={rematchState}
          onLeaveGame={onLeaveGame}
        />
      )}
      {showSettings && (
        <Settings
          onConcede={() => { actions.concede(); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showTurnBanner && <TurnBanner isMyTurn={turnBannerIsMyTurn} />}
      {activeHint && <HintOverlay hint={activeHint} onDismiss={dismissHint} />}
      {drag.state && (
        <DragOverlay
          cardInstanceId={drag.state.cardInstanceId}
          faceDown={drag.state.faceDown}
          cursorX={drag.state.cursorX}
          cursorY={drag.state.cursorY}
          cards={gameState.myHand}
        />
      )}
      {stackDrag?.activated && (() => {
        const allCards = gameState.myStacks.flatMap(s => s.cards);
        return (
          <DragOverlay
            cardInstanceId={stackDrag.cardInstanceId}
            faceDown={false}
            cursorX={stackDrag.cursorX}
            cursorY={stackDrag.cursorY}
            cards={allCards}
            hideLabels
          />
        );
      })()}

      {/* MOBILE TOP BAR */}
      <div className="md:hidden flex items-center justify-between gap-2 px-3 py-2 border-b border-board-accent/50 bg-board-surface/30 shrink-0">
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${amICurrentPlayer ? 'bg-spero-yellow' : 'bg-gray-600'}`} />
          {gameState.turnPhase}
        </span>
        <button
          onClick={() => setShowSettings(true)}
          className="text-gray-500 hover:text-gray-300 transition-colors cursor-pointer text-2xl p-2"
          title="Settings"
        >
          ⚙
        </button>
      </div>

      {/* MAIN BOARD */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Status bar */}
        <div className="h-10 flex items-center justify-center gap-2 border-b border-board-accent/30 relative">
          {gameState.lastAction && <span className="text-sm text-gray-400">{gameState.lastAction}</span>}
          {amICurrentPlayer && !gameState.combatState && (
            <span className="text-sm text-spero-yellow font-bold animate-pulse-glow">Your turn!</span>
          )}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-2">
            <button
              onClick={() => setShowGameLog(!showGameLog)}
              className={`text-gray-500 hover:text-gray-300 transition-colors cursor-pointer text-lg p-1 ${showGameLog ? 'text-spero-blue' : ''}`}
              title="Game Log"
            >
              📋
            </button>
            <button
              onClick={() => setShowFriendsPanel(!showFriendsPanel)}
              className="text-gray-500 hover:text-gray-300 transition-colors cursor-pointer text-lg p-1"
              title="Friends"
            >
              👥
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="text-gray-500 hover:text-gray-300 transition-colors cursor-pointer text-2xl p-2"
              title="Settings"
            >
              ⚙
            </button>
          </div>
        </div>
        <TurnTimer deadline={gameState.turnDeadline} isMyTurn={amICurrentPlayer} />

        {/* Opponent info row */}
        <div className="flex items-center justify-center gap-4 py-1 shrink-0">
          <DeckDiscard deckCount={gameState.opponentDeckCount} discardCount={gameState.opponent.discardCount} discardCards={gameState.opponent.discard} compact onInspect={setInspectedCard} />
        </div>

        {/* Opponent Hero Portrait */}
        <div className="flex justify-center py-1 shrink-0 -mb-2 z-20 relative">
          <div className="relative">
            <HeroPortrait
              playerName={gameState.opponent.playerName}
              health={AP_TO_WIN - myAP}
              ap={oppAP}
              isOpponent={true}
              effects={effects}
              playerIndex={gameState.myPlayerIndex === 0 ? 1 : 0}
            />
            {opponentEmote && <EmoteBubble text={opponentEmote} position="top" />}
          </div>
        </div>

        {/* Opponent hand (fanned arc) — dynamic sizing */}
        <div className={`${layout.oppHandContainer} shrink-0 flex items-start justify-center px-4 overflow-visible relative z-10`}>
          {gameState.opponent.handCount > 0 ? (
            (() => {
              const total = gameState.opponent.handCount;
              const fanAngle = Math.min(3, 18 / total);
              const scale = Math.min(1, 7 / total);
              const cardW = Math.round(layout.oppHandBase.w * scale);
              const cardH = Math.round(layout.oppHandBase.h * scale);
              return Array.from({ length: total }).map((_, i) => {
                const offset = i - (total - 1) / 2;
                const rotation = offset * fanAngle;
                const translateY = Math.abs(offset) * 2;
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-gray-600 bg-gradient-to-b from-board-accent via-board-surface to-board-accent flex items-center justify-center shrink-0 hover:scale-125 hover:translate-y-2 hover:z-50 transition-all duration-200 cursor-default shadow-md"
                    style={{
                      width: cardW,
                      height: cardH,
                      transform: `translateY(${translateY}px) rotate(${rotation}deg)`,
                      transformOrigin: 'top center',
                      marginLeft: i === 0 ? 0 : '-8px',
                    }}
                  >
                    <span className="text-gray-500 text-[10px] font-bold tracking-widest select-none">SPERO</span>
                  </div>
                );
              });
            })()
          ) : (
            <span className="text-xs text-gray-600">No cards in hand</span>
          )}
          {opponentHovering && <span className="ml-1 animate-pulse text-sm">👀</span>}
        </div>

        {/* Opponent half — pushes content toward center */}
        <div className="flex-1 px-4 py-2 min-h-0 flex flex-col items-center justify-end bg-gradient-to-b from-board-bg to-board-surface/30">
          <OpponentField
            opponent={gameState.opponent}
            onStackClick={uiMode.type === 'select-duel-target' ? handleOpponentStackClick : undefined}
            highlightedStackIds={uiMode.type === 'select-duel-target' ? gameState.opponent.stacks.map((s) => s.stackId) : []}
            opponentHovering={opponentHovering}
            cardSize={layout.boardScale}
            getStackEffect={getStackEffect}
            onInspect={setInspectedCard}
          />
        </div>

        {/* Center divider with End Turn button */}
        <div className="px-6 py-1 shrink-0 flex items-center gap-3">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-board-accent/40" />
          {amICurrentPlayer && !gameState.combatState ? (
            gameState.turnPhase === 'BUILD' ? (
              <button
                onClick={actions.endBuildPhase}
                className="min-w-[140px] px-5 py-2 rounded-full bg-spero-blue text-white font-bold text-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-lg"
              >
                End Build ({gameState.buildsRemaining} left)
              </button>
            ) : gameState.turnPhase === 'ACTION' ? (
              <button
                onClick={actions.endActionPhase}
                className="min-w-[140px] px-5 py-2 rounded-full bg-amber-600 text-white font-bold text-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-lg animate-end-turn-glow"
              >
                End Turn
              </button>
            ) : (
              <span className="text-[10px] uppercase tracking-widest text-gray-600">{gameState.turnPhase}</span>
            )
          ) : (
            <span className="min-w-[140px] px-5 py-2 rounded-full bg-board-accent text-gray-500 font-bold text-sm text-center cursor-default">
              Opponent's Turn
            </span>
          )}
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-board-accent/40" />
        </div>

        {/* My half — pushes content toward center */}
        <div className="flex-1 px-4 py-2 min-h-0 flex flex-col items-center justify-start relative bg-gradient-to-t from-board-bg to-board-surface/30" data-hint-target="stacks" data-hint-target2="action-area" data-drop-zone="my-field">
          <Battlefield
            stacks={gameState.myStacks}
            isOwner={true}
            onStackClick={
              validBlockerIds.length > 0
                || uiMode.type === 'select-stack-for-card'
                || uiMode.type === 'select-action-stack'
                || (isActionPhase && uiMode.type === 'idle')
                ? handleMyStackClick
                : undefined
            }
            highlightedStackIds={battlefieldHighlightedIds}
            highlightStyle={battlefieldHighlightStyle}
            dimNonHighlighted={battlefieldHighlightStyle === 'block' && validBlockerIds.length > 0}
            actionLabels={actionLabels}
            showNewStackSlots={uiMode.type === 'select-stack-for-card' || !!drag.state || !!stackDrag?.activated}
            onNewStack={handleNewStack}
            onNewStackAtIndex={handleNewStackAtIndex}
            isActionPhase={isActionPhase}
            actedStacks={gameState.actedStacks}
            isDragActive={!!drag.state || !!stackDrag?.activated}
            hoveredDropTarget={hoveredDropTarget}
            turnNumber={gameState.turnNumber}
            cardSize={layout.boardScale}
            stackOrder={stackOrder}
            getStackEffect={getStackEffect}
            animatingBuilds={animatingBuilds}
            onRestoreCard={actions.restoreCard}
            canRestore={canDrag}
            selectedStackId={uiMode.type === 'select-mission-type' ? uiMode.stackId : undefined}
            onPowerMission={(stackId) => {
              actions.powerMission(stackId);
              setUIMode({ type: 'idle' });
            }}
            onSmartsMission={(stackId) => {
              actions.smartsMission(stackId);
              setUIMode({ type: 'idle' });
            }}
            onMissionCancel={() => setUIMode({ type: 'idle' })}
            readyStackIds={readyStackIds}
            onInspect={setInspectedCard}
            onDragStartFromStack={handleStackDragStart}
            canSplitDrag={canDrag}
          />

          {/* Floating prompts */}
          {uiMode.type === 'select-stack-for-card' && uiMode.faceDown && (
            <div className="mt-2 flex justify-center">
              <span className="text-xs text-spero-yellow font-bold">Placing face-down — select a stack or empty lane</span>
              <button
                onClick={() => setUIMode({ type: 'idle' })}
                className="ml-2 text-gray-400 text-xs underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
          {uiMode.type === 'select-stack-for-card' && !uiMode.faceDown && (
            <div className="mt-2 flex justify-center">
              <span className="text-xs text-spero-blue font-bold">Select a stack or empty lane</span>
              <button
                onClick={() => setUIMode({ type: 'idle' })}
                className="ml-2 text-gray-400 text-xs underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {uiMode.type === 'select-duel-target' && (
            <div className="mt-2 flex justify-center">
              <span className="text-sm text-spero-yellow">Select an opponent stack to duel...</span>
              <button
                onClick={() => setUIMode({ type: 'idle' })}
                className="ml-2 text-gray-400 text-sm underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {uiMode.type === 'select-action-stack' && (
            <div className="mt-2 flex justify-center">
              <span className="text-sm text-spero-blue">Select a stack to play the action with...</span>
              <button
                onClick={() => setUIMode({ type: 'idle' })}
                className="ml-2 text-gray-400 text-sm underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Floating build modal */}
          {uiMode.type === 'choose-drag-build-mode' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 rounded-xl">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    actions.buildCard(uiMode.cardInstanceId, uiMode.targetStackId, false);
                    setUIMode({ type: 'idle' });
                  }}
                  className="bg-spero-blue text-white text-base font-bold px-6 py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  Build Face-Up
                </button>
                <button
                  onClick={() => {
                    actions.buildCard(uiMode.cardInstanceId, uiMode.targetStackId, true);
                    setUIMode({ type: 'idle' });
                  }}
                  className="bg-board-accent border border-spero-yellow text-spero-yellow text-base font-bold px-6 py-3 rounded-xl hover:bg-spero-yellow/10 active:scale-95 transition-all cursor-pointer"
                >
                  Build Face-Down
                </button>
                <button
                  onClick={() => setUIMode({ type: 'idle' })}
                  className="bg-board-accent text-gray-400 text-base px-6 py-3 rounded-xl hover:bg-board-accent/80 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>


        {/* Player Hero Portrait + Hand Badge Row */}
        <div className="flex justify-center items-center gap-4 py-1 shrink-0 z-20 relative" data-hint-target="player-portrait">
          {/* My info row (left side) */}
          <div className="flex items-center gap-2">
            <DeckDiscard deckCount={gameState.deckCount} discardCount={gameState.myDiscardCount} discardCards={gameState.myDiscard} compact onInspect={setInspectedCard} />
            {gameState.mySideplay.length > 0 && (
              <>
                <span className="text-gray-700">|</span>
                <span className="text-xs text-gray-500">Side: {gameState.mySideplay.length}</span>
              </>
            )}
          </div>

          <div className="relative">
            {myEmote && <EmoteBubble text={myEmote} position="bottom" />}
            <HeroPortrait
              playerName={gameState.myPlayerName}
              health={AP_TO_WIN - oppAP}
              ap={myAP}
              isOpponent={false}
              effects={effects}
              playerIndex={gameState.myPlayerIndex}
              onClick={() => setShowEmotePanel(!showEmotePanel)}
            />
            {showEmotePanel && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30">
                <EmotePanel
                  onEmote={(e: EmoteId) => {
                    actions.emitEmote(e);
                    setMyEmote(e);
                    setTimeout(() => setMyEmote(null), 3000);
                    setShowEmotePanel(false);
                  }}
                  onClose={() => setShowEmotePanel(false)}
                />
              </div>
            )}
          </div>

          {/* Collapsed hand badge */}
          <button
            data-hint-target="hand"
            onClick={() => setHandExpanded(true)}
            className={`px-3 py-1.5 rounded-full border border-board-accent bg-board-surface text-sm font-bold cursor-pointer transition-all hover:brightness-125 ${
              hasPlayableCards ? 'text-spero-blue animate-hand-badge-pulse' : 'text-gray-400'
            }`}
          >
            Hand ({gameState.myHand.length})
          </button>
        </div>
      </div>

      {/* Hand Overlay */}
      {handExpanded && (
        <>
          {/* Scrim — don't close during active drag */}
          <div
            className="fixed inset-0 z-30 bg-black/50"
            onClick={!drag.state ? () => setHandExpanded(false) : undefined}
          />
          {/* Hand panel */}
          <div
            className="fixed bottom-0 left-0 right-0 z-40 bg-board-surface/95 border-t border-board-accent animate-hand-slide-up h-[45vh] md:h-[35vh]"
            onPointerMove={drag.state ? (e) => handleDragMove(e) : undefined}
            onPointerUp={drag.state ? handleDragEnd : undefined}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-board-accent/50">
              <div className="text-sm text-gray-400" data-hint-target="builds">
                Hand ({gameState.myHand.length})
                {gameState.turnPhase === 'BUILD' && amICurrentPlayer && ` — ${gameState.buildsRemaining} builds left`}
              </div>
              <button
                onClick={() => setHandExpanded(false)}
                className="text-gray-400 hover:text-white cursor-pointer text-lg leading-none px-2"
              >
                ✕
              </button>
            </div>
            <div className="h-[calc(100%-40px)] p-2 md:p-4">
              <Hand
                cards={gameState.myHand}
                onCardClick={handleHandCardClick}
                isMyTurn={amICurrentPlayer}
                highlightFilter={handHighlight}
                expanded
                onDragStart={amICurrentPlayer ? (id, e) => drag.startDrag(id, e.nativeEvent) : undefined}
                draggingCardId={drag.state?.cardInstanceId ?? null}
                cardSize={layout.handCardSize}
                onInspect={setInspectedCard}
              />
            </div>
          </div>
        </>
      )}

      {/* Card Inspect Modal */}
      {inspectedCard && (() => {
        const def = getCardDef(inspectedCard);
        if (!def) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            onClick={() => setInspectedCard(null)}
          >
            <div className="animate-card-inspect-in flex flex-col items-center gap-3 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <img
                src={getCardImagePath(inspectedCard)}
                alt={def.name}
                className="w-80 max-h-[70vh] object-contain rounded-xl shadow-2xl"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="bg-board-surface/95 border border-board-accent rounded-lg px-4 py-3 w-full text-center">
                <div className="text-white font-bold text-lg">{def.name}</div>
                <div className="text-gray-400 text-xs mt-0.5">{def.typeA}{def.typeB ? ` — ${def.typeB}` : ''} · Cost {def.cost}</div>
                {(def.power > 0 || def.smarts > 0) && (
                  <div className="flex justify-center gap-3 mt-1.5">
                    {def.power > 0 && <span className="text-spero-red font-bold text-sm">Power {def.power}</span>}
                    {def.smarts > 0 && <span className="text-spero-blue font-bold text-sm">Smarts {def.smarts}</span>}
                  </div>
                )}
                {def.rulesText && <p className="text-gray-300 text-sm mt-2">{def.rulesText}</p>}
                {def.flavor && <p className="text-gray-500 text-xs italic mt-1">{def.flavor}</p>}
              </div>
              <button
                onClick={() => setInspectedCard(null)}
                className="text-gray-400 text-sm underline cursor-pointer hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        );
      })()}

      {/* Game Log Sidebar */}
      {showGameLog && (
        <div className="fixed right-0 top-0 bottom-0 w-72 z-40 bg-board-surface/95 border-l border-board-accent shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-board-accent">
            <span className="text-sm font-bold text-gray-300">Game Log</span>
            <button onClick={() => setShowGameLog(false)} className="text-gray-400 hover:text-white cursor-pointer text-lg">✕</button>
          </div>
          <div className="flex-1 overflow-hidden">
            <GameLog log={gameState.log} myPlayerIndex={gameState.myPlayerIndex} />
          </div>
        </div>
      )}

      {/* Friends Panel Overlay */}
      {showFriendsPanel && uid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-board-surface rounded-2xl shadow-2xl border border-board-accent max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-board-accent">
              <h2 className="text-white font-bold">Friends</h2>
              <button onClick={() => setShowFriendsPanel(false)} className="text-gray-400 hover:text-white cursor-pointer text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Friends uid={uid} onBack={() => setShowFriendsPanel(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
