import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ZodSchema } from 'zod';
import { adminAuth, adminDb } from './firebaseAdmin.js';
import { createRoom, joinRoom, getRoom, getRoomByPlayer, removePlayer, clearRoomTimer, cleanupStaleRooms } from './room.js';
import { createGame, endBuildPhase, endActionPhase, TURN_TIMEOUT_MS } from './game.js';
import { buildCard, splitStack, combineStacks, restoreCard } from './actions.js';
import {
  startPowerMission,
  startSmartsMission,
  handleBlockDecision,
  handleCombatTrick,
  startDuel,
  playActionCard,
} from './combat.js';
import { getClientState } from './clientState.js';
import { addLog } from './log.js';
import {
  PlayerNameSchema,
  JoinRoomSchema,
  BuildCardSchema,
  SplitStackSchema,
  CombineStacksSchema,
  RestoreCardSchema,
  StackTargetSchema,
  PlayActionCardSchema,
  DuelSchema,
  BlockDecisionSchema,
  PlayCombatTrickSchema,
  HoverHandSchema,
  ChooseTargetSchema,
  EmoteSchema,
  SelectDeckSchema,
  JoinQueueSchema,
} from './validation.js';
import { resolveTargetChoice } from './targeting.js';
import { addToQueue, removeFromQueue, isInQueue, processQueue } from './matchmaking.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CORS whitelist ──

const PROD_ORIGINS = [
  'https://spero-tcgo.web.app',
  'https://spero-tcgo.firebaseapp.com',
];

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3002',
];

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? PROD_ORIGINS
  : [...PROD_ORIGINS, ...DEV_ORIGINS];

const app = express();
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));

// Serve built client
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res, next) => {
  if (_req.url.startsWith('/socket.io')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins },
});

// ── Rate limiting (per-uid, in-memory sliding window) ──

interface RateBucket {
  count: number;
  resetAt: number;
}

function createRateLimiter(maxEvents: number, windowMs: number) {
  const buckets = new Map<string, RateBucket>();
  return {
    allow(key: string): boolean {
      const now = Date.now();
      const bucket = buckets.get(key);
      if (!bucket || now > bucket.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      bucket.count++;
      return bucket.count <= maxEvents;
    },
    remove(key: string) {
      buckets.delete(key);
    },
  };
}

const lobbyLimiter = createRateLimiter(5, 10_000);
const gameActionLimiter = createRateLimiter(30, 5_000);

// ── Validation wrapper ──

function validated<T>(schema: ZodSchema<T>, handler: (data: T) => void) {
  return (raw: unknown) => {
    const result = schema.safeParse(raw);
    if (!result.success) return;
    handler(result.data);
  };
}

// ── Stale room cleanup (every 5 min) ──

setInterval(() => cleanupStaleRooms(), 5 * 60 * 1000);

// ── Matchmaking queue check (every 2s) ──

setInterval(() => {
  const { matched, timedOut } = processQueue();

  for (const entry of timedOut) {
    io.to(entry.socketId).emit('queue-timeout');
  }

  if (matched) {
    const [p1, p2] = matched;
    // Auto-create room and start game
    const room = createRoom(p1.uid, p1.socketId, p1.displayName);
    joinRoom(room.code, p2.uid, p2.socketId, p2.displayName);

    room.selectedDecks.set(p1.uid, p1.deckCards);
    room.selectedDecks.set(p2.uid, p2.deckCards);

    // Join socket rooms
    const s1 = io.sockets.sockets.get(p1.socketId);
    const s2 = io.sockets.sockets.get(p2.socketId);
    s1?.join(room.code);
    s2?.join(room.code);

    const entries = Array.from(room.players.entries()).map(([id, name]) => ({ id, name }));
    const uids = Array.from(room.players.keys());
    const deckLists: [string[] | null, string[] | null] = [
      room.selectedDecks.get(uids[0]) ?? null,
      room.selectedDecks.get(uids[1]) ?? null,
    ];
    room.game = createGame(entries, { deckLists });
    room.lastFirstPlayerIndex = room.game.currentPlayerIndex;

    // Emit match-found to both
    io.to(p1.socketId).emit('match-found');
    io.to(p2.socketId).emit('match-found');

    startRoomTimer(room);
    broadcastGameState(room.code);
  }
}, 2000);

// ── Helpers ──

function startRoomTimer(room: ReturnType<typeof getRoom>) {
  if (!room) return;
  clearRoomTimer(room);
  room.timerInterval = setInterval(() => {
    try {
      if (!room.game || room.game.winner) {
        clearRoomTimer(room);
        return;
      }
      const now = Date.now();

      // Combat/targeting interaction timeout (30s, already has timeoutAt)
      if (room.game.pendingInteraction) {
        if (now > room.game.pendingInteraction.timeoutAt) {
          const waitingId = room.game.pendingInteraction.waitingForPlayerId;
          if (room.game.pendingInteraction.type === 'CHOOSE_TARGET') {
            const choice = room.game.pendingInteraction.targetChoice;
            if (choice && choice.validTargets.length > 0) {
              resolveTargetChoice(room.game, waitingId, choice.validTargets[0].id);
            } else {
              resolveTargetChoice(room.game, waitingId, null);
            }
          } else if (room.game.combatState?.phase === 'AWAITING_BLOCK') {
            handleBlockDecision(room.game, waitingId, null);
          } else {
            handleCombatTrick(room.game, waitingId, null);
          }
          broadcastGameState(room.code);
        }
        return;
      }

    } catch (err) {
      console.error('Timer tick error:', err);
    }
  }, 1000);
}

function broadcastGameState(roomCode: string) {
  const room = getRoom(roomCode);
  if (!room?.game) return;

  for (const [uid, socketId] of room.sockets) {
    const state = getClientState(room.game, uid);
    io.to(socketId).emit('game-state', state);
  }

  // Check if game just ended and write match records
  if (room.game.winner) {
    finalizeGame(room);
  }
}

function broadcastLobby(roomCode: string) {
  const room = getRoom(roomCode);
  if (!room) return;

  const players = Array.from(room.players.entries()).map(([id, name]) => ({
    id,
    name,
    isHost: id === room.hostId,
  }));

  for (const [uid, socketId] of room.sockets) {
    io.to(socketId).emit('lobby-update', {
      code: room.code,
      players,
      isHost: uid === room.hostId,
    });
  }
}

/** Write match records to Firestore for both players */
async function finalizeGame(room: ReturnType<typeof getRoom>) {
  if (!room?.game?.winner) return;
  const game = room.game;

  // Avoid double-writing
  if ((game as any)._matchWritten) return;
  (game as any)._matchWritten = true;

  const uids = Array.from(room.players.keys());
  if (uids.length !== 2) return;

  const matchId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  for (let i = 0; i < 2; i++) {
    const uid = uids[i];
    const oppIdx = i === 0 ? 1 : 0;
    const myStats = game.playerStats[i as 0 | 1];
    const oppStats = game.playerStats[oppIdx as 0 | 1];

    try {
      await adminDb.collection('users').doc(uid).collection('matches').doc(matchId).set({
        date: Date.now(),
        myName: game.players[i].playerName,
        opponentName: game.players[oppIdx].playerName,
        isWin: game.winner === game.players[i].playerId,
        winReason: game.winReason,
        myAP: game.apScores[i as 0 | 1],
        opponentAP: game.apScores[oppIdx as 0 | 1],
        turns: game.turnNumber,
        myMissions: myStats.missionsLaunched,
        opponentMissions: oppStats.missionsLaunched,
        myDamage: myStats.damageDealt,
        opponentDamage: oppStats.damageDealt,
      });
    } catch (err) {
      console.error(`Failed to write match for ${uid}:`, err);
    }
  }
}

// ── Auth Middleware ──

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No auth token'));
    const decoded = await adminAuth.verifyIdToken(token);
    socket.data.uid = decoded.uid;
    socket.data.displayName = decoded.name || decoded.email?.split('@')[0] || 'Player';
    next();
  } catch (err) {
    next(new Error('Invalid auth token'));
  }
});

io.on('connection', (socket) => {
  const uid = socket.data.uid as string;
  const displayName = socket.data.displayName as string;
  console.log(`Connected: ${uid} (${displayName}) [${socket.id}]`);

  // ── Lobby ──

  socket.on('create-room', validated(PlayerNameSchema, (name) => {
    if (!lobbyLimiter.allow(uid)) return;
    const room = createRoom(uid, socket.id, name);
    socket.join(room.code);
    broadcastLobby(room.code);
  }));

  socket.on('join-room', validated(JoinRoomSchema, (data) => {
    if (!lobbyLimiter.allow(uid)) return;
    const room = joinRoom(data.code, uid, socket.id, data.name);
    if (!room) {
      socket.emit('error', 'Could not join room. Check the code or the game may have started.');
      return;
    }
    socket.join(room.code);
    broadcastLobby(room.code);
  }));

  socket.on('start-game', () => {
    if (!lobbyLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room || uid !== room.hostId) return;
    if (room.players.size !== 2) {
      socket.emit('error', 'Need exactly 2 players to start');
      return;
    }

    const entries = Array.from(room.players.entries()).map(([id, name]) => ({ id, name }));
    const uids = Array.from(room.players.keys());
    const deckLists: [string[] | null, string[] | null] = [
      room.selectedDecks.get(uids[0]) ?? null,
      room.selectedDecks.get(uids[1]) ?? null,
    ];
    room.game = createGame(entries, { deckLists });
    room.lastFirstPlayerIndex = room.game.currentPlayerIndex;
    startRoomTimer(room);
    broadcastGameState(room.code);
  });

  // ── Build Phase ──

  socket.on('build-card', validated(BuildCardSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    const result = buildCard(
      room.game,
      uid,
      data.cardInstanceId,
      data.targetStackId ?? null,
      data.faceDown ?? false
    );
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  }));

  socket.on('split-stack', validated(SplitStackSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    const result = splitStack(room.game, uid, data.stackId, data.cardInstanceIds);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  }));

  socket.on('combine-stacks', validated(CombineStacksSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    const result = combineStacks(room.game, uid, data.stackId1, data.stackId2);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  }));

  socket.on('restore-card', validated(RestoreCardSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    const result = restoreCard(room.game, uid, data.stackId, data.cardInstanceId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  }));

  socket.on('end-build-phase', () => {
    if (!gameActionLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    const result = endBuildPhase(room.game, uid);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    startRoomTimer(room);
    broadcastGameState(room.code);
  });

  // ── Action Phase ──

  socket.on('power-mission', validated(StackTargetSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    const result = startPowerMission(room.game, uid, data.stackId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  }));

  socket.on('smarts-mission', validated(StackTargetSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    const result = startSmartsMission(room.game, uid, data.stackId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  }));

  socket.on('play-action-card', validated(PlayActionCardSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    const result = playActionCard(room.game, uid, data.cardInstanceId, data.stackId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  }));

  socket.on('duel', validated(DuelSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    const result = startDuel(room.game, uid, data.attackerStackId, data.targetStackId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  }));

  socket.on('end-action-phase', () => {
    if (!gameActionLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    const result = endActionPhase(room.game, uid);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    startRoomTimer(room);
    broadcastGameState(room.code);
  });

  // ── Combat ──

  socket.on('block-decision', validated(BlockDecisionSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    const result = handleBlockDecision(room.game, uid, data.blockingStackId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    startRoomTimer(room);
    broadcastGameState(room.code);
  }));

  socket.on('play-combat-trick', validated(PlayCombatTrickSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    const result = handleCombatTrick(room.game, uid, data.cardInstanceId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    startRoomTimer(room);
    broadcastGameState(room.code);
  }));

  // ── Dismiss Combat Result ──

  socket.on('dismiss-combat-result', () => {
    if (!gameActionLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    room.game.combatResult = null;
    startRoomTimer(room);
    broadcastGameState(room.code);
  });

  // ── Concede ──

  socket.on('concede', () => {
    if (!gameActionLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room?.game || room.game.winner) return;
    const myIdx = room.game.players.findIndex(p => p.playerId === uid);
    const oppIdx = myIdx === 0 ? 1 : 0;
    room.game.winner = room.game.players[oppIdx].playerId;
    room.game.winReason = 'concede';
    room.game.turnStartedAt = null;
    room.game.lastAction = `${room.game.players[myIdx].playerName} conceded!`;
    addLog(room.game, myIdx as 0 | 1, `${room.game.players[myIdx].playerName} conceded`, 'GAME');
    clearRoomTimer(room);
    broadcastGameState(room.code);
  });

  // ── Hover Hand ──

  socket.on('hover-hand', validated(HoverHandSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;
    for (const [pUid, sid] of room.sockets) {
      if (pUid !== uid) io.to(sid).emit('opponent-hovering', data);
    }
  }));

  // ── Choose Target (targeting system) ──

  socket.on('choose-target', validated(ChooseTargetSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room?.game) return;

    const result = resolveTargetChoice(room.game, uid, data.selectedTargetId);
    if (!result.valid) {
      socket.emit('error', 'Invalid target choice');
      return;
    }
    broadcastGameState(room.code);
  }));

  // ── Emote ──

  socket.on('emit-emote', validated(EmoteSchema, (data) => {
    if (!gameActionLimiter.allow(uid)) return;
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
      room.selectedDecks.set(uid, data.deckCards);
    } else {
      room.selectedDecks.delete(uid);
    }
  }));

  // ── Matchmaking Queue ──

  socket.on('join-queue', validated(JoinQueueSchema, (data) => {
    if (!lobbyLimiter.allow(uid)) return;
    // Block if already in a room
    if (getRoomByPlayer(uid)) {
      socket.emit('error', 'Already in a room');
      return;
    }
    addToQueue({
      uid,
      socketId: socket.id,
      displayName,
      deckCards: data.deckCards,
      queuedAt: Date.now(),
    });
  }));

  socket.on('leave-queue', () => {
    removeFromQueue(uid);
  });

  // ── Rematch Flow ──

  socket.on('request-rematch', () => {
    if (!lobbyLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room?.game?.winner) return;

    if (room.rematchProposedBy && room.rematchProposedBy !== uid) {
      clearRoomTimer(room);
      const entries = Array.from(room.players.entries()).map(([id, name]) => ({ id, name }));
      const prevFirst = room.lastFirstPlayerIndex;
      const nextFirst: 0 | 1 = prevFirst === 0 ? 1 : 0;

      const uids = Array.from(room.players.keys());
      const deckLists: [string[] | null, string[] | null] = [
        room.selectedDecks.get(uids[0]) ?? null,
        room.selectedDecks.get(uids[1]) ?? null,
      ];

      room.game = createGame(entries, { firstPlayerIndex: nextFirst, deckLists });
      room.lastFirstPlayerIndex = nextFirst;
      room.rematchProposedBy = null;
      startRoomTimer(room);
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

  // ── Play Again (legacy) ──

  socket.on('play-again', () => {
    if (!lobbyLimiter.allow(uid)) return;
    const room = getRoomByPlayer(uid);
    if (!room) return;

    clearRoomTimer(room);
    const entries = Array.from(room.players.entries()).map(([id, name]) => ({ id, name }));

    const uids = Array.from(room.players.keys());
    const deckLists: [string[] | null, string[] | null] = [
      room.selectedDecks.get(uids[0]) ?? null,
      room.selectedDecks.get(uids[1]) ?? null,
    ];

    room.game = createGame(entries, { deckLists });
    startRoomTimer(room);
    broadcastGameState(room.code);
  });

  // ── Disconnect ──

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${uid} [${socket.id}]`);
    lobbyLimiter.remove(uid);
    gameActionLimiter.remove(uid);
    removeFromQueue(uid);
    const room = getRoomByPlayer(uid);
    if (room) {
      const code = room.code;
      if (room.players.size <= 1) {
        clearRoomTimer(room);
      }
      removePlayer(uid);
      if (!room.game) {
        broadcastLobby(code);
      }
    }
  });
});

const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`Spero TCGO server running on port ${PORT}`);
});
