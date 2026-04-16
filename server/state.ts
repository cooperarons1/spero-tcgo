import type { Server } from 'socket.io';
import type { ZodSchema } from 'zod';
import type { HeroClass, Room } from '../shared/types.js';
import { TURN_TIMEOUT_MS, getRankTier } from '../shared/types.js';
import { getSeasonForDate } from '../shared/seasons.js';
import type { UserSeasonData } from '../shared/seasons.js';
import { adminDb } from './firebaseAdmin.js';
import { getRoom, clearRoomTimer } from './room.js';
import { confirmMulligan, endTurn } from './game.js';
import { getClientState, getSpectatorState } from './clientState.js';
import { addLog } from './log.js';
import { isAIPlayer, scheduleAITurn, getAIMulliganReplacements } from './ai.js';
import { calculateElo } from './matchmaking.js';
import { calculateXP, getLevel, calculateHeroXP, getHeroLevel, generateDailyQuests, shouldRefreshQuests, updateQuestProgress } from './quests.js';
import { validateDeck } from '../shared/deckRules.js';
import { isAnimModelAvailable, getCardAnimParams } from './animation-model.js';
import { getCardDef } from './cards.js';

// ── Rate limiting ──

interface RateBucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(maxEvents: number, windowMs: number) {
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

export type RateLimiter = ReturnType<typeof createRateLimiter>;

// ── Online user tracking ──
export const onlineUsers = new Map<string, string>();

// ── Pending duel challenges ──
export interface PendingChallenge {
  id: string;
  fromUid: string;
  fromName: string;
  fromSocketId: string;
  toUid: string;
  heroClass: HeroClass;
  deckCards: string[];
  createdAt: number;
}
export const pendingChallenges = new Map<string, PendingChallenge>();

// ── Spectator tracking ──
export const spectatorRooms = new Map<string, string>(); // uid -> roomCode
export const spectatorSockets = new Map<string, string>(); // uid -> socketId

// ── Validation wrapper ──

export function validated<T>(schema: ZodSchema<T>, handler: (data: T) => void) {
  return (raw: unknown) => {
    const result = schema.safeParse(raw);
    if (!result.success) return;
    handler(result.data);
  };
}

// ── Deck validation helper ──

export function validatePlayerDeck(deckCards: string[], heroClass: HeroClass): string | null {
  const result = validateDeck(deckCards, heroClass, (code) => {
    try { return getCardDef(code); } catch { return undefined; }
  });
  if (!result.valid) return result.errors.join('; ');
  return null;
}

// ── Helpers ──

export function startRoomTimer(room: Room, broadcastGameState: (code: string) => void) {
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

export function createBroadcastGameState(io: Server) {
  const broadcastGameState = (roomCode: string) => {
    const room = getRoom(roomCode);
    if (!room?.game) return;

    for (const [uid, socketId] of room.sockets) {
      if (socketId === '__ai__') continue;
      const state = getClientState(room.game, uid);
      // Attach card back info for rendering
      const oppUid = Array.from(room.players.keys()).find(u => u !== uid);
      state.opponentCardBack = room.cardBacks?.get(oppUid ?? '') ?? 'default';
      state.myCardBack = room.cardBacks?.get(uid) ?? 'default';
      state.gameMode = room.mode ?? (room.isAIGame ? 'ai' : 'casual');

      // Attach neural animation params if model is loaded. We collect
      // every cardCode the client might render an animation for — board
      // minions, locations, weapons, and the owner's own hand (for draw
      // slide-in + prepared-spell animations). Opponent hand cards are
      // hidden (cardCode null) and skipped. getCardAnimParams merges
      // params from all contexts relevant to each card's type, so one
      // flat per-card map drives entrance/attack/death/damage/buff/spell
      // animations alike.
      if (isAnimModelAvailable()) {
        const ap: Record<string, Record<string, number>> = {};
        const addParamsFor = (cardCode: string | null | undefined) => {
          if (!cardCode || ap[cardCode]) return;
          const p = getCardAnimParams(cardCode);
          if (p) ap[cardCode] = p;
        };
        for (const m of state.myBoard) addParamsFor(m.cardCode);
        for (const m of state.opponent.board) addParamsFor(m.cardCode);
        for (const c of state.myHand) addParamsFor(c.cardCode);
        for (const l of state.myLocations) addParamsFor(l.cardCode);
        for (const l of state.opponent.locations) addParamsFor(l.cardCode);
        if (state.myWeapon) addParamsFor(state.myWeapon.cardCode);
        if (state.opponent.weapon) addParamsFor(state.opponent.weapon.cardCode);
        state.animParams = ap;
      }

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
      finalizeGame(io, room);
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
  };

  return broadcastGameState;
}

export function broadcastLobby(io: Server, roomCode: string) {
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

async function finalizeGame(io: Server, room: Room) {
  if (!room?.game?.winner) return;
  const game = room.game;

  if (game._matchWritten) return;
  game._matchWritten = true;

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
    } catch (err) { console.warn('Failed to load ELO for', uids[i], err); }
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

      // ─── Atomic match-end txn ───
      const userRef = adminDb.collection('users').doc(uid);
      const { checkAchievements } = await import('../shared/achievements.js');

      const xpGain = calculateXP(isWin);
      const heroXPGain = calculateHeroXP(isWin);
      const newElo = newElos[i];
      const baseQuests = generateDailyQuests();

      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const data = snap.data() ?? {};

        const newXp = (data.xp ?? 0) + xpGain;
        const newLevel = getLevel(newXp);

        // Hero-specific XP and level
        const heroLevels = { ...(data.heroLevels ?? {}) };
        const oldHeroXP = heroLevels[heroClass]?.xp ?? 0;
        const oldHeroWins = heroLevels[heroClass]?.wins ?? 0;
        const newHeroXP = oldHeroXP + heroXPGain;
        heroLevels[heroClass] = {
          xp: newHeroXP,
          level: getHeroLevel(newHeroXP),
          wins: oldHeroWins + (isWin ? 1 : 0),
        };

        // Battle pass XP (same as game XP)
        const bp = data.battlePass ?? { seasonId: 'season-1', xp: 0, isPremium: false, claimedFree: [], claimedPremium: [] };
        bp.xp = (bp.xp ?? 0) + xpGain;

        // Quest progress
        let quests = data.quests ?? [];
        if (shouldRefreshQuests(data.questsRefreshedAt)) {
          quests = baseQuests;
        }
        const questResult = updateQuestProgress(quests, isWin, heroClass, myStats);
        quests = questResult.quests;
        const questGold = questResult.goldEarned;

        // Base gold reward: 10 gold per win, bonus 10 every 3 wins
        let baseGold = 0;
        if (isWin) {
          baseGold = 10;
          const totalWins = (data.gamesWon ?? 0) + 1;
          if (totalWins % 3 === 0) baseGold += 10;
        }
        const totalGoldEarned = questGold + baseGold;

        // Track peak rank for current season
        const currentSeason = getSeasonForDate();
        const existingSeasonData: UserSeasonData = data.seasonData ?? { seasonId: currentSeason.id, peakElo: 0, peakRankTier: 'BRONZE', rewardsClaimed: false };
        let seasonData = existingSeasonData;
        if (existingSeasonData.seasonId !== currentSeason.id) {
          seasonData = { seasonId: currentSeason.id, peakElo: newElo, peakRankTier: getRankTier(newElo), rewardsClaimed: false };
        } else if (newElo > existingSeasonData.peakElo) {
          seasonData = { ...existingSeasonData, peakElo: newElo, peakRankTier: getRankTier(newElo) };
        }

        // Award card backs for reaching Diamond or Legend
        const cardBacks: string[] = [...(data.cardBacks ?? ['default'])];
        if (getRankTier(newElo) === 'DIAMOND' && !cardBacks.includes('diamond-frost')) {
          cardBacks.push('diamond-frost');
        }
        if (getRankTier(newElo) === 'LEGEND' && !cardBacks.includes('legend')) {
          cardBacks.push('legend');
        }

        // Compute achievements inside the txn so the gold/dust gets
        // included in the SAME write — no second-write race.
        const achResult = checkAchievements(
          { ...data, gamesPlayed: (data.gamesPlayed ?? 0) + 1, gamesWon: (data.gamesWon ?? 0) + (isWin ? 1 : 0), elo: newElo },
          heroLevels,
          data.achievements ?? [],
        );
        let achievementGold = 0;
        let achievementDust = 0;
        for (const ach of achResult.newlyUnlocked) {
          if (ach.reward.type === 'GOLD') achievementGold += ach.reward.amount;
          if (ach.reward.type === 'DUST') achievementDust += ach.reward.amount;
        }

        tx.update(userRef, {
          gamesPlayed: (data.gamesPlayed ?? 0) + 1,
          gamesWon: (data.gamesWon ?? 0) + (isWin ? 1 : 0),
          elo: newElo,
          rankTier: getRankTier(newElo),
          xp: newXp,
          level: newLevel,
          gold: (data.gold ?? 0) + totalGoldEarned + achievementGold,
          dust: (data.dust ?? 0) + achievementDust,
          heroLevels,
          battlePass: bp,
          quests,
          questsRefreshedAt: shouldRefreshQuests(data.questsRefreshedAt) ? Date.now() : (data.questsRefreshedAt ?? Date.now()),
          seasonData,
          cardBacks,
          achievements: achResult.allUnlocked,
        });

        return {
          newXp,
          newLevel,
          totalGoldEarned,
          questResult,
          newHeroLevel: heroLevels[heroClass].level,
          heroWinsAfter: heroLevels[heroClass].wins,
          achievementsUnlocked: achResult.newlyUnlocked,
        };
      });

      const { newXp, newLevel, totalGoldEarned, questResult, newHeroLevel, heroWinsAfter, achievementsUnlocked } = result;

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
          heroWins: heroWinsAfter,
          achievementsUnlocked: achievementsUnlocked.map(a => ({ name: a.name, description: a.description, reward: `${a.reward.amount} ${a.reward.type}` })),
        });
      }
    } catch (err) {
      console.error(`Failed to finalize game for ${uid}:`, err);
    }
  }
}
