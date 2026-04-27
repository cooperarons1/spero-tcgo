import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { adminAuth, adminDb } from './firebaseAdmin.js';
import { createRoom, joinRoom, getRoom, getRoomByPlayer, removePlayer, clearRoomTimer, cleanupStaleRooms, markDisconnected, tryReconnect } from './room.js';
import { createGame } from './game.js';
import { addLog } from './log.js';
import { processQueue, removeFromQueue } from './matchmaking.js';
import {
  createRateLimiter,
  createBroadcastGameState,
  broadcastLobby,
  startRoomTimer,
  onlineUsers,
  spectatorRooms,
  spectatorSockets,
} from './state.js';
import { registerGameHandlers } from './handlers/game.js';
import { registerShopHandlers } from './handlers/shop.js';
import { registerSocialHandlers } from './handlers/social.js';
import { registerProfileHandlers } from './handlers/profile.js';
import { registerMatchmakingHandlers } from './handlers/matchmaking.js';
import { buildFullCollection } from './cards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CORS whitelist ──
//
// Native wrappers (Capacitor iOS, Electron Steam) connect from non-https
// origins that don't appear on the web. WKWebView reports `capacitor://localhost`
// (or `https://localhost` if `iosScheme: 'https'`); Electron's packaged build
// loads files from `file://`. Allow both unconditionally so future native
// builds connect without server changes.
//
// CORS_ORIGINS env var (comma-separated) appends extra origins at runtime —
// used for custom domains (e.g. https://mirotcg.com) and beta builds without
// rebuilding/redeploying the server.

const PROD_ORIGINS = [
  'https://spero-tcgo.web.app',
  'https://spero-tcgo.firebaseapp.com',
];

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3002',
];

const NATIVE_ORIGINS = [
  'capacitor://localhost',
  'https://localhost',
  'file://',
];

const EXTRA_ORIGINS = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = [
  ...(process.env.NODE_ENV === 'production'
    ? PROD_ORIGINS
    : [...PROD_ORIGINS, ...DEV_ORIGINS]),
  ...NATIVE_ORIGINS,
  ...EXTRA_ORIGINS,
];

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
  pingTimeout: 60000,       // 60s before considering connection dead (default 20s)
  pingInterval: 25000,      // ping every 25s to keep Cloud Run alive (default 25s)
  connectTimeout: 45000,    // 45s to establish connection
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
});

// ── Rate limiters ──

const lobbyLimiter = createRateLimiter(5, 10_000);
const gameActionLimiter = createRateLimiter(30, 5_000);
const socialLimiter = createRateLimiter(15, 10_000);

// ── Broadcast helper (bound to this io instance) ──

const broadcastGameState = createBroadcastGameState(io);

// ── Stale room cleanup ──
setInterval(() => cleanupStaleRooms(), 5 * 60 * 1000);

// ── Matchmaking queue ──
setInterval(() => {
  const { matched, timedOut } = processQueue();

  for (const entry of timedOut) {
    io.to(entry.socketId).emit('queue-timeout');
  }

  if (matched) {
    const [p1, p2] = matched;

    setTimeout(async () => {
      const s1 = io.sockets.sockets.get(p1.socketId);
      const s2 = io.sockets.sockets.get(p2.socketId);
      if (!s1 || !s2) return;

      const room = createRoom(p1.uid, p1.socketId, p1.displayName);
      joinRoom(room.code, p2.uid, p2.socketId, p2.displayName);
      room.mode = p1.mode; // casual or ranked

      room.selectedDecks.set(p1.uid, { heroClass: p1.heroClass, cards: p1.deckCards });
      room.selectedDecks.set(p2.uid, { heroClass: p2.heroClass, cards: p2.deckCards });

      // Load card backs + rank tiers for both players
      room.cardBacks = new Map();
      room.rankTiers = new Map();
      const { getRankTier } = await import('../shared/types.js');
      for (const pUid of [p1.uid, p2.uid]) {
        try {
          const doc = await adminDb.collection('users').doc(pUid).get();
          const d = doc.data() ?? {};
          room.cardBacks.set(pUid, d.selectedCardBack ?? 'default');
          // Rank tier derives from current ELO — sent to the client so
          // the in-game HUD can display a tier badge during ranked
          // matches without leaking raw ELO.
          room.rankTiers.set(pUid, getRankTier(d.elo ?? 1000));
        } catch (err) {
          console.warn('Failed to load profile for', pUid, err);
          room.cardBacks.set(pUid, 'default');
          room.rankTiers.set(pUid, 'BRONZE');
        }
      }

      s1.join(room.code);
      s2.join(room.code);

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

      io.to(p1.socketId).emit('match-found');
      io.to(p2.socketId).emit('match-found');

      startRoomTimer(room, broadcastGameState);
      broadcastGameState(room.code);
    }, 3000);
  }
}, 2000);

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
  onlineUsers.set(uid, socket.id);

  adminDb.collection('users').doc(uid).get().then(doc => {
    const data = doc.data() ?? {};
    const updates: Record<string, string | number | string[] | Record<string, number>> = { displayName, displayNameLower: displayName.toLowerCase(), lastSeen: Date.now() };
    // Initialize gold/dust for new users
    if (data.gold === undefined) updates.gold = 500;
    if (data.dust === undefined) updates.dust = 0;
    if (data.cardBacks === undefined) updates.cardBacks = ['default'];
    // Shop + pack opening are shelved — every user (new OR existing with
    // an empty collection) gets the full card pool so they can
    // deckbuild and play immediately.
    const owned = data.ownedCards ?? {};
    if (Object.keys(owned).length === 0) updates.ownedCards = buildFullCollection();
    adminDb.collection('users').doc(uid).set(updates, { merge: true });
  }).catch((err) => { console.warn('Failed to init user profile for', uid, err); });

  // Check for reconnection
  const reconnectedRoom = tryReconnect(uid, socket.id);
  if (reconnectedRoom) {
    console.log(`Reconnected: ${uid} to room ${reconnectedRoom.code}`);
    socket.join(reconnectedRoom.code);
    socket.emit('reconnected', { roomCode: reconnectedRoom.code });
    // Notify opponent that this player reconnected
    for (const [pUid, sid] of reconnectedRoom.sockets) {
      if (pUid !== uid && sid !== '__ai__') {
        io.to(sid).emit('opponent-reconnected');
      }
    }
    if (reconnectedRoom.game) {
      broadcastGameState(reconnectedRoom.code);
    }
  }

  // ── Rejoin room (client-initiated reconnection) ──

  socket.on('rejoin-room', (data: { roomCode?: string }) => {
    if (!data?.roomCode) return;
    // Try the standard reconnect path first
    const room = tryReconnect(uid, socket.id);
    if (room) {
      console.log(`Rejoin-room: ${uid} rejoined ${room.code}`);
      socket.join(room.code);
      socket.emit('reconnected', { roomCode: room.code });
      // Notify opponent
      for (const [pUid, sid] of room.sockets) {
        if (pUid !== uid && sid !== '__ai__') {
          io.to(sid).emit('opponent-reconnected');
        }
      }
      if (room.game) {
        broadcastGameState(room.code);
      }
    } else {
      // Check if player is still in the room (e.g. socket refreshed but not disconnected)
      const existingRoom = getRoomByPlayer(uid);
      if (existingRoom && existingRoom.code === data.roomCode.toUpperCase()) {
        existingRoom.sockets.set(uid, socket.id);
        socket.join(existingRoom.code);
        socket.emit('reconnected', { roomCode: existingRoom.code });
        for (const [pUid, sid] of existingRoom.sockets) {
          if (pUid !== uid && sid !== '__ai__') {
            io.to(sid).emit('opponent-reconnected');
          }
        }
        if (existingRoom.game) {
          broadcastGameState(existingRoom.code);
        }
      } else {
        // Room doesn't exist (server restarted) — tell client to go back to lobby
        socket.emit('room-lost');
      }
    }
  });

  // ── Register all handler groups ──

  registerGameHandlers(io, socket, uid, displayName, lobbyLimiter, gameActionLimiter, broadcastGameState);
  registerShopHandlers(io, socket, uid);
  registerSocialHandlers(io, socket, uid, displayName, socialLimiter, broadcastGameState);
  registerProfileHandlers(io, socket, uid, socialLimiter);
  registerMatchmakingHandlers(io, socket, uid, displayName, lobbyLimiter);

  // ── Disconnect ──

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${uid} [${socket.id}]`);
    onlineUsers.delete(uid);
    lobbyLimiter.remove(uid);
    gameActionLimiter.remove(uid);
    removeFromQueue(uid);
    // Clean up spectating
    const specRoom = spectatorRooms.get(uid);
    if (specRoom) {
      const room = getRoom(specRoom);
      if (room?.game?.spectators) {
        room.game.spectators = room.game.spectators.filter(s => s !== uid);
      }
      spectatorRooms.delete(uid);
      spectatorSockets.delete(uid);
    }
    const room = getRoomByPlayer(uid);
    if (room) {
      const code = room.code;
      if (room.game && !room.game.winner) {
        markDisconnected(uid, (expiredRoom, dcUid) => {
          // Grace period expired — opponent wins by disconnect
          if (!expiredRoom.game || expiredRoom.game.winner) return;
          const dcIdx = expiredRoom.game.players.findIndex(p => p.playerId === dcUid);
          if (dcIdx === -1) return;
          const winnerIdx = dcIdx === 0 ? 1 : 0;
          expiredRoom.game.winner = expiredRoom.game.players[winnerIdx].playerId;
          expiredRoom.game.winReason = 'disconnect';
          expiredRoom.game.pendingInteraction = null;
          expiredRoom.game.turnStartedAt = null;
          expiredRoom.game.lastAction = `${expiredRoom.game.players[dcIdx].playerName} disconnected`;
          addLog(expiredRoom.game, dcIdx as 0 | 1, `${expiredRoom.game.players[dcIdx].playerName} disconnected — opponent wins`, 'GAME');
          clearRoomTimer(expiredRoom);
          broadcastGameState(expiredRoom.code);
        });
        for (const [pUid, sid] of room.sockets) {
          if (pUid !== uid && sid !== '__ai__') {
            io.to(sid).emit('opponent-disconnected', { gracePeriodMs: 120000 });
          }
        }
      } else {
        if (room.players.size <= 1) {
          clearRoomTimer(room);
        }
        removePlayer(uid);
        if (!room.game) {
          broadcastLobby(io, code);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`Miro TCGO server running on port ${PORT}`);
});
