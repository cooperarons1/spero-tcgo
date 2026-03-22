import { useEffect } from 'react';
import type { ClientGameState } from '../../../shared/types';
import { topCharacterName } from '../utils/stackHelpers';

interface CombatModalProps {
  gameState: ClientGameState;
  onBlock: (stackId: string | null) => void;
  onCombatTrick: (cardInstanceId: string | null) => void;
  onDismissCombatResult: () => void;
}

export function CombatModal({ gameState, onBlock, onCombatTrick, onDismissCombatResult }: CombatModalProps) {
  const combat = gameState.combatState;
  const result = gameState.combatResult;

  // Combat result display — show when combatResult exists but combatState is cleared
  if (result && !combat) {
    return <CombatResultOverlay result={result} onDismiss={onDismissCombatResult} />;
  }

  if (!combat) return null;

  // RESOLVING phase is transient — don't show anything
  if (combat.phase === 'RESOLVING') return null;

  const pending = gameState.pendingInteraction;
  const isMyAction = pending?.waitingForPlayerId === gameState.myPlayerId;

  // Derive attacker info for richer banner text
  const attackerStack = gameState.opponent.stacks.find(s => s.stackId === combat.attackerStackId)
    ?? gameState.myStacks.find(s => s.stackId === combat.attackerStackId);
  const attackerStackName = attackerStack ? topCharacterName(attackerStack) : 'Unknown';
  const attackerName = combat.attackerPlayerId === gameState.myPlayerId
    ? gameState.myPlayerName
    : gameState.opponent.playerName;

  // Block decision phase — top banner
  if (combat.phase === 'AWAITING_BLOCK' && isMyAction) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 animate-slide-down">
        <div className="bg-board-surface/95 backdrop-blur-sm border-b border-spero-blue px-4 py-3 shadow-xl">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-base font-bold text-white">
                {attackerName}&apos;s {attackerStackName} is on a {combat.missionType} Mission!
              </h3>
              <p className="text-sm text-gray-400">
                ATK: <span className="font-bold text-spero-yellow">{combat.attackerStat}</span>
                {' '}&mdash; Click a highlighted stack to block (need {Math.ceil(combat.attackerStat / 2)}+)
              </p>
            </div>
            <button
              onClick={() => onBlock(null)}
              className="bg-spero-red/20 border border-spero-red text-spero-red font-bold py-2 px-4 rounded-lg hover:bg-spero-red/30 transition-all cursor-pointer text-sm whitespace-nowrap"
            >
              Decline to Block
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Combat trick phase — top banner
  if ((combat.phase === 'AWAITING_DEFENDER_TRICK' || combat.phase === 'AWAITING_ATTACKER_TRICK') && isMyAction) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 animate-slide-down">
        <div className="bg-board-surface/95 backdrop-blur-sm border-b border-spero-yellow px-4 py-3 shadow-xl">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-base font-bold text-white">
                Play a Combat Trick?
              </h3>
              <p className="text-sm text-gray-400">
                {combat.phase === 'AWAITING_DEFENDER_TRICK' ? 'You are defending' : 'You are attacking'}
                {' '}&mdash; ATK: {combat.attackerStat} vs DEF: {combat.defenderStat}
                {' '}&mdash; Click a highlighted card in your hand
              </p>
            </div>
            <button
              onClick={() => onCombatTrick(null)}
              className="bg-board-accent text-gray-300 font-bold py-2 px-4 rounded-lg hover:bg-board-accent/80 transition-all cursor-pointer text-sm whitespace-nowrap"
            >
              Pass (No Trick)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Waiting for opponent — only show if pendingInteraction still exists (not stale)
  if (!isMyAction && pending) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="bg-board-surface/90 backdrop-blur-sm border-b border-board-accent px-4 py-3 shadow-xl">
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-sm font-bold text-white">Combat in Progress</h3>
            <p className="text-xs text-gray-400">
              Waiting for opponent... {combat.missionType} Mission &mdash; ATK: {combat.attackerStat}
              {combat.defenderStat > 0 && ` vs DEF: ${combat.defenderStat}`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/** Standalone combat result overlay */
function CombatResultOverlay({ result, onDismiss }: { result: NonNullable<ClientGameState['combatResult']>; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  const outcomeText =
    result.outcome === 'ATK_WIN' ? 'Attacker wins!'
    : result.outcome === 'DEF_WIN' ? 'Defender wins!'
    : 'Tie — both take damage!';

  const damageLines: string[] = [];
  if (result.defenderDamage > 0) damageLines.push(`${result.defenderName} takes ${result.defenderDamage} damage`);
  if (result.attackerDamage > 0) damageLines.push(`${result.attackerName} takes ${result.attackerDamage} damage`);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-bounce-in" onClick={onDismiss}>
      <div className="bg-board-surface rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4 border border-board-accent" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-center mb-4 text-white uppercase tracking-wider">
          Combat Resolved
        </h3>

        {/* Attacker */}
        <div className="text-center mb-3">
          <div className="text-sm text-gray-400">{result.attackerName}</div>
          <div className="font-bold text-white">{result.attackerStackName}</div>
          <div className="text-sm text-gray-300">
            Base: {result.attackerBase}
            {result.attackerTrickName && (
              <span className="text-spero-yellow"> + {result.attackerTrickName} (+{result.attackerTrickBonus})</span>
            )}
            <span className="font-bold"> = {result.attackerTotal}</span>
          </div>
        </div>

        <div className="text-center text-gray-500 text-sm mb-3">vs</div>

        {/* Defender */}
        <div className="text-center mb-4">
          <div className="text-sm text-gray-400">{result.defenderName}</div>
          <div className="font-bold text-white">{result.defenderStackName}</div>
          <div className="text-sm text-gray-300">
            Base: {result.defenderBase}
            {result.defenderTrickName && (
              <span className="text-spero-blue"> + {result.defenderTrickName} (+{result.defenderTrickBonus})</span>
            )}
            <span className="font-bold"> = {result.defenderTotal}</span>
          </div>
        </div>

        {/* Outcome */}
        <div className="text-center mb-2">
          <span className={`font-bold text-lg ${
            result.outcome === 'ATK_WIN' ? 'text-spero-red' :
            result.outcome === 'DEF_WIN' ? 'text-spero-blue' : 'text-spero-yellow'
          }`}>
            {outcomeText}
          </span>
        </div>

        {damageLines.length > 0 && (
          <div className="text-center text-sm text-gray-400 mb-4">
            {damageLines.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        )}

        <button
          onClick={onDismiss}
          className="w-full bg-board-accent text-white font-bold py-2 px-4 rounded-lg hover:bg-board-accent/80 transition-all cursor-pointer"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
