import { socket } from '../socket';

export function useGameActions() {
  // Build phase
  const buildCard = (cardInstanceId: string, targetStackId?: string, faceDown?: boolean) => {
    socket.emit('build-card', { cardInstanceId, targetStackId, faceDown });
  };

  const splitStack = (stackId: string, cardInstanceIds: string[]) => {
    socket.emit('split-stack', { stackId, cardInstanceIds });
  };

  const combineStacks = (stackId1: string, stackId2: string) => {
    socket.emit('combine-stacks', { stackId1, stackId2 });
  };

  const restoreCard = (stackId: string, cardInstanceId: string) => {
    socket.emit('restore-card', { stackId, cardInstanceId });
  };

  const endBuildPhase = () => {
    socket.emit('end-build-phase');
  };

  // Action phase
  const powerMission = (stackId: string) => {
    socket.emit('power-mission', { stackId });
  };

  const smartsMission = (stackId: string) => {
    socket.emit('smarts-mission', { stackId });
  };

  const playActionCard = (cardInstanceId: string, stackId: string) => {
    socket.emit('play-action-card', { cardInstanceId, stackId });
  };

  const duel = (attackerStackId: string, targetStackId: string) => {
    socket.emit('duel', { attackerStackId, targetStackId });
  };

  const endActionPhase = () => {
    socket.emit('end-action-phase');
  };

  // Combat
  const blockDecision = (blockingStackId: string | null) => {
    socket.emit('block-decision', { blockingStackId });
  };

  const playCombatTrick = (cardInstanceId: string | null) => {
    socket.emit('play-combat-trick', { cardInstanceId });
  };

  // Combat result dismiss
  const dismissCombatResult = () => {
    socket.emit('dismiss-combat-result');
  };

  // Meta
  const playAgain = () => {
    socket.emit('play-again');
  };

  return {
    buildCard,
    splitStack,
    combineStacks,
    restoreCard,
    endBuildPhase,
    powerMission,
    smartsMission,
    playActionCard,
    duel,
    endActionPhase,
    blockDecision,
    playCombatTrick,
    dismissCombatResult,
    playAgain,
  };
}
