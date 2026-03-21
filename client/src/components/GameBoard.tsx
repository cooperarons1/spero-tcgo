import { useState, useEffect } from 'react';
import type { ClientGameState, ClientCardInstance } from '../../../shared/types';
import { useGameActions } from '../hooks/useGameActions';
import { getCardDef } from '../utils/stackHelpers';
import { PhaseBar } from './PhaseBar';
import { APCounter } from './APCounter';
import { OpponentField } from './OpponentField';
import { Battlefield } from './Battlefield';
import { Hand } from './Hand';
import { SideplayZone } from './SideplayZone';
import { DeckDiscard } from './DeckDiscard';
import { CombatModal } from './CombatModal';
import { GameOver } from './GameOver';

import { Settings } from './Settings';
import { DragOverlay } from './DragOverlay';
import { useDragCard } from '../hooks/useDragCard';

interface GameBoardProps {
  gameState: ClientGameState;
  opponentHovering?: boolean;
}

type UIMode =
  | { type: 'idle' }
  | { type: 'choose-build-mode'; cardInstanceId: string }
  | { type: 'choose-drag-build-mode'; cardInstanceId: string; targetStackId: string | undefined }
  | { type: 'select-stack-for-card'; cardInstanceId: string; faceDown: boolean }
  | { type: 'select-duel-target'; attackerStackId: string }
  | { type: 'select-action-stack'; cardInstanceId: string };

export function GameBoard({ gameState, opponentHovering }: GameBoardProps) {
  const [uiMode, setUIMode] = useState<UIMode>({ type: 'idle' });
  const [showSettings, setShowSettings] = useState(false);
  const [hoveredDropTarget, setHoveredDropTarget] = useState<string | null>(null);

  useEffect(() => {
    setUIMode({ type: 'idle' });
  }, [gameState.turnPhase, gameState.currentPlayerIndex]);
  const actions = useGameActions();

  const drag = useDragCard();

  // Handle drag end — show face-up/face-down choice (like click flow)
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
        setHoveredDropTarget('new');
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
      setUIMode({ type: 'choose-build-mode', cardInstanceId: instanceId });
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
  };

  const handleNewStack = () => {
    if (uiMode.type === 'select-stack-for-card') {
      actions.buildCard(uiMode.cardInstanceId, undefined, uiMode.faceDown);
      setUIMode({ type: 'idle' });
    }
    if (uiMode.type === 'choose-drag-build-mode') {
      setUIMode({ ...uiMode, targetStackId: undefined });
    }
  };

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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Modals (above everything) */}
      {(gameState.combatState || gameState.combatResult) && (
        <CombatModal
          gameState={gameState}
          onBlock={actions.blockDecision}
          onCombatTrick={actions.playCombatTrick}
          onDismissCombatResult={actions.dismissCombatResult}
        />
      )}
      {winnerName && (
        <GameOver
          winnerName={winnerName}
          isMe={gameState.winner === gameState.myPlayerId}
          onPlayAgain={actions.playAgain}
          gameState={gameState}
        />
      )}
      {showSettings && (
        <Settings
          onConcede={() => { actions.concede(); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
        />
      )}
      {drag.state && (
        <DragOverlay
          cardInstanceId={drag.state.cardInstanceId}
          faceDown={drag.state.faceDown}
          cursorX={drag.state.cursorX}
          cursorY={drag.state.cursorY}
          cards={gameState.myHand}
        />
      )}

      {/* LEFT SIDEBAR */}
      <div className="w-48 flex flex-col gap-4 p-3 border-r border-board-accent/50 bg-board-surface/30 shrink-0 overflow-y-auto">
        <APCounter
          myAP={gameState.apScores[gameState.myPlayerIndex]}
          opponentAP={gameState.apScores[gameState.myPlayerIndex === 0 ? 1 : 0]}
          myName="You"
          opponentName={gameState.opponent.playerName}
        />
        <DeckDiscard deckCount={gameState.deckCount} discardCount={gameState.myDiscardCount} />
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
          <button
            onClick={() => setShowSettings(true)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer text-lg"
            title="Settings"
          >
            ⚙
          </button>
        </div>

        {/* Opponent hand (face-down cards) */}
        <div className="h-28 shrink-0 flex items-center justify-center gap-1 px-4 overflow-hidden">
          {gameState.opponent.handCount > 0 ? (
            Array.from({ length: gameState.opponent.handCount }).map((_, i) => (
              <div
                key={i}
                className="w-16 h-[88px] rounded border border-gray-600 bg-gradient-to-br from-board-accent via-board-surface to-board-accent flex items-center justify-center shrink-0"
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
          />
        </div>

        {/* Divider — centered between halves */}
        <div className="flex items-center px-6 py-1 shrink-0">
          <div className="h-px flex-1 bg-board-accent/40" />
          <span className="px-3 text-xs text-gray-700 font-mono">TURN {gameState.turnNumber ?? ''}</span>
          <div className="h-px flex-1 bg-board-accent/40" />
        </div>

        {/* My half — pushes content toward center */}
        <div className="flex-1 px-4 py-2 min-h-0 flex flex-col items-center justify-start">
          <Battlefield
            stacks={gameState.myStacks}
            isOwner={true}
            onStackClick={
              uiMode.type === 'select-stack-for-card' || uiMode.type === 'select-action-stack'
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
            isActionPhase={isActionPhase}
            actedStacks={gameState.actedStacks}
            onPowerMission={(stackId) => actions.powerMission(stackId)}
            onSmartsMission={(stackId) => actions.smartsMission(stackId)}
            onDuel={(stackId) => setUIMode({ type: 'select-duel-target', attackerStackId: stackId })}
            isDragActive={!!drag.state}
            hoveredDropTarget={hoveredDropTarget}
            turnNumber={gameState.turnNumber}
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
        </div>

        {/* Build mode choice prompt — floating above hand */}
        {(uiMode.type === 'choose-build-mode' || uiMode.type === 'choose-drag-build-mode') && (
          <div className="flex justify-center gap-3 py-3 bg-board-surface/80 border-t border-board-accent">
            <button
              onClick={() => {
                if (uiMode.type === 'choose-drag-build-mode') {
                  actions.buildCard(uiMode.cardInstanceId, uiMode.targetStackId, false);
                  setUIMode({ type: 'idle' });
                } else {
                  setUIMode({ type: 'select-stack-for-card', cardInstanceId: uiMode.cardInstanceId, faceDown: false });
                }
              }}
              className="bg-spero-blue text-white text-base font-bold px-6 py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              Build Face-Up
            </button>
            <button
              onClick={() => {
                if (uiMode.type === 'choose-drag-build-mode') {
                  actions.buildCard(uiMode.cardInstanceId, uiMode.targetStackId, true);
                  setUIMode({ type: 'idle' });
                } else {
                  setUIMode({ type: 'select-stack-for-card', cardInstanceId: uiMode.cardInstanceId, faceDown: true });
                }
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
        )}

        {/* Hand */}
        <div
          className={`h-[220px] shrink-0 p-4 border-t border-board-accent ${amICurrentPlayer ? 'bg-board-surface/50' : 'bg-board-surface/20'}`}
          onPointerMove={drag.state ? (e) => handleDragMove(e) : undefined}
          onPointerUp={drag.state ? handleDragEnd : undefined}
        >
          <div className="text-sm text-gray-500 mb-1 text-center">
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
          />
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="w-56 flex flex-col gap-3 p-3 border-l border-board-accent/50 bg-board-surface/30 shrink-0">
        <PhaseBar
          currentPhase={gameState.turnPhase}
          isMyTurn={amICurrentPlayer}
          buildsRemaining={gameState.buildsRemaining}
          onEndBuild={actions.endBuildPhase}
          onEndAction={actions.endActionPhase}
          turnDeadline={gameState.turnDeadline}
        />

        {/* Opponent deck & discard */}
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-600 mb-1 px-1">{gameState.opponent.playerName}</div>
          <DeckDiscard deckCount={gameState.opponentDeckCount} discardCount={gameState.opponent.discardCount} />
        </div>

      </div>
    </div>
  );
}
