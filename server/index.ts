import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ZodSchema } from 'zod';
import type { HeroClass } from '../shared/types.js';
import { TURN_TIMEOUT_MS, getRankTier } from '../shared/types.js';
import { getSeasonForDate, getPreviousSeason, getSeasonReward, getSeasonDaysLeft, softResetElo, getCardBack, CARD_BACKS, CURRENT_SEASON } from '../shared/seasons.js';
import type { UserSeasonData } from '../shared/seasons.js';
import { adminAuth, adminDb } from './firebaseAdmin.js';
import { createRoom, joinRoom, getRoom, getRoomByPlayer, removePlayer, clearRoomTimer, cleanupStaleRooms, markDisconnected, tryReconnect, isDisconnected } from './room.js';
import { createGame, confirmMulligan, endTurn } from './game.js';
import { playCard, useHeroPower, activateLocation } from './actions.js';
import { attack } from './combat.js';
import { getClientState } from './clientState.js';
import { addLog } from './log.js';
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
  JoinQueueSchema,
  SearchUsersSchema,
  FriendRequestSchema,
  FriendRequestActionSchema,
  RemoveFriendSchema,
  SendChatSchema,
  ChallengeFriendSchema,
  ChallengeResponseSchema,
  StartAIGameSchema,
} from './validation.js';
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
} from './friends.js';
import { addToQueue, removeFromQueue, isInQueue, processQueue, calculateElo } from './matchmaking.js';
import { scheduleAITurn, generateAIPlayerId, randomAIName, isAIPlayer, getAIMulliganReplacements } from './ai.js';
import { STARTER_DECKS } from '../shared/starterDecks.js';
import { validateDeck } from '../shared/deckRules.js';
import { getCardDef } from './cards.js';
import { generateDailyQuests, shouldRefreshQuests, updateQuestProgress, calculateXP, getLevel, calculateHeroXP, getHeroLevel } from './quests.js';
import { getSpectatorState } from './clientState.js';

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
  pingTimeout: 60000,       // 60s before considering connection dead (default 20s)
  pingInterval: 25000,      // ping every 25s to keep Cloud Run alive (default 25s)
  connectTimeout: 45000,    // 45s to establish connection
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
});

// ── Rate limiting ──

interface RateBucket {
  count: number;
  resetAt: number;
}

function createRateLimiter(maxEvents: number, windowMs: number) {
  const buckets = new Map<string, RateBucket>();
  // Purge expired buckets every 60s to prevent memory leak from ghost UIDs
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now > bucket.resetAt) buckets.delete(key);
    }
  }, 60_000);
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
const socialLimiter = createRateLimiter(15, 10_000);

// ── Online user tracking ──
const onlineUsers = new Map<string, string>();

// ── Pending duel challenges ──
interface PendingChallenge {
  id: string;
  fromUid: string;
  fromName: string;
  fromSocketId: string;
  toUid: string;
  heroClass: HeroClass;
  deckCards: string[];
  createdAt: number;
}
const pendingChallenges = new Map<string, PendingChallenge>();

// ── Validation wrapper ──

function validated<T>(schema: ZodSchema<T>, handler: (data: T) => void) {
  return (raw: unknown) => {
    const result = schema.safeParse(raw);
    if (!result.success) return;
    handler(result.data);
  };
}

// ── Deck validation helper ──

function validatePlayerDeck(deckCards: string[], heroClass: HeroClass): string | null {
  const result = validateDeck(deckCards, heroClass, (code) => {
    try { return getCardDef(code); } catch { return undefined; }
  });
  if (!result.valid) return result.errors.join('; ');
  return null;
}

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

      // Load card backs for both players
      room.cardBacks = new Map();
      for (const pUid of [p1.uid, p2.uid]) {
        try {
          const doc = await adminDb.collection('users').doc(pUid).get();
          room.cardBacks.set(pUid, doc.data()?.selectedCardBack ?? 'default');
        } catch { room.cardBacks.set(pUid, 'default'); }
      }

      s1.join(room.code);
      s2.join(room.code);

      const uids = Array.from(room.players.keys());
      const d0 = room.selectedDecks.get(uids[0])!;
      const d1 = room.selectedDecks.get(uids[1])!;
      const entries = [
        { id: uids[0], name: room.players.get(uids[0])!, heroClass: d0.heroClass },
        { id: uids[1], name: room.players.get(uids[1])!, heroClass: d1.heroClass },
      ];

      room.game = createGame(entries, { deckLists: [d0.cards, d1.cards] });
      room.lastFirstPlayerIndex = room.game.currentPlayerIndex;

      io.to(p1.socketId).emit('match-found');
      io.to(p2.socketId).emit('match-found');

      startRoomTimer(room);
      broadcastGameState(room.code);
    }, 3000);
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
      // Turn timeout
      if (room.game.phase === 'PLAYING' && room.game.turnStartedAt) {
        const now = Date.now();
        if (now - room.game.turnStartedAt > TURN_TIMEOUT_MS) {
          // Guard against race with player's end-turn event in same tick
          const idxBefore = room.game.currentPlayerIndex;
          const currentPlayer = room.game.players[idxBefore];
          endTurn(room.game, currentPlayer.playerId);
          // Only broadcast if the turn actually changed (wasn't already ended)
          if (room.game.currentPlayerIndex !== idxBefore || room.game.winner) {
            broadcastGameState(room.code);
          }
        }
      }
    } catch (err) {
      console.error('Timer tick error:', err);
    }
  }, 1000);
}

// ── Spectator tracking ──
const spectatorRooms = new Map<string, string>(); // uid -> roomCode
const spectatorSockets = new Map<string, string>(); // uid -> socketId

function broadcastGameState(roomCode: string) {
  const room = getRoom(roomCode);
  if (!room?.game) return;

  for (const [uid, socketId] of room.sockets) {
    if (socketId === '__ai__') continue;
    const state = getClientState(room.game, uid);
    // Attach card back info for rendering
    const oppUid = Array.from(room.players.keys()).find(u => u !== uid);
    (state as any).opponentCardBack = room.cardBacks?.get(oppUid ?? '') ?? 'default';
    (state as any).myCardBack = room.cardBacks?.get(uid) ?? 'default';
    (state as any).gameMode = room.mode ?? (room.isAIGame ? 'ai' : 'casual');
    io.to(socketId).emit('game-state', state);
  }

  // Send to spectators
  const specState = getSpectatorState(room.game);
  for (const [uid, sRoomCode] of spectatorRooms) {
    if (sRoomCode !== roomCode) continue;
    const sid = spectatorSockets.get(uid);
    if (sid) io.to(sid).emit('game-state', specState);
  }

  if (room.game.winner) {
    finalizeGame(room);
  }

  // Trigger AI turn
  if (room.isAIGame && room.aiPlayerId && !room.game.winner) {
    if (room.game.phase === 'MULLIGAN') {
      // AI smart mulligan: replace expensive cards, keep cheap ones
      const aiIdx = room.game.players.findIndex(p => p.playerId === room.aiPlayerId);
      if (aiIdx >= 0 && !room.game.mulliganConfirmed[aiIdx as 0 | 1]) {
        const hand = room.game.players[aiIdx].hand;
        const heroClass = room.game.players[aiIdx].heroClass;
        const oppIdx = aiIdx === 0 ? 1 : 0;
        const oppClass = room.game.players[oppIdx].heroClass;
        confirmMulligan(room.game, room.aiPlayerId!, getAIMulliganReplacements(hand, heroClass, oppClass));
        broadcastGameState(roomCode);
      }
    } else if (room.game.phase === 'PLAYING') {
      const currentPlayerId = room.game.players[room.game.currentPlayerIndex].playerId;
      if (currentPlayerId === room.aiPlayerId) {
        scheduleAITurn(room.game, room.aiPlayerId, () => broadcastGameState(roomCode));
      }
    }
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

async function finalizeGame(room: ReturnType<typeof getRoom>) {
  if (!room?.game?.winner) return;
  const game = room.game;

  if ((game as any)._matchWritten) return;
  (game as any)._matchWritten = true;

  const uids = Array.from(room.players.keys());
  if (uids.length !== 2) return;

  const matchId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Determine winner/loser indices
  const winnerIdx = game.players.findIndex(p => p.playerId === game.winner);
  const loserIdx = winnerIdx === 0 ? 1 : 0;

  // Load ELO for both players (skip AI)
  const elos: number[] = [1000, 1000];
  for (let i = 0; i < 2; i++) {
    if (isAIPlayer(uids[i])) continue;
    try {
      const doc = await adminDb.collection('users').doc(uids[i]).get();
      if (doc.exists && doc.data()?.elo) elos[i] = doc.data()!.elo;
    } catch {}
  }

  // Calculate new ELO (only for ranked PvP games)
  const isPvP = !uids.some(u => isAIPlayer(u));
  const isRanked = isPvP && room?.mode === 'ranked';
  let newElos = elos;
  if (isRanked) {
    const result = calculateElo(elos[winnerIdx], elos[loserIdx]);
    newElos = [...elos];
    newElos[winnerIdx] = result.newWinnerElo;
    newElos[loserIdx] = result.newLoserElo;
  }

  for (let i = 0; i < 2; i++) {
    const uid = uids[i];
    if (isAIPlayer(uid)) continue;
    const oppIdx = i === 0 ? 1 : 0;
    const myStats = game.playerStats[i as 0 | 1];
    const isWin = game.winner === game.players[i].playerId;
    const heroClass = game.players[i].heroClass;

    try {
      // Write match history
      await adminDb.collection('users').doc(uid).collection('matches').doc(matchId).set({
        date: Date.now(),
        myName: game.players[i].playerName,
        opponentName: game.players[oppIdx].playerName,
        isWin,
        winReason: game.winReason,
        turns: game.turnNumber,
        myDamage: myStats.damageDealtToHeroes,
        myMinionsPlayed: myStats.minionsPlayed,
      });

      // Update user profile: ELO, XP, level, quests, game stats
      const userRef = adminDb.collection('users').doc(uid);
      const userDoc = await userRef.get();
      const userData = userDoc.data() ?? {};

      const xpGain = calculateXP(isWin);
      const newXp = (userData.xp ?? 0) + xpGain;
      const newLevel = getLevel(newXp);
      const newElo = newElos[i];

      // Hero-specific XP and level
      const heroXPGain = calculateHeroXP(isWin);
      const heroLevels = userData.heroLevels ?? {};
      const oldHeroXP = heroLevels[heroClass]?.xp ?? 0;
      const oldHeroWins = heroLevels[heroClass]?.wins ?? 0;
      const newHeroXP = oldHeroXP + heroXPGain;
      const newHeroLevel = getHeroLevel(newHeroXP);
      heroLevels[heroClass] = {
        xp: newHeroXP,
        level: newHeroLevel,
        wins: oldHeroWins + (isWin ? 1 : 0),
      };

      // Battle pass XP (same as game XP)
      const bp = userData.battlePass ?? { seasonId: 'season-1', xp: 0, isPremium: false, claimedFree: [], claimedPremium: [] };
      bp.xp = (bp.xp ?? 0) + xpGain;

      // Quest progress
      let quests = userData.quests ?? [];
      let questGold = 0;
      if (shouldRefreshQuests(userData.questsRefreshedAt)) {
        quests = generateDailyQuests();
      }
      const questResult = updateQuestProgress(quests, isWin, heroClass, myStats);
      quests = questResult.quests;
      questGold = questResult.goldEarned;

      // Base gold reward: 10 gold per win, bonus 10 every 3 wins
      let baseGold = 0;
      if (isWin) {
        baseGold = 10;
        const totalWins = (userData.gamesWon ?? 0) + 1;
        if (totalWins % 3 === 0) baseGold += 10; // bonus every 3 wins
      }
      const totalGoldEarned = questGold + baseGold;

      // Track peak rank for current season
      const currentSeason = getSeasonForDate();
      const existingSeasonData: UserSeasonData = userData.seasonData ?? { seasonId: currentSeason.id, peakElo: 0, peakRankTier: 'BRONZE', rewardsClaimed: false };
      let seasonData = existingSeasonData;
      if (existingSeasonData.seasonId !== currentSeason.id) {
        // New season — initialize fresh season data
        seasonData = { seasonId: currentSeason.id, peakElo: newElo, peakRankTier: getRankTier(newElo), rewardsClaimed: false };
      } else if (newElo > existingSeasonData.peakElo) {
        seasonData = { ...existingSeasonData, peakElo: newElo, peakRankTier: getRankTier(newElo) };
      }

      // Award card backs for reaching Diamond or Legend
      const cardBacks: string[] = userData.cardBacks ?? ['default'];
      if (getRankTier(newElo) === 'DIAMOND' && !cardBacks.includes('diamond-frost')) {
        cardBacks.push('diamond-frost');
      }
      if (getRankTier(newElo) === 'LEGEND' && !cardBacks.includes('legend')) {
        cardBacks.push('legend');
      }

      await userRef.set({
        ...userData,
        gamesPlayed: (userData.gamesPlayed ?? 0) + 1,
        gamesWon: (userData.gamesWon ?? 0) + (isWin ? 1 : 0),
        elo: newElo,
        rankTier: getRankTier(newElo),
        xp: newXp,
        level: newLevel,
        gold: (userData.gold ?? 0) + totalGoldEarned,
        heroLevels,
        battlePass: bp,
        quests,
        questsRefreshedAt: shouldRefreshQuests(userData.questsRefreshedAt) ? Date.now() : (userData.questsRefreshedAt ?? Date.now()),
        seasonData,
        cardBacks,
      }, { merge: true });

      // Check achievements
      const { checkAchievements } = await import('../shared/achievements.js');
      const achResult = checkAchievements(
        { ...userData, gamesPlayed: (userData.gamesPlayed ?? 0) + 1, gamesWon: (userData.gamesWon ?? 0) + (isWin ? 1 : 0), elo: newElo },
        heroLevels,
        userData.achievements ?? [],
      );
      let achievementGold = 0;
      let achievementDust = 0;
      for (const ach of achResult.newlyUnlocked) {
        if (ach.reward.type === 'GOLD') achievementGold += ach.reward.amount;
        if (ach.reward.type === 'DUST') achievementDust += ach.reward.amount;
      }
      if (achResult.newlyUnlocked.length > 0) {
        await userRef.set({
          achievements: achResult.allUnlocked,
          gold: (userData.gold ?? 0) + totalGoldEarned + achievementGold,
          dust: (userData.dust ?? 0) + achievementDust,
        }, { merge: true });
      }

      // Notify client of quest/XP updates
      const sid = room.sockets.get(uid);
      if (sid && sid !== '__ai__') {
        io.to(sid).emit('post-game-rewards', {
          xpGain,
          newXp,
          newLevel,
          eloChange: newElo - elos[i],
          newElo,
          rankTier: getRankTier(newElo),
          questsCompleted: questResult.quests.filter(q => q.completed).map(q => ({ description: q.description, reward: q.reward })),
          goldEarned: totalGoldEarned,
          heroXPGain,
          heroLevel: newHeroLevel,
          heroWins: heroLevels[heroClass].wins,
          achievementsUnlocked: achResult.newlyUnlocked.map(a => ({ name: a.name, description: a.description, reward: `${a.reward.amount} ${a.reward.type}` })),
        });
      }
    } catch (err) {
      console.error(`Failed to finalize game for ${uid}:`, err);
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
  onlineUsers.set(uid, socket.id);

  adminDb.collection('users').doc(uid).get().then(doc => {
    const data = doc.data() ?? {};
    const updates: Record<string, any> = { displayName, displayNameLower: displayName.toLowerCase(), lastSeen: Date.now() };
    // Initialize gold/dust for new users
    if (data.gold === undefined) updates.gold = 500;
    if (data.dust === undefined) updates.dust = 0;
    if (data.cardBacks === undefined) updates.cardBacks = ['default'];
    adminDb.collection('users').doc(uid).set(updates, { merge: true });
  }).catch(() => {});

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
        sessionStorage?.removeItem?.('spero-room-code');
      }
    }
  });

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
    startRoomTimer(room);
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

    startRoomTimer(room);
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

    const result = playCard(room.game, uid, data.cardInstanceId, data.position, data.targetId);
    if (!result.success) {
      if (result.needsTarget) {
        socket.emit('needs-target', { cardInstanceId: data.cardInstanceId, validTargets: result.validTargets });
      } else {
        socket.emit('error', result.error);
      }
      return;
    }
    broadcastGameState(room.code);
  }));

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
    startRoomTimer(room);
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
    broadcastLobby(code);
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

  // ── Matchmaking Queue ──

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
    startRoomTimer(room);
    broadcastGameState(room.code);
  });

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
    const d0 = room.selectedDecks.get(uids[0])!;
    const d1 = room.selectedDecks.get(uids[1])!;
    const entries = [
      { id: uids[0], name: room.players.get(uids[0])!, heroClass: d0.heroClass },
      { id: uids[1], name: room.players.get(uids[1])!, heroClass: d1.heroClass },
    ];

    room.game = createGame(entries, { deckLists: [d0.cards, d1.cards] });
    room.lastFirstPlayerIndex = room.game.currentPlayerIndex;

    io.to(challenge.fromSocketId).emit('challenge-accepted', { challengeId: data.challengeId });
    startRoomTimer(room);
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

  // ── Quests ──

  socket.on('get-quests', async () => {
    if (!socialLimiter.allow(uid)) return;
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      const userData = userDoc.data() ?? {};
      let quests = userData.quests ?? [];

      if (shouldRefreshQuests(userData.questsRefreshedAt)) {
        quests = generateDailyQuests();
        await adminDb.collection('users').doc(uid).set({
          quests,
          questsRefreshedAt: Date.now(),
        }, { merge: true });
      }

      socket.emit('quests-update', {
        quests,
        gold: userData.gold ?? 0,
        xp: userData.xp ?? 0,
        level: getLevel(userData.xp ?? 0),
      });
    } catch (err) {
      console.error('get-quests error:', err);
      socket.emit('quests-update', { quests: [], gold: 0, xp: 0, level: 1 });
    }
  });

  // ── Get Rank / ELO + Season Info ──

  socket.on('get-rank', async () => {
    if (!socialLimiter.allow(uid)) return;
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      const userData = userDoc.data() ?? {};
      const elo = userData.elo ?? 1000;
      const season = getSeasonForDate();
      const seasonData: UserSeasonData = userData.seasonData ?? { seasonId: season.id, peakElo: elo, peakRankTier: getRankTier(elo), rewardsClaimed: false };

      // If user's season data is for a different (old) season, they need a reset
      const needsSeasonReset = seasonData.seasonId !== season.id;
      const prevSeason = needsSeasonReset ? getPreviousSeason() : null;

      socket.emit('rank-update', {
        elo,
        rankTier: getRankTier(elo),
        gamesPlayed: userData.gamesPlayed ?? 0,
        gamesWon: userData.gamesWon ?? 0,
        season: {
          id: season.id,
          name: season.name,
          number: season.number,
          daysLeft: getSeasonDaysLeft(),
          peakRankTier: needsSeasonReset ? 'BRONZE' : (seasonData.peakRankTier ?? getRankTier(elo)),
          peakElo: needsSeasonReset ? elo : (seasonData.peakElo ?? elo),
        },
        // Flag if there are unclaimed rewards from previous season
        unclaimedSeasonRewards: needsSeasonReset && !seasonData.rewardsClaimed ? {
          seasonId: prevSeason!.id,
          seasonName: prevSeason!.name,
          peakRankTier: seasonData.peakRankTier,
          rewards: getSeasonReward(seasonData.peakRankTier),
        } : null,
      });
    } catch (err) {
      console.error('get-rank error:', err);
      socket.emit('rank-update', { elo: 1000, rankTier: 'BRONZE', gamesPlayed: 0, gamesWon: 0, season: { id: CURRENT_SEASON.id, name: CURRENT_SEASON.name, number: CURRENT_SEASON.number, daysLeft: getSeasonDaysLeft(), peakRankTier: 'BRONZE', peakElo: 1000 }, unclaimedSeasonRewards: null });
    }
  });

  // ── Claim Season Rewards ──

  socket.on('claim-season-rewards', async () => {
    if (!socialLimiter.allow(uid)) return;
    try {
      const userRef = adminDb.collection('users').doc(uid);
      const userDoc = await userRef.get();
      const userData = userDoc.data() ?? {};
      const season = getSeasonForDate();
      const seasonData: UserSeasonData = userData.seasonData ?? { seasonId: season.id, peakElo: 1000, peakRankTier: 'BRONZE', rewardsClaimed: false };

      // Only claim if user has old season data that hasn't been claimed
      if (seasonData.seasonId === season.id || seasonData.rewardsClaimed) {
        socket.emit('season-rewards-result', { success: false, reason: 'No rewards to claim' });
        return;
      }

      const reward = getSeasonReward(seasonData.peakRankTier);
      const cardBacks: string[] = userData.cardBacks ?? ['default'];

      // Award card back if applicable
      if (reward.cardBack && !cardBacks.includes(reward.cardBack)) {
        cardBacks.push(reward.cardBack);
      }
      // Award season-specific card back based on season number
      const prevSeason = getPreviousSeason();
      const prevSeasonDef = getSeasonForDate(new Date(prevSeason.startDate));
      const seasonCardBacks = CARD_BACKS.filter(cb => cb.source === 'season-reward' && cb.seasonNumber === prevSeasonDef.number);
      for (const cb of seasonCardBacks) {
        if (!cardBacks.includes(cb.id)) cardBacks.push(cb.id);
      }

      // Soft-reset ELO for new season
      const currentElo = userData.elo ?? 1000;
      const resetElo = softResetElo(currentElo);

      await userRef.set({
        gold: (userData.gold ?? 0) + reward.goldReward,
        dust: (userData.dust ?? 0) + reward.dustReward,
        cardBacks,
        elo: resetElo,
        rankTier: getRankTier(resetElo),
        seasonData: {
          seasonId: season.id,
          peakElo: resetElo,
          peakRankTier: getRankTier(resetElo),
          rewardsClaimed: false,
        },
        // Store season history
        [`seasonHistory.${seasonData.seasonId}`]: {
          peakElo: seasonData.peakElo,
          peakRankTier: seasonData.peakRankTier,
        },
      }, { merge: true });

      socket.emit('season-rewards-result', {
        success: true,
        goldReward: reward.goldReward,
        dustReward: reward.dustReward,
        packReward: reward.packReward,
        cardBack: reward.cardBack ?? null,
        newElo: resetElo,
        newRankTier: getRankTier(resetElo),
      });

      // Give packs by updating pack count (client will open them)
      // We add gold equivalent for packs (100g per pack)
      if (reward.packReward > 0) {
        await userRef.set({ gold: (userData.gold ?? 0) + reward.goldReward + (reward.packReward * 100) }, { merge: true });
      }
    } catch (err) {
      console.error('claim-season-rewards error:', err);
      socket.emit('season-rewards-result', { success: false, reason: 'Server error' });
    }
  });

  // ── Card Backs ──

  socket.on('get-card-backs', async () => {
    if (!socialLimiter.allow(uid)) return;
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      const userData = userDoc.data() ?? {};
      const owned: string[] = userData.cardBacks ?? ['default'];
      const selected: string = userData.selectedCardBack ?? 'default';
      socket.emit('card-backs-update', { owned, selected });
    } catch (err) {
      console.error('get-card-backs error:', err);
      socket.emit('card-backs-update', { owned: ['default'], selected: 'default' });
    }
  });

  socket.on('select-card-back', async (data: { cardBackId: string }) => {
    if (!socialLimiter.allow(uid)) return;
    const id = typeof data?.cardBackId === 'string' ? data.cardBackId : '';
    if (!id || !CARD_BACKS.find(cb => cb.id === id)) {
      socket.emit('error', 'Invalid card back');
      return;
    }
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      const userData = userDoc.data() ?? {};
      const owned: string[] = userData.cardBacks ?? ['default'];
      if (!owned.includes(id)) {
        socket.emit('error', 'You do not own this card back');
        return;
      }
      await adminDb.collection('users').doc(uid).set({ selectedCardBack: id }, { merge: true });
      socket.emit('card-backs-update', { owned, selected: id });
    } catch (err) {
      console.error('select-card-back error:', err);
    }
  });

  // ── Pack Opening ──

  socket.on('open-pack', async () => {
    try {
      const { openPack, PACK_COST, DUST_VALUES } = await import('./packs.js');
      const userRef = adminDb.collection('users').doc(uid);
      const userDoc = await userRef.get();
      const userData = userDoc.data() ?? {};
      const gold = userData.gold ?? 0;

      if (gold < PACK_COST) {
        socket.emit('pack-error', 'Not enough gold');
        return;
      }

      const ownedCards: Record<string, number> = userData.ownedCards ?? {};
      const packsSinceLegendary = userData.packsSinceLegendary ?? 0;
      const packsSinceEpic = userData.packsSinceEpic ?? 0;

      const result = openPack(ownedCards, packsSinceLegendary, packsSinceEpic);

      // Update owned cards and calculate dust from extras
      let dustGained = 0;
      for (const card of result.cards) {
        const current = ownedCards[card.cardCode] ?? 0;
        const max = card.rarity === 'LEGENDARY' ? 1 : 2;
        if (current < max) {
          ownedCards[card.cardCode] = current + 1;
        } else {
          // Extra card — auto-disenchant to dust
          dustGained += DUST_VALUES[card.rarity] ?? 5;
        }
      }

      await userRef.set({
        ...userData,
        gold: gold - PACK_COST,
        dust: (userData.dust ?? 0) + dustGained,
        ownedCards,
        packsOpened: (userData.packsOpened ?? 0) + 1,
        packsSinceLegendary: result.packsSinceLegendary,
        packsSinceEpic: result.packsSinceEpic,
      }, { merge: true });

      socket.emit('pack-opened', {
        cards: result.cards,
        dustGained,
        newGold: gold - PACK_COST,
        newDust: (userData.dust ?? 0) + dustGained,
      });
    } catch (err) {
      console.error('open-pack error:', err);
      socket.emit('pack-error', 'Failed to open pack');
    }
  });

  // ── Daily Login Bonus ──

  socket.on('claim-daily-login', async () => {
    try {
      const userRef = adminDb.collection('users').doc(uid);
      const userDoc = await userRef.get();
      const userData = userDoc.data() ?? {};

      const lastLogin = userData.lastDailyLogin ?? 0;
      const now = Date.now();
      const today = new Date(now);
      const lastDate = new Date(lastLogin);
      const isSameDay = today.getUTCDate() === lastDate.getUTCDate() &&
        today.getUTCMonth() === lastDate.getUTCMonth() &&
        today.getUTCFullYear() === lastDate.getUTCFullYear();

      if (isSameDay && lastLogin > 0) {
        socket.emit('daily-login-result', { alreadyClaimed: true, streak: userData.loginStreak ?? 1 });
        return;
      }

      // Check if consecutive day
      const yesterday = new Date(now - 86400000);
      const isConsecutive = lastLogin > 0 &&
        yesterday.getUTCDate() === lastDate.getUTCDate() &&
        yesterday.getUTCMonth() === lastDate.getUTCMonth() &&
        yesterday.getUTCFullYear() === lastDate.getUTCFullYear();

      const streak = isConsecutive ? (userData.loginStreak ?? 0) + 1 : 1;

      // Rewards scale with streak (capped at 7-day cycle)
      const day = ((streak - 1) % 7) + 1;
      const rewards: Record<number, { gold: number; label: string }> = {
        1: { gold: 10, label: '10 Gold' },
        2: { gold: 15, label: '15 Gold' },
        3: { gold: 20, label: '20 Gold' },
        4: { gold: 25, label: '25 Gold' },
        5: { gold: 30, label: '30 Gold' },
        6: { gold: 40, label: '40 Gold' },
        7: { gold: 100, label: '100 Gold (Weekly Bonus!)' },
      };
      const reward = rewards[day] ?? rewards[1];

      await userRef.set({
        ...userData,
        gold: (userData.gold ?? 0) + reward.gold,
        lastDailyLogin: now,
        loginStreak: streak,
      }, { merge: true });

      socket.emit('daily-login-result', {
        alreadyClaimed: false,
        streak,
        day,
        reward: reward.label,
        goldGained: reward.gold,
      });
    } catch (err) {
      console.error('daily-login error:', err);
    }
  });

  // ── Battle Pass ──

  socket.on('get-battlepass', async () => {
    try {
      const { CURRENT_SEASON, getTierFromXP } = await import('../shared/battlePass.js');
      const userDoc = await adminDb.collection('users').doc(uid).get();
      const userData = userDoc.data() ?? {};
      const bp = userData.battlePass ?? { seasonId: CURRENT_SEASON, xp: 0, isPremium: false, claimedFree: [], claimedPremium: [] };
      bp.tier = getTierFromXP(bp.xp);
      socket.emit('battlepass-update', bp);
    } catch (err) {
      console.error('get-battlepass error:', err);
    }
  });

  socket.on('claim-battlepass-reward', async (data: { tier: number; track: 'free' | 'premium' }) => {
    try {
      const { BATTLE_PASS_TIERS, CURRENT_SEASON, getTierFromXP } = await import('../shared/battlePass.js');
      const userRef = adminDb.collection('users').doc(uid);
      const userDoc = await userRef.get();
      const userData = userDoc.data() ?? {};
      const bp = userData.battlePass ?? { seasonId: CURRENT_SEASON, xp: 0, isPremium: false, claimedFree: [], claimedPremium: [] };
      bp.tier = getTierFromXP(bp.xp);

      if (data.tier > bp.tier) {
        socket.emit('battlepass-error', 'Haven\'t reached this tier yet');
        return;
      }

      const claimed = data.track === 'free' ? (bp.claimedFree ?? []) : (bp.claimedPremium ?? []);
      if (claimed.includes(data.tier)) {
        socket.emit('battlepass-error', 'Already claimed');
        return;
      }
      if (data.track === 'premium' && !bp.isPremium) {
        socket.emit('battlepass-error', 'Premium pass required');
        return;
      }

      const tierDef = BATTLE_PASS_TIERS.find(t => t.tier === data.tier);
      if (!tierDef) return;

      const reward = data.track === 'free' ? tierDef.freeReward : tierDef.premiumReward;
      claimed.push(data.tier);

      // Apply reward
      let goldGain = 0, dustGain = 0;
      if (reward.type === 'GOLD') goldGain = reward.amount ?? 0;
      if (reward.type === 'DUST') dustGain = reward.amount ?? 0;
      // PACK rewards would grant packs (simplified: give 100 gold equivalent)
      if (reward.type === 'PACK') goldGain = (reward.amount ?? 1) * 100;

      if (data.track === 'free') bp.claimedFree = claimed;
      else bp.claimedPremium = claimed;

      await userRef.set({
        ...userData,
        gold: (userData.gold ?? 0) + goldGain,
        dust: (userData.dust ?? 0) + dustGain,
        battlePass: bp,
      }, { merge: true });

      socket.emit('battlepass-reward-claimed', {
        tier: data.tier,
        track: data.track,
        reward: reward.label,
        goldGain,
        dustGain,
      });
      bp.tier = getTierFromXP(bp.xp);
      socket.emit('battlepass-update', bp);
    } catch (err) {
      console.error('claim-battlepass error:', err);
    }
  });

  // ── Craft / Disenchant ──

  socket.on('craft-card', async (data: { cardCode: string }) => {
    try {
      const { CRAFT_COSTS } = await import('./packs.js');
      const { getCardDef } = await import('./cards.js');
      const def = getCardDef(data.cardCode);
      const cost = CRAFT_COSTS[def.rarity] ?? 40;

      const userRef = adminDb.collection('users').doc(uid);
      const userDoc = await userRef.get();
      const userData = userDoc.data() ?? {};
      const dust = userData.dust ?? 0;

      if (dust < cost) {
        socket.emit('craft-error', 'Not enough dust');
        return;
      }

      const ownedCards: Record<string, number> = userData.ownedCards ?? {};
      const current = ownedCards[data.cardCode] ?? 0;
      const max = def.rarity === 'LEGENDARY' ? 1 : 2;
      if (current >= max) {
        socket.emit('craft-error', 'Already own max copies');
        return;
      }

      ownedCards[data.cardCode] = current + 1;
      const newDust = dust - cost;

      await userRef.set({ ...userData, dust: newDust, ownedCards }, { merge: true });
      socket.emit('craft-success', { cardCode: data.cardCode, newDust, newCount: current + 1 });
    } catch (err) {
      console.error('craft-card error:', err);
      socket.emit('craft-error', 'Failed to craft');
    }
  });

  socket.on('disenchant-card', async (data: { cardCode: string }) => {
    try {
      const { DUST_VALUES } = await import('./packs.js');
      const { getCardDef } = await import('./cards.js');
      const def = getCardDef(data.cardCode);
      const dustValue = DUST_VALUES[def.rarity] ?? 5;

      const userRef = adminDb.collection('users').doc(uid);
      const userDoc = await userRef.get();
      const userData = userDoc.data() ?? {};

      const ownedCards: Record<string, number> = userData.ownedCards ?? {};
      const current = ownedCards[data.cardCode] ?? 0;
      if (current <= 0) {
        socket.emit('disenchant-error', 'You don\'t own this card');
        return;
      }

      ownedCards[data.cardCode] = current - 1;
      const newDust = (userData.dust ?? 0) + dustValue;

      await userRef.set({ ...userData, dust: newDust, ownedCards }, { merge: true });
      socket.emit('disenchant-success', { cardCode: data.cardCode, newDust, dustGained: dustValue, newCount: current - 1 });
    } catch (err) {
      console.error('disenchant-card error:', err);
      socket.emit('disenchant-error', 'Failed to disenchant');
    }
  });

  // ── Get inventory (dust, gold, owned cards) ──

  socket.on('get-inventory', async () => {
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      const userData = userDoc.data() ?? {};
      socket.emit('inventory-update', {
        dust: userData.dust ?? 0,
        gold: userData.gold ?? 0,
        ownedCards: userData.ownedCards ?? {},
        packsOpened: userData.packsOpened ?? 0,
      });
    } catch (err) {
      console.error('get-inventory error:', err);
      socket.emit('inventory-update', { dust: 0, gold: 0, ownedCards: {}, packsOpened: 0 });
    }
  });

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
          broadcastLobby(code);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`Miro TCGO server running on port ${PORT}`);
});
