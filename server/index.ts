import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRoom, joinRoom, getRoom, getRoomByPlayer, removePlayer, clearRoomTimer } from './room.js';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());

// Serve built client
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res, next) => {
  if (_req.url.startsWith('/socket.io')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

function startRoomTimer(room: ReturnType<typeof getRoom>) {
  if (!room) return;
  clearRoomTimer(room);
  room.timerInterval = setInterval(() => {
    if (!room.game || room.game.winner) {
      clearRoomTimer(room);
      return;
    }
    const now = Date.now();

    // Combat interaction timeout (30s, already has timeoutAt)
    if (room.game.pendingInteraction) {
      if (now > room.game.pendingInteraction.timeoutAt) {
        const waitingId = room.game.pendingInteraction.waitingForPlayerId;
        if (room.game.combatState?.phase === 'AWAITING_BLOCK') {
          handleBlockDecision(room.game, waitingId, null);
        } else {
          handleCombatTrick(room.game, waitingId, null);
        }
        broadcastGameState(room.code);
      }
      return; // Don't tick turn timer during combat
    }

    // Turn timer (60s)
    if (!room.game.turnStartedAt) return;
    if (now > room.game.turnStartedAt + TURN_TIMEOUT_MS) {
      const currentId = room.game.players[room.game.currentPlayerIndex].playerId;
      if (room.game.turnPhase === 'BUILD') {
        endBuildPhase(room.game, currentId);
      } else if (room.game.turnPhase === 'ACTION') {
        endActionPhase(room.game, currentId);
      }
      broadcastGameState(room.code);
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

  socket.on('create-room', (name: string) => {
    const room = createRoom(socket.id, name);
    socket.join(room.code);
    broadcastLobby(room.code);
  });

  socket.on('join-room', (data: { code: string; name: string }) => {
    const room = joinRoom(data.code, socket.id, data.name);
    if (!room) {
      socket.emit('error', 'Could not join room. Check the code or the game may have started.');
      return;
    }
    socket.join(room.code);
    broadcastLobby(room.code);
  });

  socket.on('start-game', () => {
    const room = getRoomByPlayer(socket.id);
    if (!room || socket.id !== room.hostId) return;
    if (room.players.size !== 2) {
      socket.emit('error', 'Need exactly 2 players to start');
      return;
    }

    const entries = Array.from(room.players.entries()).map(([id, name]) => ({ id, name }));
    room.game = createGame(entries);
    startRoomTimer(room);
    broadcastGameState(room.code);
  });

  // ── Build Phase ──

  socket.on('build-card', (data: { cardInstanceId: string; targetStackId?: string; faceDown?: boolean }) => {
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
  });

  socket.on('split-stack', (data: { stackId: string; cardInstanceIds: string[] }) => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = splitStack(room.game, socket.id, data.stackId, data.cardInstanceIds);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  });

  socket.on('combine-stacks', (data: { stackId1: string; stackId2: string }) => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = combineStacks(room.game, socket.id, data.stackId1, data.stackId2);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  });

  socket.on('restore-card', (data: { stackId: string; cardInstanceId: string }) => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = restoreCard(room.game, socket.id, data.stackId, data.cardInstanceId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  });

  socket.on('end-build-phase', () => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = endBuildPhase(room.game, socket.id);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  });

  // ── Action Phase ──

  socket.on('power-mission', (data: { stackId: string }) => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = startPowerMission(room.game, socket.id, data.stackId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  });

  socket.on('smarts-mission', (data: { stackId: string }) => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = startSmartsMission(room.game, socket.id, data.stackId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  });

  socket.on('play-action-card', (data: { cardInstanceId: string; stackId: string }) => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = playActionCard(room.game, socket.id, data.cardInstanceId, data.stackId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  });

  socket.on('duel', (data: { attackerStackId: string; targetStackId: string }) => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = startDuel(room.game, socket.id, data.attackerStackId, data.targetStackId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  });

  socket.on('end-action-phase', () => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = endActionPhase(room.game, socket.id);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  });

  // ── Combat ──

  socket.on('block-decision', (data: { blockingStackId: string | null }) => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = handleBlockDecision(room.game, socket.id, data.blockingStackId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  });

  socket.on('play-combat-trick', (data: { cardInstanceId: string | null }) => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    const result = handleCombatTrick(room.game, socket.id, data.cardInstanceId);
    if (!result.success) {
      socket.emit('error', result.error);
      return;
    }
    broadcastGameState(room.code);
  });

  // ── Dismiss Combat Result ──

  socket.on('dismiss-combat-result', () => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;

    room.game.combatResult = null;
    broadcastGameState(room.code);
  });

  // ── Concede ──

  socket.on('concede', () => {
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

  socket.on('hover-hand', (data: { isHovering: boolean }) => {
    const room = getRoomByPlayer(socket.id);
    if (!room?.game) return;
    for (const [sid] of room.players) {
      if (sid !== socket.id) io.to(sid).emit('opponent-hovering', data);
    }
  });

  // ── Play Again ──

  socket.on('play-again', () => {
    const room = getRoomByPlayer(socket.id);
    if (!room) return;

    clearRoomTimer(room);
    const entries = Array.from(room.players.entries()).map(([id, name]) => ({ id, name }));
    room.game = createGame(entries);
    startRoomTimer(room);
    broadcastGameState(room.code);
  });

  // ── Disconnect ──

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
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
