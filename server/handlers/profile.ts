import type { Server, Socket } from 'socket.io';
import { getRankTier } from '../../shared/types.js';
import { getSeasonForDate, getPreviousSeason, getSeasonReward, getSeasonDaysLeft, softResetElo, CARD_BACKS, CURRENT_SEASON } from '../../shared/seasons.js';
import type { UserSeasonData } from '../../shared/seasons.js';
import { adminDb } from '../firebaseAdmin.js';
import { generateDailyQuests, shouldRefreshQuests, getLevel } from '../quests.js';
import type { RateLimiter } from '../state.js';
import { validated } from '../state.js';
import { SelectCardBackSchema, ClaimBattlepassRewardSchema } from '../validation.js';

export function registerProfileHandlers(
  io: Server,
  socket: Socket,
  uid: string,
  socialLimiter: RateLimiter,
) {
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

  socket.on('select-card-back', validated(SelectCardBackSchema, async (data) => {
    if (!socialLimiter.allow(uid)) return;
    const id = data.cardBackId;
    if (!CARD_BACKS.find(cb => cb.id === id)) {
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
  }));

  // ── Daily Login Bonus ──

  socket.on('claim-daily-login', async () => {
    try {
      const userRef = adminDb.collection('users').doc(uid);

      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const data = snap.data() ?? {};
        const lastLogin = data.lastDailyLogin ?? 0;
        const now = Date.now();
        const today = new Date(now);
        const lastDate = new Date(lastLogin);
        const isSameDay = today.getUTCDate() === lastDate.getUTCDate() &&
          today.getUTCMonth() === lastDate.getUTCMonth() &&
          today.getUTCFullYear() === lastDate.getUTCFullYear();

        if (isSameDay && lastLogin > 0) {
          return { ok: false as const, alreadyClaimed: true, streak: data.loginStreak ?? 1 };
        }

        // Check if consecutive day
        const yesterday = new Date(now - 86400000);
        const isConsecutive = lastLogin > 0 &&
          yesterday.getUTCDate() === lastDate.getUTCDate() &&
          yesterday.getUTCMonth() === lastDate.getUTCMonth() &&
          yesterday.getUTCFullYear() === lastDate.getUTCFullYear();

        const streak = isConsecutive ? (data.loginStreak ?? 0) + 1 : 1;
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

        // set+merge instead of update so the write succeeds even if the
        // user doc doesn't exist yet (new Firestore after project
        // migration, or brand-new user whose doc hasn't been created).
        tx.set(userRef, {
          gold: (data.gold ?? 0) + reward.gold,
          lastDailyLogin: now,
          loginStreak: streak,
        }, { merge: true });

        return { ok: true as const, streak, day, reward };
      });

      if (!result.ok) {
        socket.emit('daily-login-result', { alreadyClaimed: true, streak: result.streak });
        return;
      }
      socket.emit('daily-login-result', {
        alreadyClaimed: false,
        streak: result.streak,
        day: result.day,
        reward: result.reward.label,
        goldGained: result.reward.gold,
      });
    } catch (err) {
      console.error('daily-login error:', err);
    }
  });

  // ── Battle Pass ──

  socket.on('get-battlepass', async () => {
    try {
      const { CURRENT_SEASON, getTierFromXP } = await import('../../shared/battlePass.js');
      const userDoc = await adminDb.collection('users').doc(uid).get();
      const userData = userDoc.data() ?? {};
      const bp = userData.battlePass ?? { seasonId: CURRENT_SEASON, xp: 0, isPremium: false, claimedFree: [], claimedPremium: [] };
      bp.tier = getTierFromXP(bp.xp);
      socket.emit('battlepass-update', bp);
    } catch (err) {
      console.error('get-battlepass error:', err);
    }
  });

  socket.on('claim-battlepass-reward', validated(ClaimBattlepassRewardSchema, async (data) => {
    try {
      const { BATTLE_PASS_TIERS, CURRENT_SEASON, getTierFromXP } = await import('../../shared/battlePass.js');
      const userRef = adminDb.collection('users').doc(uid);

      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const data2 = snap.data() ?? {};
        const bp = data2.battlePass ?? { seasonId: CURRENT_SEASON, xp: 0, isPremium: false, claimedFree: [], claimedPremium: [] };
        bp.tier = getTierFromXP(bp.xp);

        if (data.tier > bp.tier) return { ok: false as const, error: "Haven't reached this tier yet" };

        const claimed = data.track === 'free' ? (bp.claimedFree ?? []) : (bp.claimedPremium ?? []);
        if (claimed.includes(data.tier)) return { ok: false as const, error: 'Already claimed' };
        if (data.track === 'premium' && !bp.isPremium) {
          return { ok: false as const, error: 'Premium pass required' };
        }

        const tierDef = BATTLE_PASS_TIERS.find(t => t.tier === data.tier);
        if (!tierDef) return { ok: false as const, error: 'Tier not found' };
        const reward = data.track === 'free' ? tierDef.freeReward : tierDef.premiumReward;
        claimed.push(data.tier);

        let goldGain = 0, dustGain = 0;
        if (reward.type === 'GOLD') goldGain = reward.amount ?? 0;
        if (reward.type === 'DUST') dustGain = reward.amount ?? 0;
        if (reward.type === 'PACK') goldGain = (reward.amount ?? 1) * 100;

        if (data.track === 'free') bp.claimedFree = claimed;
        else bp.claimedPremium = claimed;

        tx.update(userRef, {
          gold: (data2.gold ?? 0) + goldGain,
          dust: (data2.dust ?? 0) + dustGain,
          battlePass: bp,
        });

        return { ok: true as const, reward, goldGain, dustGain, bp };
      });

      if (!result.ok) {
        socket.emit('battlepass-error', result.error);
        return;
      }
      socket.emit('battlepass-reward-claimed', {
        tier: data.tier,
        track: data.track,
        reward: result.reward.label,
        goldGain: result.goldGain,
        dustGain: result.dustGain,
      });
      result.bp.tier = (await import('../../shared/battlePass.js')).getTierFromXP(result.bp.xp);
      socket.emit('battlepass-update', result.bp);
    } catch (err) {
      console.error('claim-battlepass error:', err);
    }
  }));
}
