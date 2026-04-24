/**
 * Pure match-end reward computation — extracted from state.ts's
 * ~120-line adminDb.runTransaction body so it's unit-testable
 * without a Firestore mock.
 *
 * The transaction layer just does: read → call computeMatchEnd(input)
 * → tx.update(ref, result.updates). All math (XP, levels, quests,
 * hero XP, gold, rank floors, card back awards, achievements, and
 * the new lifetime counters for observability) happens here.
 *
 * Non-goals:
 * - Does NOT touch Firestore. Caller is responsible for the atomic
 *   read/write.
 * - Does NOT emit the post-game-rewards socket event. Caller owns
 *   that, but `result.rewards` is the exact payload shape it needs.
 */

import type { HeroClass, RankTier, PlayerStats } from '../shared/types.js';
import { getRankTier } from '../shared/types.js';
import {
  generateDailyQuests, updateQuestProgress, shouldRefreshQuests,
  calculateXP, calculateHeroXP, getLevel, getHeroLevel,
} from './quests.js';

export interface ComputeMatchEndInput {
  userData: Record<string, any>;
  matchStats: PlayerStats;
  isWin: boolean;
  isRanked: boolean;
  heroClass: HeroClass;
  newElo: number;
  oldElo: number;
  currentSeasonId: string;
  /** Passed in so the helper doesn't reach into the season module and
   * the test can inject a fixed value. */
  achievementsCheck: (
    data: any,
    heroLevels: any,
    achievements: string[],
  ) => { newlyUnlocked: any[]; allUnlocked: string[] };
}

export interface MatchEndResult {
  updates: Record<string, any>;
  rewards: {
    xpGain: number;
    newXp: number;
    newLevel: number;
    eloChange: number;
    newElo: number;
    rankTier: RankTier;
    questsCompleted: Array<{ description: string; reward: number }>;
    goldEarned: number;
    heroXPGain: number;
    heroLevel: number;
    heroWins: number;
    achievementsUnlocked: Array<any>;
  };
}

export function computeMatchEnd(input: ComputeMatchEndInput): MatchEndResult {
  const {
    userData: data, matchStats, isWin, isRanked, heroClass,
    newElo, oldElo, currentSeasonId, achievementsCheck,
  } = input;

  const xpGain = calculateXP(isWin);
  const heroXPGain = calculateHeroXP(isWin);

  const newXp = (data.xp ?? 0) + xpGain;
  const newLevel = getLevel(newXp);

  // Hero-specific XP / level / ranked-wins tracking.
  const heroLevels = { ...(data.heroLevels ?? {}) };
  const oldHeroXP = heroLevels[heroClass]?.xp ?? 0;
  const oldHeroWins = heroLevels[heroClass]?.wins ?? 0;
  const newHeroXP = oldHeroXP + heroXPGain;
  const oldRankedWins = heroLevels[heroClass]?.rankedWins ?? 0;
  const newRankedWins = oldRankedWins + (isRanked && isWin ? 1 : 0);
  heroLevels[heroClass] = {
    xp: newHeroXP,
    level: getHeroLevel(newHeroXP),
    wins: oldHeroWins + (isWin ? 1 : 0),
    rankedWins: newRankedWins,
  };

  // Battle pass XP (same as game XP)
  const bp = data.battlePass ?? {
    seasonId: 'season-1', xp: 0, isPremium: false,
    claimedFree: [], claimedPremium: [],
  };
  bp.xp = (bp.xp ?? 0) + xpGain;

  // Quest progress + refresh
  const shouldRefresh = shouldRefreshQuests(data.questsRefreshedAt);
  let quests = data.quests ?? [];
  if (shouldRefresh) quests = generateDailyQuests();
  const questResult = updateQuestProgress(quests, isWin, heroClass, matchStats);
  quests = questResult.quests;
  const questGold = questResult.goldEarned;

  // Base gold reward: 10 per win, +10 every 3rd win.
  let baseGold = 0;
  if (isWin) {
    baseGold = 10;
    const totalWins = (data.gamesWon ?? 0) + 1;
    if (totalWins % 3 === 0) baseGold += 10;
  }
  const totalGoldEarned = questGold + baseGold;

  // Season data — refresh if the stored season is stale, bump peak if
  // the new ELO is higher than the stored peak.
  const existingSeasonData = data.seasonData ?? {
    seasonId: currentSeasonId, peakElo: 0, peakRankTier: 'BRONZE', rewardsClaimed: false,
  };
  let seasonData = existingSeasonData;
  if (existingSeasonData.seasonId !== currentSeasonId) {
    seasonData = {
      seasonId: currentSeasonId, peakElo: newElo,
      peakRankTier: getRankTier(newElo), rewardsClaimed: false,
    };
  } else if (newElo > existingSeasonData.peakElo) {
    seasonData = {
      ...existingSeasonData,
      peakElo: newElo, peakRankTier: getRankTier(newElo),
    };
  }

  // Card-back milestones.
  const cardBacks: string[] = [...(data.cardBacks ?? ['default'])];
  if (getRankTier(newElo) === 'DIAMOND' && !cardBacks.includes('diamond-frost')) {
    cardBacks.push('diamond-frost');
  }
  if (getRankTier(newElo) === 'LEGEND' && !cardBacks.includes('legend')) {
    cardBacks.push('legend');
  }

  // Achievements — checked inside the "future" state so a newly-bumped
  // gamesPlayed / gamesWon / elo reading is what fires the unlock.
  const achResult = achievementsCheck(
    {
      ...data,
      gamesPlayed: (data.gamesPlayed ?? 0) + 1,
      gamesWon: (data.gamesWon ?? 0) + (isWin ? 1 : 0),
      elo: newElo,
    },
    heroLevels,
    data.achievements ?? [],
  );
  let achievementGold = 0;
  let achievementDust = 0;
  for (const ach of achResult.newlyUnlocked) {
    if (ach.reward?.type === 'GOLD') achievementGold += ach.reward.amount;
    if (ach.reward?.type === 'DUST') achievementDust += ach.reward.amount;
  }

  // Observability — lifetime counters for the economy audit. Tracked
  // separately from the current balance so we can see "how much gold
  // has this account ever earned" even after they spent it on packs.
  const addedGold = totalGoldEarned + achievementGold;
  const addedDust = achievementDust;
  const goldEarnedTotal = (data.goldEarnedTotal ?? 0) + addedGold;
  const dustEarnedTotal = (data.dustEarnedTotal ?? 0) + addedDust;
  const casualGamesPlayed = (data.casualGamesPlayed ?? 0) + (isRanked ? 0 : 1);
  const rankedGamesPlayed = (data.rankedGamesPlayed ?? 0) + (isRanked ? 1 : 0);

  // Win streak — resets on loss, bumps best when a new high is hit.
  // Powers the WIN_STREAK family of achievements (streak-3/5/10);
  // pre-refactor neither field was ever incremented so those
  // achievements were unreachable.
  const currentWinStreak = isWin ? (data.currentWinStreak ?? 0) + 1 : 0;
  const bestWinStreak = Math.max(data.bestWinStreak ?? 0, currentWinStreak);

  // Achievements are checked AFTER streak values update so a streak-3
  // unlock fires on the 3rd win rather than the 4th.
  // (achievementsCheck call above ran against stale streak counters —
  // re-run with updated values so WIN_STREAK-based unlocks can fire.)
  const achResult2 = achievementsCheck(
    {
      ...data,
      gamesPlayed: (data.gamesPlayed ?? 0) + 1,
      gamesWon: (data.gamesWon ?? 0) + (isWin ? 1 : 0),
      elo: newElo,
      bestWinStreak,
    },
    heroLevels,
    Array.from(new Set([...(data.achievements ?? []), ...achResult.allUnlocked])),
  );
  // Dedupe the second pass by id — real checkAchievements already
  // skips unlocked ids via `unlocked.has(ach.id)`, but a test double
  // without that dedupe shouldn't double-count gold/dust, and we want
  // defense in depth against future checker variants.
  const firstPassIds = new Set(
    achResult.newlyUnlocked.map((a: any) => a?.id).filter(Boolean),
  );
  const trulyNew = achResult2.newlyUnlocked.filter(
    (a: any) => !a?.id || !firstPassIds.has(a.id),
  );
  for (const ach of trulyNew) {
    if (ach.reward?.type === 'GOLD') achievementGold += ach.reward.amount;
    if (ach.reward?.type === 'DUST') achievementDust += ach.reward.amount;
  }
  const allNewlyUnlocked = [...achResult.newlyUnlocked, ...trulyNew];
  const allUnlocked = Array.from(
    new Set([...achResult.allUnlocked, ...achResult2.allUnlocked]),
  );
  const addedGoldWithStreak = totalGoldEarned + achievementGold;
  const addedDustWithStreak = achievementDust;

  const updates: Record<string, any> = {
    gamesPlayed: (data.gamesPlayed ?? 0) + 1,
    gamesWon: (data.gamesWon ?? 0) + (isWin ? 1 : 0),
    elo: newElo,
    rankTier: getRankTier(newElo),
    rankedGamesPlayed,
    casualGamesPlayed,
    currentWinStreak,
    bestWinStreak,
    xp: newXp,
    level: newLevel,
    gold: (data.gold ?? 0) + addedGoldWithStreak,
    dust: (data.dust ?? 0) + addedDustWithStreak,
    goldEarnedTotal: (data.goldEarnedTotal ?? 0) + addedGoldWithStreak,
    dustEarnedTotal: (data.dustEarnedTotal ?? 0) + addedDustWithStreak,
    heroLevels,
    battlePass: bp,
    quests,
    questsRefreshedAt: shouldRefresh ? Date.now() : (data.questsRefreshedAt ?? Date.now()),
    seasonData,
    cardBacks,
    achievements: allUnlocked,
  };

  return {
    updates,
    rewards: {
      xpGain,
      newXp,
      newLevel,
      eloChange: newElo - oldElo,
      newElo,
      rankTier: getRankTier(newElo),
      questsCompleted: questResult.quests
        .filter(q => q.completed)
        .map(q => ({ description: q.description, reward: q.reward })),
      goldEarned: addedGoldWithStreak,
      heroXPGain,
      heroLevel: heroLevels[heroClass].level,
      heroWins: heroLevels[heroClass].wins,
      achievementsUnlocked: allNewlyUnlocked,
    },
  };
}
