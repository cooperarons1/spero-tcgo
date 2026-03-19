import { useEffect } from 'react';
import type { ClientGameState } from '../../../shared/types';
import { Card } from './Card';
import { getCardDef } from '../utils/stackHelpers';

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

  const pending = gameState.pendingInteraction;
  const isMyAction = pending?.waitingForPlayerId === gameState.myPlayerId;

  // Block decision phase
  if (combat.phase === 'AWAITING_BLOCK' && isMyAction) {
    const validBlockers = gameState.myStacks.filter((s) => {
      if (s.tapped) return false;
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
      return stat >= Math.ceil(combat.attackerStat / 2);
    });

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-bounce-in">
        <div className="bg-board-surface rounded-2xl p-6 shadow-2xl max-w-lg w-full mx-4 border border-board-accent">
          <h3 className="text-xl font-bold text-center mb-2 text-white">
            Incoming {combat.missionType} Mission!
          </h3>
          <p className="text-center text-gray-400 mb-4">
            Attacker stat: <span className="font-bold text-spero-yellow">{combat.attackerStat}</span>
            {' '}&mdash; Need at least <span className="font-bold">{Math.ceil(combat.attackerStat / 2)}</span> to block
          </p>

          {validBlockers.length > 0 ? (
            <>
              <p className="text-sm text-gray-400 mb-2">Choose a stack to block with:</p>
              <div className="flex flex-wrap gap-2 justify-center mb-4">
                {validBlockers.map((s) => (
                  <button
                    key={s.stackId}
                    onClick={() => onBlock(s.stackId)}
                    className="bg-board-accent hover:bg-spero-blue/30 border border-spero-blue rounded-lg px-4 py-2 text-sm font-bold text-white cursor-pointer transition-all hover:scale-105"
                  >
                    Stack ({s.cards.length} cards)
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-center text-gray-500 mb-4 italic">No stacks can block this mission.</p>
          )}

          <button
            onClick={() => onBlock(null)}
            className="w-full bg-spero-red/20 border border-spero-red text-spero-red font-bold py-2 px-4 rounded-lg hover:bg-spero-red/30 transition-all cursor-pointer"
          >
            Decline to Block
          </button>
        </div>
      </div>
    );
  }

  // Combat trick phase
  if ((combat.phase === 'AWAITING_DEFENDER_TRICK' || combat.phase === 'AWAITING_ATTACKER_TRICK') && isMyAction) {
    const combatTricks = gameState.myHand.filter((c) => {
      if (!c.cardCode) return false;
      const def = getCardDef(c.cardCode);
      return def?.typeA === 'COMBAT TRICK';
    });

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-bounce-in">
        <div className="bg-board-surface rounded-2xl p-6 shadow-2xl max-w-lg w-full mx-4 border border-board-accent">
          <h3 className="text-xl font-bold text-center mb-2 text-white">
            Play a Combat Trick?
          </h3>
          <p className="text-center text-gray-400 mb-4">
            {combat.phase === 'AWAITING_DEFENDER_TRICK' ? 'You are defending' : 'You are attacking'}
            {' '}&mdash; ATK: {combat.attackerStat} vs DEF: {combat.defenderStat}
          </p>

          {combatTricks.length > 0 ? (
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {combatTricks.map((card) => (
                <Card
                  key={card.instanceId}
                  card={card}
                  size="md"
                  onClick={() => onCombatTrick(card.instanceId)}
                  highlighted
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 mb-4 italic">No combat tricks in hand.</p>
          )}

          <button
            onClick={() => onCombatTrick(null)}
            className="w-full bg-board-accent text-gray-400 font-bold py-2 px-4 rounded-lg hover:bg-board-accent/80 transition-all cursor-pointer"
          >
            Pass (No Trick)
          </button>
        </div>
      </div>
    );
  }

  // Waiting for opponent
  if (!isMyAction && combat.phase !== 'RESOLVING') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-board-surface rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 border border-board-accent text-center">
          <h3 className="text-lg font-bold text-white mb-2">Combat in Progress</h3>
          <p className="text-gray-400">Waiting for opponent...</p>
          <div className="mt-3 text-sm text-gray-500">
            {combat.missionType} Mission &mdash; ATK: {combat.attackerStat}
            {combat.defenderStat > 0 && ` vs DEF: ${combat.defenderStat}`}
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

  const outcomeText =
    result.outcome === 'ATK_WIN' ? 'Attacker wins!'
    : result.outcome === 'DEF_WIN' ? 'Defender wins!'
    : 'Tie — both take damage!';

  const damageLines: string[] = [];
  if (result.defenderDamage > 0) damageLines.push(`${result.defenderName} takes ${result.defenderDamage} damage`);
  if (result.attackerDamage > 0) damageLines.push(`${result.attackerName} takes ${result.attackerDamage} damage`);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-bounce-in">
      <div className="bg-board-surface rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4 border border-board-accent">
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
