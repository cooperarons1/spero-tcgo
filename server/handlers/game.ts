import type { Server, Socket } from 'socket.io';
import type { HeroClass } from '../../shared/types.js';
import { createRoom, joinRoom, getRoomByPlayer, removePlayer, clearRoomTimer } from '../room.js';
import { createGame, confirmMulligan, endTurn } from '../game.js';
import { playCard, useHeroPower, activateLocation, resolveBattlecry, cancelBattlecry } from '../actions.js';
import { attack } from '../combat.js';
import { addLog } from '../log.js';
import { generateAIPlayerId, randomAIName } from '../ai.js';
import { STARTER_DECKS } from '../../shared/starterDecks.js';
import { adminDb } from '../firebaseAdmin.js';
import {
  validated,
  validatePlayerDeck,
  startRoomTimer,
  broadcastLobby,
  type RateLimiter,
} from '../state.js';
import {
  PlayerNameSchema,
  JoinRoomSchema,
  MulliganConfirmSchema,
  PlayCardSchema,
  AttackSchema,
  HeroPowerSchema,
  ActivateLocationSchema,
  HoverHandSchema,
  ChooseTargetSchema,
  EmoteSchema,
  SelectDeckSchema,
  StartAIGameSchema,
} from '../validation.js';

export function registerGameHandlers(
  io: Server,
  socket: Socket,
  uid: string,
  displayName: string,
  lobbyLimiter: RateLimiter,
  gameActionLimiter: RateLimiter,
  broadcastGameState: (code: string) => void,
) {
  // ── Lobby ──

  socket.on('create-room', validated(PlayerNameSchema, (name) => {
    if (!lobbyLimiter.allow(uid)) return;
    const room = createRoom(uid, socket.id, name);
    socket.join(room.code);
    broadcastLobby(io, room.code);
  }));

  socket.on('join-room', validated(JoinRoomSchema, (data) => {
    if (!lobbyLimiter.allow(uid)) return;
    const room = joinRoom(data.code, uid, socket.id, data.name);
    if (!room) {
      socket.emit('error', 'Could not join room. Check the code or the game may have started.');
      return;
    }
    socket.join(room.code);
    broadcastLobby(io, room.code);
  }));

  socket.on('start-game', async () => {
    if (!lobbyLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room || uid !== room.hostId) return;
    if (room.players.size !== 2) {
      socket.emit('error', 'Need exactly 2 players to start');
      return;
    }

    const uids = Array.from(room.players.keys());
    const d0 = room.selectedDecks.get(uids[0]);
    const d1 = room.selectedDecks.get(uids[1]);

    // Load card backs for both players
    room.cardBacks = new Map();
    for (const pUid of uids) {
      try {
        const doc = await adminDb.collection('users').doc(pUid).get();
        room.cardBacks.set(pUid, doc.data()?.selectedCardBack ?? 'default');
      } catch { room.cardBacks.set(pUid, 'default'); }
    }

    const entries = [
      { id: uids[0], name: room.players.get(uids[0])!, heroClass: (d0?.heroClass ?? 'JIMMY') as HeroClass },
      { id: uids[1], name: room.players.get(uids[1])!, heroClass: (d1?.heroClass ?? 'JIMMY') as HeroClass },
    ];

    room.game = createGame(entries, {
      deckLists: [d0?.cards ?? null, d1?.cards ?? null],
    });
    room.lastFirstPlayerIndex = room.game.currentPlayerIndex;
    startRoomTimer(room, broadcastGameState);
    broadcastGameState(room.code);
  });

  // ── Play vs AI ──

  socket.on('start-ai-game', validated(StartAIGameSchema, async (data) => {
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

    const aiId = generateAIPlayerId();
    const aiName = randomAIName();
    const aiDeck = STARTER_DECKS[Math.floor(Math.random() * STARTER_DECKS.length)];

    const room = createRoom(uid, socket.id, displayName);
    room.players.set(aiId, aiName);
    room.sockets.set(aiId, '__ai__');
    room.isAIGame = true;
    room.aiPlayerId = aiId;

    room.selectedDecks.set(uid, { heroClass: data.heroClass, cards: data.deckCards });
    room.selectedDecks.set(aiId, { heroClass: aiDeck.heroClass, cards: aiDeck.cards });

    // Load card back for human player
    room.cardBacks = new Map();
    try {
      const doc = await adminDb.collection('users').doc(uid).get();
      room.cardBacks.set(uid, doc.data()?.selectedCardBack ?? 'default');
    } catch { room.cardBacks.set(uid, 'default'); }
    room.cardBacks.set(aiId, 'default');

    socket.join(room.code);

    const uids = Array.from(room.players.keys());
    const d0 = room.selectedDecks.get(uids[0])!;
    const d1 = room.selectedDecks.get(uids[1])!;
    const entries = [
      { id: uids[0], name: room.players.get(uids[0])!, heroClass: d0.heroClass },
      { id: uids[1], name: room.players.get(uids[1])!, heroClass: d1.heroClass },
    ];

    room.game = createGame(entries, { deckLists: [d0.cards, d1.cards] });
    room.lastFirstPlayerIndex = room.game.currentPlayerIndex;

    startRoomTimer(room, broadcastGameState);
    broadcastGameState(room.code);
  }));

  // ── Mulligan ──

  socket.on('mulligan-confirm', validated(MulliganConfirmSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) { socket.emit('error', 'Too many actions, slow down'); return; }
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    const result = confirmMulligan(room.game, uid, data.replacements);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  }));

  // ── Play Card ──

  socket.on('play-card', validated(PlayCardSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) { socket.emit('error', 'Too many actions, slow down'); return; }
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    // If there's a pending battlecry, only allow target resolution or reject
    if (room.game.pendingBattlecry && !data.targetId) {
      socket.emit('error', 'Resolve the pending battlecry first');
      return;
    }
    if (room.game.pendingBattlecry && data.targetId) {
      const result = resolveBattlecry(room.game, uid, data.targetId);
      if (!result.success) {
        socket.emit('error', result.error);
        return;
      }
      broadcastGameState(room.code);
      return;
    }

    const result = playCard(room.game, uid, data.cardInstanceId, data.position, data.targetId);
    if (!result.success) {
      if (result.needsTarget) {
        // Broadcast state first so all clients see the minion on board
        if (result.placed) broadcastGameState(room.code);
        socket.emit('needs-target', { cardInstanceId: data.cardInstanceId, validTargets: result.validTargets, placed: true });
      } else {
        socket.emit('error', result.error);
      }
      return;
    }
    broadcastGameState(room.code);
  }));

  // ── Cancel Battlecry ──
  socket.on('cancel-battlecry', () => {
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;
    const result = cancelBattlecry(room.game, uid);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  });

  // ── Attack ──

  socket.on('attack', validated(AttackSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) { socket.emit('error', 'Too many actions, slow down'); return; }
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    const result = attack(room.game, uid, data.attackerInstanceId, data.targetId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  }));

  // ── Hero Power ──

  socket.on('hero-power', validated(HeroPowerSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) { socket.emit('error', 'Too many actions, slow down'); return; }
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    const result = useHeroPower(room.game, uid, data.targetId);
    if (!result.success) {
      if (result.needsTarget) {
        socket.emit('needs-target', { heroPower: true, validTargets: result.validTargets });
      } else {
        socket.emit('error', result.error);
      }
      return;
    }
    broadcastGameState(room.code);
  }));

  // ── Activate Location ──

  socket.on('activate-location', validated(ActivateLocationSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) { socket.emit('error', 'Too many actions, slow down'); return; }
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    const result = activateLocation(room.game, uid, data.locationInstanceId, data.targetId);
    if (!result.success) {
      if (result.needsTarget) {
        socket.emit('needs-target', { locationInstanceId: data.locationInstanceId, validTargets: result.validTargets });
      } else {
        socket.emit('error', result.error);
      }
      return;
    }
    broadcastGameState(room.code);
  }));

  // ── End Turn ──

  socket.on('end-turn', () => {
    if (!gameActionLimiter.allow(uid)) { socket.emit('error', 'Too many actions, slow down'); return; }
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    const result = endTurn(room.game, uid);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    startRoomTimer(room, broadcastGameState);
    broadcastGameState(room.code);
  });

  // ── Concede ──

  socket.on('concede', () => {
    if (!gameActionLimiter.allow(uid)) { socket.emit('error', 'Too many actions, slow down'); return; }
    const room = getRoomByPlayer(uid);
    if (!room?.game || room.game.winner) return;
    const myIdx = room.game.players.findIndex(p => p.playerId === uid);
    const oppIdx = myIdx === 0 ? 1 : 0;
    room.game.winner = room.game.players[oppIdx].playerId;
    room.game.winReason = 'concede';
    room.game.pendingInteraction = null;
    room.game.turnStartedAt = null;
    room.game.lastAction = `${room.game.players[myIdx].playerName} conceded!`;
    addLog(room.game, myIdx as 0 | 1, `${room.game.players[myIdx].playerName} conceded`, 'GAME');
    clearRoomTimer(room);
    broadcastGameState(room.code);
  });

  // ── Leave Game ──

  socket.on('leave-game', () => {
    const room = getRoomByPlayer(uid);
    if (!room) return;
    clearRoomTimer(room);
    removePlayer(uid);
  });

  socket.on('leave-room', () => {
    const room = getRoomByPlayer(uid);
    if (!room) return;
    if (room.game) return; // can't leave mid-game, use leave-game
    const code = room.code;
    removePlayer(uid);
    broadcastLobby(io, code);
  });

  // ── Hover Hand ──

  socket.on('hover-hand', validated(HoverHandSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) { socket.emit('error', 'Too many actions, slow down'); return; }
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;
    for (const [pUid, sid] of room.sockets) {
      if (pUid !== uid) io.to(sid).emit('opponent-hovering', data);
    }
  }));

  // ── Choose Target ──

  socket.on('choose-target', validated(ChooseTargetSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) { socket.emit('error', 'Too many actions, slow down'); return; }
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;
    // Target is resolved inline during card play — this is for any async targeting
    broadcastGameState(room.code);
  }));

  // ── Emote ──

  socket.on('emit-emote', validated(EmoteSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) { socket.emit('error', 'Too many actions, slow down'); return; }
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;
    for (const [pUid, sid] of room.sockets) {
      if (pUid !== uid) {
        io.to(sid).emit('opponent-emote', { emoteId: data.emoteId });
      }
    }
  }));

  // ── Select Deck ──

  socket.on('select-deck', validated(SelectDeckSchema, (data) => {
    if (!lobbyLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room) return;
    if (data.deckCards) {
      room.selectedDecks.set(uid, { heroClass: data.heroClass, cards: data.deckCards });
    } else {
      room.selectedDecks.delete(uid);
    }
  }));

  // ── Rematch ──

  socket.on('request-rematch', () => {
    if (!lobbyLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room?.game?.winner) return;

    if (room.rematchProposedBy && room.rematchProposedBy !== uid) {
      clearRoomTimer(room);
      const prevFirst = room.lastFirstPlayerIndex;
      const nextFirst: 0 | 1 = prevFirst === 0 ? 1 : 0;

      const uids = Array.from(room.players.keys());
      const d0 = room.selectedDecks.get(uids[0]);
      const d1 = room.selectedDecks.get(uids[1]);
      const entries = [
        { id: uids[0], name: room.players.get(uids[0])!, heroClass: (d0?.heroClass ?? 'JIMMY') as HeroClass },
        { id: uids[1], name: room.players.get(uids[1])!, heroClass: (d1?.heroClass ?? 'TALA') as HeroClass },
      ];

      room.game = createGame(entries, {
        firstPlayerIndex: nextFirst,
        deckLists: [d0?.cards ?? null, d1?.cards ?? null],
      });
      room.lastFirstPlayerIndex = nextFirst;
      room.rematchProposedBy = null;
      startRoomTimer(room, broadcastGameState);
      broadcastGameState(room.code);
    } else {
      room.rematchProposedBy = uid;
      for (const [pUid, sid] of room.sockets) {
        if (pUid !== uid) {
          io.to(sid).emit('rematch-proposed', { proposedBy: uid });
        }
      }
    }
  });

  socket.on('decline-rematch', () => {
    if (!lobbyLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room) return;
    room.rematchProposedBy = null;
    for (const [pUid, sid] of room.sockets) {
      if (pUid !== uid) {
        io.to(sid).emit('rematch-declined');
      }
    }
  });

  socket.on('play-again', () => {
    if (!lobbyLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room) return;

    clearRoomTimer(room);
    const uids = Array.from(room.players.keys());
    const d0 = room.selectedDecks.get(uids[0]);
    const d1 = room.selectedDecks.get(uids[1]);
    const entries = [
      { id: uids[0], name: room.players.get(uids[0])!, heroClass: (d0?.heroClass ?? 'JIMMY') as HeroClass },
      { id: uids[1], name: room.players.get(uids[1])!, heroClass: (d1?.heroClass ?? 'JIMMY') as HeroClass },
    ];

    room.game = createGame(entries, { deckLists: [d0?.cards ?? null, d1?.cards ?? null] });
    startRoomTimer(room, broadcastGameState);
    broadcastGameState(room.code);
  });
}
