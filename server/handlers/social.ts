import type { Server, Socket } from 'socket.io';
import { adminDb } from '../firebaseAdmin.js';
import { createRoom, joinRoom, getRoom, getRoomByPlayer } from '../room.js';
import { createGame } from '../game.js';
import { getSpectatorState } from '../clientState.js';
import {
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  saveChatMessage,
  getPendingRequests,
  getFriendsList,
  getChatHistory,
} from '../friends.js';
import {
  validated,
  validatePlayerDeck,
  startRoomTimer,
  onlineUsers,
  pendingChallenges,
  spectatorRooms,
  spectatorSockets,
  type RateLimiter,
} from '../state.js';
import {
  SearchUsersSchema,
  FriendRequestSchema,
  FriendRequestActionSchema,
  RemoveFriendSchema,
  SendChatSchema,
  ChallengeFriendSchema,
  ChallengeResponseSchema,
} from '../validation.js';

export function registerSocialHandlers(
  io: Server,
  socket: Socket,
  uid: string,
  displayName: string,
  socialLimiter: RateLimiter,
  broadcastGameState: (code: string) => void,
) {
  // ── Friends & Social ──

  socket.on('search-users', validated(SearchUsersSchema, async (data) => {
    if (!socialLimiter.allow(uid)) return;
    try {
      const results = await searchUsers(data.query, uid);
      socket.emit('search-results', results);
    } catch (err) {
      console.error('search-users error:', err);
      socket.emit('search-results', []);
    }
  }));

  socket.on('send-friend-request', validated(FriendRequestSchema, async (data) => {
    if (!socialLimiter.allow(uid)) return;
    if (data.targetUid === uid) return;
    try {
      const targetDoc = await adminDb.collection('users').doc(data.targetUid).get();
      const targetName = targetDoc.exists ? (targetDoc.data()?.displayName as string || 'Player') : 'Player';
      const reqId = await sendFriendRequest(uid, displayName, data.targetUid, targetName);
      if (reqId) {
        socket.emit('friend-request-sent', { requestId: reqId });
        const targetSocket = onlineUsers.get(data.targetUid);
        if (targetSocket) {
          io.to(targetSocket).emit('friend-request-received', {
            id: reqId, fromUid: uid, fromName: displayName, toUid: data.targetUid, toName: targetName, status: 'pending', createdAt: Date.now(),
          });
        }
      } else {
        socket.emit('error', 'Already friends or request pending');
      }
    } catch (err) {
      console.error('send-friend-request error:', err);
      socket.emit('error', 'Failed to send friend request');
    }
  }));

  socket.on('accept-friend-request', validated(FriendRequestActionSchema, async (data) => {
    if (!socialLimiter.allow(uid)) return;
    try {
      const ok = await acceptFriendRequest(data.requestId, uid);
      if (ok) {
        socket.emit('friend-request-accepted', { requestId: data.requestId });
        socket.emit('friends-updated');
        const reqDoc = await adminDb.collection('friendRequests').doc(data.requestId).get();
        const senderUid = reqDoc.data()?.fromUid;
        if (senderUid) {
          const senderSocket = onlineUsers.get(senderUid);
          if (senderSocket) {
            io.to(senderSocket).emit('friends-updated');
          }
        }
      } else {
        socket.emit('error', 'Could not accept request');
      }
    } catch (err) {
      console.error('accept-friend-request error:', err);
    }
  }));

  socket.on('reject-friend-request', validated(FriendRequestActionSchema, async (data) => {
    if (!socialLimiter.allow(uid)) return;
    try {
      await rejectFriendRequest(data.requestId, uid);
      socket.emit('friend-request-rejected', { requestId: data.requestId });
    } catch (err) {
      console.error('reject-friend-request error:', err);
    }
  }));

  socket.on('remove-friend', validated(RemoveFriendSchema, async (data) => {
    if (!socialLimiter.allow(uid)) return;
    try {
      await removeFriend(uid, data.friendUid);
      socket.emit('friends-updated');
      const friendSocket = onlineUsers.get(data.friendUid);
      if (friendSocket) {
        io.to(friendSocket).emit('friends-updated');
      }
    } catch (err) {
      console.error('remove-friend error:', err);
    }
  }));

  socket.on('get-friends', async () => {
    if (!socialLimiter.allow(uid)) return;
    try {
      const [friends, requests] = await Promise.all([
        getFriendsList(uid),
        getPendingRequests(uid),
      ]);
      const onlineUids = friends.map(f => f.uid).filter(fUid => onlineUsers.has(fUid));
      socket.emit('friends-list', { friends, requests, onlineUids });
    } catch (err) {
      console.error('get-friends error:', err);
      socket.emit('friends-list', { friends: [], requests: [], onlineUids: [] });
    }
  });

  socket.on('get-chat-history', validated(RemoveFriendSchema, async (data) => {
    if (!socialLimiter.allow(uid)) return;
    try {
      const messages = await getChatHistory(uid, data.friendUid);
      socket.emit('chat-history', { friendUid: data.friendUid, messages });
    } catch (err) {
      console.error('get-chat-history error:', err);
      socket.emit('chat-history', { friendUid: data.friendUid, messages: [] });
    }
  }));

  socket.on('send-chat-message', validated(SendChatSchema, async (data) => {
    if (!socialLimiter.allow(uid)) return;
    try {
      const msg = await saveChatMessage(uid, data.friendUid, data.text);
      socket.emit('new-chat-message', { friendUid: data.friendUid, message: msg });
      const friendSocket = onlineUsers.get(data.friendUid);
      if (friendSocket) {
        io.to(friendSocket).emit('new-chat-message', { friendUid: uid, message: msg });
      }
    } catch (err) {
      console.error('send-chat-message error:', err);
    }
  }));

  socket.on('challenge-friend', validated(ChallengeFriendSchema, async (data) => {
    if (!socialLimiter.allow(uid)) return;

    const deckError = validatePlayerDeck(data.deckCards, data.heroClass);
    if (deckError) {
      socket.emit('error', `Invalid deck: ${deckError}`);
      return;
    }

    const friendSocket = onlineUsers.get(data.friendUid);
    if (!friendSocket) {
      socket.emit('error', 'Friend is not online');
      return;
    }
    if (getRoomByPlayer(uid)) {
      socket.emit('error', 'You are already in a game');
      return;
    }
    const challengeId = `ch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    pendingChallenges.set(challengeId, {
      id: challengeId,
      fromUid: uid,
      fromName: displayName,
      fromSocketId: socket.id,
      toUid: data.friendUid,
      heroClass: data.heroClass,
      deckCards: data.deckCards,
      createdAt: Date.now(),
    });
    io.to(friendSocket).emit('duel-challenge', { challengeId, fromUid: uid, fromName: displayName });
    socket.emit('challenge-sent', { challengeId });
    setTimeout(() => {
      if (pendingChallenges.has(challengeId)) {
        pendingChallenges.delete(challengeId);
        socket.emit('challenge-expired', { challengeId });
        const target = onlineUsers.get(data.friendUid);
        if (target) io.to(target).emit('challenge-expired', { challengeId });
      }
    }, 30_000);
  }));

  socket.on('respond-challenge', validated(ChallengeResponseSchema, (data) => {
    if (!socialLimiter.allow(uid)) return;
    const challenge = pendingChallenges.get(data.challengeId);
    if (!challenge || challenge.toUid !== uid) return;
    pendingChallenges.delete(data.challengeId);

    const challengerSocket = onlineUsers.get(challenge.fromUid);
    if (!data.accept) {
      if (challengerSocket) {
        io.to(challengerSocket).emit('challenge-declined', { challengeId: data.challengeId });
      }
      return;
    }

    if (!data.deckCards || !data.heroClass || !challengerSocket) {
      socket.emit('error', 'Invalid challenge response');
      return;
    }

    const responderDeckError = validatePlayerDeck(data.deckCards, data.heroClass);
    if (responderDeckError) {
      socket.emit('error', `Invalid deck: ${responderDeckError}`);
      return;
    }

    const room = createRoom(challenge.fromUid, challenge.fromSocketId, challenge.fromName);
    joinRoom(room.code, uid, socket.id, displayName);

    room.selectedDecks.set(challenge.fromUid, { heroClass: challenge.heroClass, cards: challenge.deckCards });
    room.selectedDecks.set(uid, { heroClass: data.heroClass, cards: data.deckCards });

    const s1 = io.sockets.sockets.get(challenge.fromSocketId);
    const s2 = io.sockets.sockets.get(socket.id);
    s1?.join(room.code);
    s2?.join(room.code);

    const uids = Array.from(room.players.keys());
    const d0 = room.selectedDecks.get(uids[0]);
    const d1 = room.selectedDecks.get(uids[1]);
    const name0 = room.players.get(uids[0]);
    const name1 = room.players.get(uids[1]);
    if (!d0 || !d1 || !name0 || !name1) return;
    const entries = [
      { id: uids[0], name: name0, heroClass: d0.heroClass },
      { id: uids[1], name: name1, heroClass: d1.heroClass },
    ];

    room.game = createGame(entries, { deckLists: [d0.cards, d1.cards] });
    room.lastFirstPlayerIndex = room.game.currentPlayerIndex;

    io.to(challenge.fromSocketId).emit('challenge-accepted', { challengeId: data.challengeId });
    startRoomTimer(room, broadcastGameState);
    broadcastGameState(room.code);
  }));

  // ── Spectating ──

  socket.on('spectate-friend', (data: { friendUid: string }) => {
    if (!socialLimiter.allow(uid)) return;
    const friendRoom = getRoomByPlayer(data.friendUid);
    if (!friendRoom?.game || friendRoom.game.winner) {
      socket.emit('error', 'Friend is not in an active game');
      return;
    }
    // Add spectator
    spectatorRooms.set(uid, friendRoom.code);
    spectatorSockets.set(uid, socket.id);
    if (!friendRoom.game.spectators) friendRoom.game.spectators = [];
    if (!friendRoom.game.spectators.includes(uid)) {
      friendRoom.game.spectators.push(uid);
    }
    socket.join(friendRoom.code);
    // Send initial spectator state
    const specState = getSpectatorState(friendRoom.game);
    socket.emit('game-state', specState);
    socket.emit('spectating-started', { roomCode: friendRoom.code });
    // Notify players of spectator count
    broadcastGameState(friendRoom.code);
  });

  socket.on('stop-spectating', () => {
    const roomCode = spectatorRooms.get(uid);
    if (roomCode) {
      const room = getRoom(roomCode);
      if (room?.game?.spectators) {
        room.game.spectators = room.game.spectators.filter(s => s !== uid);
        broadcastGameState(roomCode);
      }
      socket.leave(roomCode);
    }
    spectatorRooms.delete(uid);
    spectatorSockets.delete(uid);
  });
}
