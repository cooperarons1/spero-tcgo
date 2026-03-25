import { socket } from '../socket';

export function useGameActions() {
  // Mulligan
  const confirmMulligan = (replacements: boolean[]) => {
    socket.emit('mulligan-confirm', { replacements });
  };

  // Play a card
  const playCard = (cardInstanceId: string, position?: number, targetId?: string | null) => {
    socket.emit('play-card', { cardInstanceId, position, targetId });
  };

  // Attack
  const attackTarget = (attackerInstanceId: string, targetId: string) => {
    socket.emit('attack', { attackerInstanceId, targetId });
  };

  // Hero power
  const heroPower = (targetId?: string | null) => {
    socket.emit('hero-power', { targetId });
  };

  // Activate location
  const activateLocation = (locationInstanceId: string, targetId?: string | null) => {
    socket.emit('activate-location', { locationInstanceId, targetId });
  };

  // End turn
  const endTurn = () => {
    socket.emit('end-turn');
  };

  // Concede
  const concede = () => {
    socket.emit('concede');
  };

  // Emotes
  const emitEmote = (emoteId: string) => {
    socket.emit('emit-emote', { emoteId });
  };

  // Deck
  const selectDeck = (heroClass: string, deckCards: string[] | null) => {
    socket.emit('select-deck', { heroClass, deckCards });
  };

  // Meta
  const playAgain = () => {
    socket.emit('play-again');
  };

  const requestRematch = () => {
    socket.emit('request-rematch');
  };

  const declineRematch = () => {
    socket.emit('decline-rematch');
  };

  return {
    confirmMulligan,
    playCard,
    attackTarget,
    heroPower,
    activateLocation,
    endTurn,
    concede,
    emitEmote,
    selectDeck,
    playAgain,
    requestRematch,
    declineRematch,
  };
}
