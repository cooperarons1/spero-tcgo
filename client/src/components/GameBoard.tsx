import { useState, useEffect, useCallback } from 'react';
import type { ClientGameState, ClientCardInstance } from '../../../shared/types';
import { useGameActions } from '../hooks/useGameActions';
import { useGameAnimations, type GameEffect } from '../hooks/useGameAnimations';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { useOnboardingHints } from '../hooks/useOnboardingHints';
import { getCardDef, clientStackPower, clientStackSmarts, topCharacterName } from '../utils/stackHelpers';
import { PhaseBar } from './PhaseBar';
import { APCounter } from './APCounter';
import { OpponentField } from './OpponentField';
import { Battlefield } from './Battlefield';
import { Hand } from './Hand';
import { SideplayZone } from './SideplayZone';
import { DeckDiscard } from './DeckDiscard';
import { CombatModal } from './CombatModal';
import { GameOver } from './GameOver';
import { TurnTimer } from './TurnTimer';
import { TurnBanner } from './TurnBanner';
import { EmotePanel, type EmoteId } from './EmotePanel';
import { EmoteBubble } from './EmoteBubble';
import { TargetingModal } from './TargetingModal';
import { HintOverlay } from './HintOverlay';

import { Settings } from './Settings';
import { DragOverlay } from './DragOverlay';
import { useDragCard } from '../hooks/useDragCard';

type RematchState = 'default' | 'proposed' | 'received' | 'declined';

interface GameBoardProps {
  gameState: ClientGameState;
  opponentHovering?: boolean;
  opponentEmote?: string | null;
  rematchState: RematchState;
  onRematchStateChange: (state: RematchState) => void;
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
      return { boardScale: 'sm' as const, handCardSize: 'sm' as const, sidebarWidth: 'w-40', handHeight: 'h-[100px]', oppHandCard: 'w-12 h-[66px]' };
    }
    if (w <= 1440 || h < 900) {
      return { boardScale: 'sm' as const, handCardSize: 'md' as const, sidebarWidth: 'w-40', handHeight: 'h-[120px]', oppHandCard: 'w-14 h-[77px]' };
    }
    return { boardScale: 'md' as const, handCardSize: 'md' as const, sidebarWidth: 'w-48', handHeight: 'h-[160px]', oppHandCard: 'w-16 h-[88px]' };
  }

  useEffect(() => {
    const onResize = () => setSize(computeSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return size;
}

export function GameBoard({ gameState, opponentHovering, opponentEmote, rematchState, onRematchStateChange }: GameBoardProps) {
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

  const layout = useLayoutSize();
  const effects = useGameAnimations(gameState);
  useSoundEffects(effects);
  const { activeHint, dismissHint } = useOnboardingHints(gameState);

  useEffect(() => {
    setUIMode({ type: 'idle' });
  }, [gameState.turnPhase, gameState.currentPlayerIndex]);

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
        return;
      }
    }
    setHoveredDropTarget(null);
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
    }
    setHoveredDropTarget(null);
  };

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

  const winnerName = gameState.winner
    ? (gameState.winner === gameState.myPlayerId ? 'You' : gameState.opponent.playerName)
    : null;

  // ─── Build Phase: Card Click → Play to Stack ───

  const handleHandCardClick = (instanceId: string) => {
    if (!amICurrentPlayer) return;

    if (gameState.turnPhase === 'BUILD') {
      setUIMode({ type: 'select-stack-for-card', cardInstanceId: instanceId, faceDown: false });
    } else if (gameState.turnPhase === 'ACTION') {
      const card = gameState.myHand.find((c) => c.instanceId === instanceId);
      if (!card?.cardCode) return;
      const def = getCardDef(card.cardCode);
      if (def?.typeA === 'ACTION') {
        setUIMode({ type: 'select-action-stack', cardInstanceId: instanceId });
      }
    }
  };

  const handleMyStackClick = (stackId: string) => {
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
    // Action phase: click a ready stack → open mission type chooser
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
  if (amICurrentPlayer && gameState.turnPhase === 'ACTION' && !gameState.combatState) {
    for (const s of gameState.myStacks) {
      if (!s.tapped && !gameState.actedStacks.includes(s.stackId)) {
        actionLabels[s.stackId] = 'Ready';
      }
    }
  }

  const isActionPhase = amICurrentPlayer && gameState.turnPhase === 'ACTION' && !gameState.combatState;

  const myAP = gameState.apScores[gameState.myPlayerIndex];
  const oppAP = gameState.apScores[gameState.myPlayerIndex === 0 ? 1 : 0];

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">
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

      {/* MOBILE TOP BAR */}
      <div className="md:hidden flex items-center justify-between gap-2 px-3 py-2 border-b border-board-accent/50 bg-board-surface/30 shrink-0">
        <div className="flex items-center gap-3 text-sm font-bold">
          <span className="text-spero-yellow">You: {myAP}</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-400">{gameState.opponent.playerName}: {oppAP}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${amICurrentPlayer ? 'bg-spero-yellow' : 'bg-gray-600'}`} />
            {gameState.turnPhase}
          </span>
          {amICurrentPlayer && !gameState.combatState && (
            <>
              {gameState.turnPhase === 'BUILD' && (
                <button
                  onClick={actions.endBuildPhase}
                  className="text-[10px] font-bold bg-spero-blue text-white px-2 py-1 rounded-full cursor-pointer"
                >
                  End Build
                </button>
              )}
              {gameState.turnPhase === 'ACTION' && (
                <button
                  onClick={actions.endActionPhase}
                  className="text-[10px] font-bold bg-spero-red text-white px-2 py-1 rounded-full cursor-pointer"
                >
                  End Turn
                </button>
              )}
            </>
          )}
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="text-gray-500 hover:text-gray-300 transition-colors cursor-pointer text-2xl p-2"
          title="Settings"
        >
          ⚙
        </button>
      </div>

      {/* LEFT SIDEBAR */}
      <div className={`hidden md:flex ${layout.sidebarWidth === 'w-40' ? 'md:w-40' : 'md:w-48'} flex-col gap-4 p-3 border-r border-board-accent/50 bg-board-surface/30 shrink-0 overflow-y-auto`}>
        <APCounter
          myAP={myAP}
          opponentAP={oppAP}
          myName="You"
          opponentName={gameState.opponent.playerName}
          myPlayerIndex={gameState.myPlayerIndex}
          effects={effects}
        />
        <DeckDiscard deckCount={gameState.deckCount} discardCount={gameState.myDiscardCount} discardCards={gameState.myDiscard} />
        <SideplayZone cards={gameState.mySideplay} />
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
            <div className="relative">
              <button
                onClick={() => setShowEmotePanel(!showEmotePanel)}
                className="text-gray-500 hover:text-gray-300 transition-colors cursor-pointer text-lg p-1"
                title="Emotes"
              >
                💬
              </button>
              {showEmotePanel && (
                <EmotePanel
                  onEmote={(e: EmoteId) => {
                    actions.emitEmote(e);
                    setMyEmote(e);
                    setTimeout(() => setMyEmote(null), 3000);
                  }}
                  onClose={() => setShowEmotePanel(false)}
                />
              )}
            </div>
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

        {/* Opponent hand (face-down cards) */}
        <div className={`${layout.boardScale === 'sm' ? 'h-16' : 'h-16 md:h-28'} shrink-0 flex items-center justify-center gap-1 px-4 overflow-hidden relative`}>
          {opponentEmote && <EmoteBubble text={opponentEmote} position="top" />}
          {gameState.opponent.handCount > 0 ? (
            Array.from({ length: gameState.opponent.handCount }).map((_, i) => (
              <div
                key={i}
                className={`${layout.oppHandCard} rounded border border-gray-600 bg-gradient-to-br from-board-accent via-board-surface to-board-accent flex items-center justify-center shrink-0 hover:-translate-y-2 hover:scale-110 transition-all duration-200 cursor-default`}
              >
                <span className="text-gray-500 text-[10px] font-bold">S</span>
              </div>
            ))
          ) : (
            <span className="text-xs text-gray-600">No cards in hand</span>
          )}
          {opponentHovering && <span className="ml-1 animate-pulse text-sm">👀</span>}
        </div>

        {/* Opponent half — pushes content toward center */}
        <div className="flex-1 px-4 py-2 min-h-0 flex flex-col items-center justify-end">
          <OpponentField
            opponent={gameState.opponent}
            onStackClick={uiMode.type === 'select-duel-target' ? handleOpponentStackClick : undefined}
            highlightedStackIds={uiMode.type === 'select-duel-target' ? gameState.opponent.stacks.map((s) => s.stackId) : []}
            opponentHovering={opponentHovering}
            cardSize={layout.boardScale}
            getStackEffect={getStackEffect}
          />
        </div>

        {/* Divider — centered between halves */}
        <div className="px-6 py-1 shrink-0">
          <div className="h-px bg-board-accent/40" />
        </div>

        {/* My half — pushes content toward center */}
        <div className="flex-1 px-4 py-2 min-h-0 flex flex-col items-center justify-start relative" data-hint-target="stacks" data-hint-target2="action-area">
          {myEmote && <EmoteBubble text={myEmote} position="bottom" />}
          <Battlefield
            stacks={gameState.myStacks}
            isOwner={true}
            onStackClick={
              uiMode.type === 'select-stack-for-card' || uiMode.type === 'select-action-stack' || (isActionPhase && uiMode.type === 'idle')
                ? handleMyStackClick
                : undefined
            }
            highlightedStackIds={
              uiMode.type === 'select-stack-for-card' || uiMode.type === 'select-action-stack'
                ? gameState.myStacks.map((s) => s.stackId)
                : []
            }
            actionLabels={actionLabels}
            showNewStackSlots={uiMode.type === 'select-stack-for-card' || !!drag.state}
            onNewStack={handleNewStack}
            onNewStackAtIndex={handleNewStackAtIndex}
            isActionPhase={isActionPhase}
            actedStacks={gameState.actedStacks}
            isDragActive={!!drag.state}
            hoveredDropTarget={hoveredDropTarget}
            turnNumber={gameState.turnNumber}
            cardSize={layout.boardScale}
            stackOrder={stackOrder}
            getStackEffect={getStackEffect}
            animatingBuilds={animatingBuilds}
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

          {/* Floating mission type chooser */}
          {uiMode.type === 'select-mission-type' && (() => {
            const stack = gameState.myStacks.find(s => s.stackId === uiMode.stackId);
            if (!stack) return null;
            const power = clientStackPower(stack);
            const smarts = clientStackSmarts(stack);
            const name = topCharacterName(stack);
            return (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 rounded-xl">
                <div className="flex flex-col items-center gap-3 bg-board-surface border border-board-accent rounded-2xl p-5 shadow-2xl">
                  <div className="text-sm font-bold text-white mb-1">{name}</div>
                  <div className="flex gap-3">
                    {power > 0 && (
                      <button
                        onClick={() => {
                          actions.powerMission(uiMode.stackId);
                          setUIMode({ type: 'idle' });
                        }}
                        className="flex flex-col items-center gap-1 bg-spero-red text-white font-bold px-6 py-4 rounded-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer min-w-[120px]"
                      >
                        <span className="text-lg">Power Mission</span>
                        <span className="text-2xl">{power}</span>
                      </button>
                    )}
                    {smarts > 0 && (
                      <button
                        onClick={() => {
                          actions.smartsMission(uiMode.stackId);
                          setUIMode({ type: 'idle' });
                        }}
                        className="flex flex-col items-center gap-1 bg-spero-blue text-white font-bold px-6 py-4 rounded-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer min-w-[120px]"
                      >
                        <span className="text-lg">Smarts Mission</span>
                        <span className="text-2xl">{smarts}</span>
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setUIMode({ type: 'idle' })}
                    className="text-gray-400 text-sm underline cursor-pointer mt-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })()}
        </div>


        {/* Hand */}
        <div
          data-hint-target="hand"
          className={`${layout.handHeight} shrink-0 p-2 md:p-4 border-t border-board-accent ${amICurrentPlayer ? 'bg-board-surface/50' : 'bg-board-surface/20'}`}
          onPointerMove={drag.state ? (e) => handleDragMove(e) : undefined}
          onPointerUp={drag.state ? handleDragEnd : undefined}
        >
          <div className="text-sm text-gray-500 mb-1 text-center" data-hint-target="builds">
            Hand ({gameState.myHand.length})
            {gameState.turnPhase === 'BUILD' && amICurrentPlayer && ` — ${gameState.buildsRemaining} builds left`}
          </div>
          <Hand
            cards={gameState.myHand}
            onCardClick={handleHandCardClick}
            isMyTurn={amICurrentPlayer}
            highlightFilter={handHighlight}
            onDragStart={canDrag ? (id, e) => drag.startDrag(id, e.nativeEvent) : undefined}
            draggingCardId={drag.state?.cardInstanceId ?? null}
            cardSize={layout.handCardSize}
          />
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className={`hidden md:flex ${layout.sidebarWidth === 'w-40' ? 'md:w-40' : 'md:w-56'} flex-col gap-3 p-3 border-l border-board-accent/50 bg-board-surface/30 shrink-0`}>
        <div data-hint-target="phase-bar">
        <PhaseBar
          currentPhase={gameState.turnPhase}
          isMyTurn={amICurrentPlayer}
          buildsRemaining={gameState.buildsRemaining}
          onEndBuild={actions.endBuildPhase}
          onEndAction={actions.endActionPhase}
        />
        </div>

        {/* Opponent deck & discard */}
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-600 mb-1 px-1">{gameState.opponent.playerName}</div>
          <DeckDiscard deckCount={gameState.opponentDeckCount} discardCount={gameState.opponent.discardCount} discardCards={gameState.opponent.discard} />
        </div>

      </div>
    </div>
  );
}
