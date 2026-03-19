import type { ClientGameState, ClientCardInstance } from '../../../shared/types';
import { Card } from './Card';
import { getCardDef } from '../utils/stackHelpers';

interface CombatModalProps {
  gameState: ClientGameState;
  onBlock: (stackId: string | null) => void;
  onCombatTrick: (cardInstanceId: string | null) => void;
}

export function CombatModal({ gameState, onBlock, onCombatTrick }: CombatModalProps) {
  const combat = gameState.combatState;
  if (!combat) return null;

  const pending = gameState.pendingInteraction;
  const isMyAction = pending?.waitingForPlayerId === gameState.myPlayerId;

  // Block decision phase
  if (combat.phase === 'AWAITING_BLOCK' && isMyAction) {
    // Find opponent stacks that can block
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
