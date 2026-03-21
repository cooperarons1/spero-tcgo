import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ZodSchema } from 'zod';
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
} from './validation.js';
import { resolveTargetChoice } from './targeting.js';

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

// ── Rate limiting (per-socket, in-memory sliding window) ──

interface RateBucket {
  count: number;
  resetAt: number;
}

function createRateLimiter(maxEvents: number, windowMs: number) {
  const buckets = new Map<string, RateBucket>();
  return {
    allow(socketId: string): boolean {
      const now = Date.now();
      const bucket = buckets.get(socketId);
      if (!bucket || now > bucket.resetAt) {
        buckets.set(socketId, { count: 1, resetAt: now + windowMs });
        return true;
      }
      bucket.count++;
      return bucket.count <= maxEvents;
    },
    remove(socketId: string) {
      buckets.delete(socketId);
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
            // Auto-pick first valid target on timeout
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
        return; // Don't tick turn timer during combat
      }

    } catch (err) {
      console.error('Timer tick error:', err);
    }
  }, 1000);
}

function broadcastGameState(roomCode: string) {
  const room = getRoom(roomCode);
  if (!room?.game) return;

  for (const [socketId] of room.players) {
    const state = getClientState(room.game, socketId);
    io.to(socketId).emit('game-state', state);
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

  for (const [socketId] of room.players) {
    io.to(socketId).emit('lobby-update', {
      code: room.code,
      players,
      isHost: socketId === room.hostId,
    });
  }
}

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  // ── Lobby ──

  socket.on('create-room', validated(PlayerNameSchema, (name) => {
    if (!lobbyLimiter.allow(socket.id)) return;
    const room = createRoom(socket.id, name);
    socket.join(room.code);
    broadcastLobby(room.code);
  }));

  socket.on('join-room', validated(JoinRoomSchema, (data) => {
    if (!lobbyLimiter.allow(socket.id)) return;
    const room = joinRoom(data.code, socket.id, data.name);
    if (!room) {
      socket.emit('error', 'Could not join room. Check the code or the game may have started.');
      return;
    }
    socket.join(room.code);
    broadcastLobby(room.code);
  }));

  socket.on('start-game', () => {
    if (!lobbyLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room || socket.id !== room.hostId) return;
    if (room.players.size !== 2) {
      socket.emit('error', 'Need exactly 2 players to start');
      return;
    }

    const entries = Array.from(room.players.entries()).map(([id, name]) => ({ id, name }));
    const playerIds = Array.from(room.players.keys());
    const deckLists: [string[] | null, string[] | null] = [
      room.selectedDecks.get(playerIds[0]) ?? null,
      room.selectedDecks.get(playerIds[1]) ?? null,
    ];
    room.game = createGame(entries, { deckLists });
    room.lastFirstPlayerIndex = room.game.currentPlayerIndex;
    startRoomTimer(room);
    broadcastGameState(room.code);
  });

  // ── Build Phase ──

  socket.on('build-card', validated(BuildCardSchema, (data) => {
    if (!gameActionLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = buildCard(
      room.game,
      socket.id,
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
    if (!gameActionLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = splitStack(room.game, socket.id, data.stackId, data.cardInstanceIds);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  }));

  socket.on('combine-stacks', validated(CombineStacksSchema, (data) => {
    if (!gameActionLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = combineStacks(room.game, socket.id, data.stackId1, data.stackId2);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  }));

  socket.on('restore-card', validated(RestoreCardSchema, (data) => {
    if (!gameActionLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = restoreCard(room.game, socket.id, data.stackId, data.cardInstanceId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  }));

  socket.on('end-build-phase', () => {
    if (!gameActionLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = endBuildPhase(room.game, socket.id);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    startRoomTimer(room);
    broadcastGameState(room.code);
  });

  // ── Action Phase ──

  socket.on('power-mission', validated(StackTargetSchema, (data) => {
    if (!gameActionLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = startPowerMission(room.game, socket.id, data.stackId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  }));

  socket.on('smarts-mission', validated(StackTargetSchema, (data) => {
    if (!gameActionLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = startSmartsMission(room.game, socket.id, data.stackId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  }));

  socket.on('play-action-card', validated(PlayActionCardSchema, (data) => {
    if (!gameActionLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = playActionCard(room.game, socket.id, data.cardInstanceId, data.stackId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  }));

  socket.on('duel', validated(DuelSchema, (data) => {
    if (!gameActionLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = startDuel(room.game, socket.id, data.attackerStackId, data.targetStackId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  }));

  socket.on('end-action-phase', () => {
    if (!gameActionLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = endActionPhase(room.game, socket.id);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    startRoomTimer(room);
    broadcastGameState(room.code);
  });

  // ── Combat ──

  socket.on('block-decision', validated(BlockDecisionSchema, (data) => {
    if (!gameActionLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = handleBlockDecision(room.game, socket.id, data.blockingStackId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    startRoomTimer(room);
    broadcastGameState(room.code);
  }));

  socket.on('play-combat-trick', validated(PlayCombatTrickSchema, (data) => {
    if (!gameActionLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = handleCombatTrick(room.game, socket.id, data.cardInstanceId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    startRoomTimer(room);
    broadcastGameState(room.code);
  }));

  // ── Dismiss Combat Result ──

  socket.on('dismiss-combat-result', () => {
    if (!gameActionLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    room.game.combatResult = null;
    startRoomTimer(room);
    broadcastGameState(room.code);
  });

  // ── Concede ──

  socket.on('concede', () => {
    if (!gameActionLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room?.game || room.game.winner) return;
    const myIdx = room.game.players.findIndex(p => p.playerId === socket.id);
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
    if (!gameActionLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;
    for (const [sid] of room.players) {
      if (sid !== socket.id) io.to(sid).emit('opponent-hovering', data);
    }
  }));

  // ── Choose Target (targeting system) ──

  socket.on('choose-target', validated(ChooseTargetSchema, (data) => {
    if (!gameActionLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = resolveTargetChoice(room.game, socket.id, data.selectedTargetId);
    if (!result.valid) {
      socket.emit('error', 'Invalid target choice');
      return;
    }
    // The pending effect has been cleared; broadcast updated state
    broadcastGameState(room.code);
  }));

  // ── Emote ──

  socket.on('emit-emote', validated(EmoteSchema, (data) => {
    if (!gameActionLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;
    for (const [sid] of room.players) {
      if (sid !== socket.id) {
        io.to(sid).emit('opponent-emote', { emoteId: data.emoteId });
      }
    }
  }));

  // ── Select Deck ──

  socket.on('select-deck', validated(SelectDeckSchema, (data) => {
    if (!lobbyLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room) return;
    if (data.deckCards) {
      room.selectedDecks.set(socket.id, data.deckCards);
    } else {
      room.selectedDecks.delete(socket.id);
    }
  }));

  // ── Rematch Flow ──

  socket.on('request-rematch', () => {
    if (!lobbyLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room?.game?.winner) return;

    if (room.rematchProposedBy && room.rematchProposedBy !== socket.id) {
      // Both agreed — start rematch with swapped first player
      clearRoomTimer(room);
      const entries = Array.from(room.players.entries()).map(([id, name]) => ({ id, name }));
      const prevFirst = room.lastFirstPlayerIndex;
      const nextFirst: 0 | 1 = prevFirst === 0 ? 1 : 0;

      const playerIds = Array.from(room.players.keys());
      const deckLists: [string[] | null, string[] | null] = [
        room.selectedDecks.get(playerIds[0]) ?? null,
        room.selectedDecks.get(playerIds[1]) ?? null,
      ];

      room.game = createGame(entries, { firstPlayerIndex: nextFirst, deckLists });
      room.lastFirstPlayerIndex = nextFirst;
      room.rematchProposedBy = null;
      startRoomTimer(room);
      broadcastGameState(room.code);
    } else {
      // Propose rematch
      room.rematchProposedBy = socket.id;
      for (const [sid] of room.players) {
        if (sid !== socket.id) {
          io.to(sid).emit('rematch-proposed', { proposedBy: socket.id });
        }
      }
    }
  });

  socket.on('decline-rematch', () => {
    if (!lobbyLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room) return;
    room.rematchProposedBy = null;
    for (const [sid] of room.players) {
      if (sid !== socket.id) {
        io.to(sid).emit('rematch-declined');
      }
    }
  });

  // ── Play Again (legacy, kept for compatibility) ──

  socket.on('play-again', () => {
    if (!lobbyLimiter.allow(socket.id)) return;
    const room = getRoomByPlayer(socket.id);
    if (!room) return;

    clearRoomTimer(room);
    const entries = Array.from(room.players.entries()).map(([id, name]) => ({ id, name }));

    const playerIds = Array.from(room.players.keys());
    const deckLists: [string[] | null, string[] | null] = [
      room.selectedDecks.get(playerIds[0]) ?? null,
      room.selectedDecks.get(playerIds[1]) ?? null,
    ];

    room.game = createGame(entries, { deckLists });
    startRoomTimer(room);
    broadcastGameState(room.code);
  });

  // ── Disconnect ──

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
    lobbyLimiter.remove(socket.id);
    gameActionLimiter.remove(socket.id);
    const room = getRoomByPlayer(socket.id);
    if (room) {
      const code = room.code;
      if (room.players.size <= 1) {
        clearRoomTimer(room);
      }
      removePlayer(socket.id);
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
