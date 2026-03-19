import { useState } from 'react';
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
import { MissionModal } from './MissionModal';
import { GameOver } from './GameOver';
import { GameLog } from './GameLog';

interface GameBoardProps {
  gameState: ClientGameState;
}

type UIMode =
  | { type: 'idle' }
  | { type: 'choose-build-mode'; cardInstanceId: string }
  | { type: 'select-stack-for-card'; cardInstanceId: string; faceDown: boolean }
  | { type: 'mission-menu' }
  | { type: 'select-duel-target'; attackerStackId: string }
  | { type: 'select-action-stack'; cardInstanceId: string };

export function GameBoard({ gameState }: GameBoardProps) {
  const [uiMode, setUIMode] = useState<UIMode>({ type: 'idle' });
  const [logOpen, setLogOpen] = useState(false);
  const actions = useGameActions();

  const amICurrentPlayer = gameState.myPlayerIndex === gameState.currentPlayerIndex;

  const winnerName = gameState.winner
    ? (gameState.winner === gameState.myPlayerId ? 'You' : gameState.opponent.playerName)
    : null;

  // ─── Build Phase: Card Click → Play to Stack ───

  const handleHandCardClick = (instanceId: string) => {
    if (!amICurrentPlayer) return;

    if (gameState.turnPhase === 'BUILD') {
      // Show face-up / face-down choice prompt
      setUIMode({ type: 'choose-build-mode', cardInstanceId: instanceId });
    } else if (gameState.turnPhase === 'ACTION') {
      // Check if it's an action card
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
      return true; // Any card can be played (face-down if nothing else)
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

  return (
    <div className="flex min-h-screen max-h-screen overflow-hidden">
      {/* Main board area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Combat Modal (includes combat result) */}
        {(gameState.combatState || gameState.combatResult) && (
          <CombatModal
            gameState={gameState}
            onBlock={actions.blockDecision}
            onCombatTrick={actions.playCombatTrick}
            onDismissCombatResult={actions.dismissCombatResult}
          />
        )}

        {/* Mission Menu */}
        {uiMode.type === 'mission-menu' && (
          <MissionModal
            stacks={gameState.myStacks}
            actedStacks={gameState.actedStacks}
            onPowerMission={(stackId) => { actions.powerMission(stackId); setUIMode({ type: 'idle' }); }}
            onSmartsMission={(stackId) => { actions.smartsMission(stackId); setUIMode({ type: 'idle' }); }}
            onDuel={(stackId) => { setUIMode({ type: 'select-duel-target', attackerStackId: stackId }); }}
            onCancel={() => setUIMode({ type: 'idle' })}
          />
        )}

        {/* Game Over */}
        {winnerName && (
          <GameOver
            winnerName={winnerName}
            isMe={gameState.winner === gameState.myPlayerId}
            onPlayAgain={actions.playAgain}
            gameState={gameState}
          />
        )}

        {/* Top bar: Phase + AP + Log toggle */}
        <div className="flex items-center gap-3 p-3 bg-board-surface/80 border-b border-board-accent">
          <PhaseBar
            currentPhase={gameState.turnPhase}
            isMyTurn={amICurrentPlayer}
            buildsRemaining={gameState.buildsRemaining}
            onEndBuild={actions.endBuildPhase}
            onEndAction={actions.endActionPhase}
          />
          <APCounter
            myAP={gameState.apScores[gameState.myPlayerIndex]}
            opponentAP={gameState.apScores[gameState.myPlayerIndex === 0 ? 1 : 0]}
            myName="You"
            opponentName={gameState.opponent.playerName}
          />
          <button
            onClick={() => setLogOpen((o) => !o)}
            className={`ml-auto text-xs font-bold px-3 py-1 rounded-lg transition-all cursor-pointer ${
              logOpen
                ? 'bg-board-accent text-white'
                : 'bg-board-surface text-gray-500 hover:text-gray-300'
            }`}
          >
            Log
          </button>
        </div>

        {/* Status bar */}
        <div className="px-4 py-1 text-center">
          {gameState.lastAction && (
            <span className="text-sm text-gray-400">{gameState.lastAction}</span>
          )}
          {amICurrentPlayer && !gameState.combatState && (
            <span className="ml-2 text-sm text-spero-yellow font-bold">Your turn!</span>
          )}
        </div>

        {/* Opponent field */}
        <div className="px-3 py-2">
          <OpponentField
            opponent={gameState.opponent}
            onStackClick={uiMode.type === 'select-duel-target' ? handleOpponentStackClick : undefined}
            highlightedStackIds={uiMode.type === 'select-duel-target' ? gameState.opponent.stacks.map((s) => s.stackId) : []}
          />
        </div>

        {/* Center: Deck/Discard + Sideplay */}
        <div className="flex items-center justify-center gap-6 py-2">
          <DeckDiscard deckCount={gameState.deckCount} discardCount={gameState.myDiscardCount} />
          <SideplayZone cards={gameState.mySideplay} />
        </div>

        {/* My battlefield */}
        <div className="px-3 py-2 flex-1 min-h-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500 font-bold">YOUR FIELD</span>
            {amICurrentPlayer && gameState.turnPhase === 'ACTION' && !gameState.combatState && (
              <button
                onClick={() => setUIMode({ type: 'mission-menu' })}
                className="bg-spero-yellow text-black text-xs font-bold px-3 py-1 rounded-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                Missions / Duel
              </button>
            )}
          </div>
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
          />

          {/* New stack button during build */}
          {uiMode.type === 'select-stack-for-card' && (
            <div className="mt-2 flex flex-col items-center gap-1">
              {uiMode.faceDown && (
                <span className="text-xs text-spero-yellow font-bold">Placing face-down</span>
              )}
              <div className="flex justify-center">
                <button
                  onClick={handleNewStack}
                  className="bg-board-accent border-2 border-dashed border-spero-yellow text-spero-yellow text-sm font-bold px-4 py-2 rounded-xl hover:bg-spero-yellow/10 transition-all cursor-pointer"
                >
                  + New Stack
                </button>
                <button
                  onClick={() => setUIMode({ type: 'idle' })}
                  className="ml-2 bg-board-accent text-gray-400 text-sm px-4 py-2 rounded-xl hover:bg-board-accent/80 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
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

        {/* Build mode choice prompt */}
        {uiMode.type === 'choose-build-mode' && (
          <div className="flex justify-center gap-2 py-2">
            <button
              onClick={() => setUIMode({ type: 'select-stack-for-card', cardInstanceId: uiMode.cardInstanceId, faceDown: false })}
              className="bg-spero-blue text-white text-sm font-bold px-4 py-2 rounded-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              Build Face-Up
            </button>
            <button
              onClick={() => setUIMode({ type: 'select-stack-for-card', cardInstanceId: uiMode.cardInstanceId, faceDown: true })}
              className="bg-board-accent border border-spero-yellow text-spero-yellow text-sm font-bold px-4 py-2 rounded-xl hover:bg-spero-yellow/10 active:scale-95 transition-all cursor-pointer"
            >
              Build Face-Down
            </button>
            <button
              onClick={() => setUIMode({ type: 'idle' })}
              className="bg-board-accent text-gray-400 text-sm px-4 py-2 rounded-xl hover:bg-board-accent/80 transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* My hand */}
        <div className={`p-3 ${amICurrentPlayer ? 'bg-board-surface/60' : 'bg-board-surface/30'} border-t border-board-accent`}>
          <div className="text-xs text-gray-500 mb-1 text-center">
            Hand ({gameState.myHand.length})
            {gameState.turnPhase === 'BUILD' && amICurrentPlayer && ` — ${gameState.buildsRemaining} builds left`}
          </div>
          <Hand
            cards={gameState.myHand}
            onCardClick={handleHandCardClick}
            isMyTurn={amICurrentPlayer}
            highlightFilter={handHighlight}
          />
        </div>
      </div>

      {/* Game Log panel */}
      {logOpen && (
        <GameLog
          log={gameState.log}
          myPlayerIndex={gameState.myPlayerIndex}
          onClose={() => setLogOpen(false)}
        />
      )}
    </div>
  );
}
