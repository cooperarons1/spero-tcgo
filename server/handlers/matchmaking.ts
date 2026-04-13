import type { Server, Socket } from 'socket.io';
import { getRoomByPlayer } from '../room.js';
import { adminDb } from '../firebaseAdmin.js';
import { addToQueue, removeFromQueue } from '../matchmaking.js';
import { validated, validatePlayerDeck, type RateLimiter } from '../state.js';
import { JoinQueueSchema } from '../validation.js';

export function registerMatchmakingHandlers(
  io: Server,
  socket: Socket,
  uid: string,
  displayName: string,
  lobbyLimiter: RateLimiter,
) {
  socket.on('join-queue', validated(JoinQueueSchema, async (data) => {
    if (!lobbyLimiter.allow(uid)) return;
    if (getRoomByPlayer(uid)) {
      socket.emit('error', 'Already in a room');
      return;
    }

    const deckError = validatePlayerDeck(data.deckCards, data.heroClass);
    if (deckError) {
      socket.emit('error', `Invalid deck: ${deckError}`);
      return;
    }

    // Fetch ELO for matchmaking
    let elo = 1000;
    try {
      const doc = await adminDb.collection('users').doc(uid).get();
      if (doc.exists && doc.data()?.elo) elo = doc.data()!.elo;
    } catch {}
    addToQueue({
      uid,
      socketId: socket.id,
      displayName,
      heroClass: data.heroClass,
      deckCards: data.deckCards,
      queuedAt: Date.now(),
      elo,
      mode: data.mode ?? 'casual',
    });
  }));

  socket.on('leave-queue', () => {
    removeFromQueue(uid);
  });
}
