import { describe, it, expect } from 'vitest';
import { computeMatchEnd } from '../match-rewards.js';
import type { PlayerStats } from '../../shared/types.js';

/**
 * Pure match-end reward computation — the 120-line transaction body
 * that lived in state.ts, extracted so we can cover every branch
 * (win/loss, ranked/casual, season rollover, card-back milestones,
 * achievements, observability counters) without a Firestore mock.
 */

const ZERO_STATS: PlayerStats = {
  minionsPlayed: 0, spellsCast: 0, weaponsEquipped: 0, locationsPlayed: 0,
  heroPowerUses: 0, minionsKilled: 0, damageDealtToHeroes: 0,
  damageDealtToMinions: 0, healingDone: 0, cardsDrawn: 0,
  cardsDrawnFromEffects: 0, turnsPlayed: 0, manaSpent: 0,
};

function noAchievements() {
  return { newlyUnlocked: [], allUnlocked: [] as string[] };
}

function baseInput(overrides: Partial<Parameters<typeof computeMatchEnd>[0]> = {}) {
  return {
    userData: {},
    matchStats: ZERO_STATS,
    isWin: true,
    isRanked: false,
    heroClass: 'DES' as const,
    newElo: 1050,
    oldElo: 1000,
    currentSeasonId: 'season-1',
    achievementsCheck: noAchievements,
    ...overrides,
  };
}

describe('computeMatchEnd — basic invariants', () => {
  it('win awards 10 gold base', () => {
    const r = computeMatchEnd(baseInput({ isWin: true }));
    // Gold earned = baseGold (10) + questGold (0 at quest progress 0)
    expect(r.rewards.goldEarned).toBe(10);
    expect(r.updates.gold).toBe(10);
  });

  it('loss awards 0 gold', () => {
    const r = computeMatchEnd(baseInput({ isWin: false }));
    expect(r.rewards.goldEarned).toBe(0);
  });

  it('every 3rd win adds +10 bonus gold', () => {
    const r = computeMatchEnd(baseInput({
      isWin: true,
      userData: { gamesWon: 2 }, // this is the 3rd win
    }));
    expect(r.rewards.goldEarned).toBe(20);
  });

  it('bumps gamesPlayed + gamesWon', () => {
    const r = computeMatchEnd(baseInput({
      isWin: true,
      userData: { gamesPlayed: 10, gamesWon: 4 },
    }));
    expect(r.updates.gamesPlayed).toBe(11);
    expect(r.updates.gamesWon).toBe(5);
  });
});

describe('computeMatchEnd — ranked vs casual split', () => {
  it('ranked game bumps rankedGamesPlayed not casualGamesPlayed', () => {
    const r = computeMatchEnd(baseInput({ isRanked: true }));
    expect(r.updates.rankedGamesPlayed).toBe(1);
    expect(r.updates.casualGamesPlayed).toBe(0);
  });

  it('casual game bumps casualGamesPlayed not rankedGamesPlayed', () => {
    const r = computeMatchEnd(baseInput({ isRanked: false }));
    expect(r.updates.rankedGamesPlayed).toBe(0);
    expect(r.updates.casualGamesPlayed).toBe(1);
  });

  it('ranked win bumps heroLevels[class].rankedWins', () => {
    const r = computeMatchEnd(baseInput({ isRanked: true, isWin: true, heroClass: 'DES' }));
    expect(r.updates.heroLevels.DES.rankedWins).toBe(1);
    expect(r.updates.heroLevels.DES.wins).toBe(1);
  });

  it('casual win bumps wins but not rankedWins', () => {
    const r = computeMatchEnd(baseInput({ isRanked: false, isWin: true, heroClass: 'DES' }));
    expect(r.updates.heroLevels.DES.rankedWins).toBe(0);
    expect(r.updates.heroLevels.DES.wins).toBe(1);
  });
});

describe('computeMatchEnd — observability counters', () => {
  it('goldEarnedTotal accumulates across matches', () => {
    const r = computeMatchEnd(baseInput({
      isWin: true,
      userData: { goldEarnedTotal: 150 },
    }));
    expect(r.updates.goldEarnedTotal).toBe(150 + 10);
  });

  it('dustEarnedTotal accumulates (starts 0 if unset)', () => {
    const r = computeMatchEnd(baseInput({ isWin: true }));
    expect(r.updates.dustEarnedTotal).toBe(0); // no achievement dust
  });

  it('dustEarnedTotal picks up achievement dust rewards', () => {
    const r = computeMatchEnd(baseInput({
      isWin: true,
      achievementsCheck: () => ({
        newlyUnlocked: [{
          id: 'dust-ach',
          name: 'x', description: 'y',
          reward: { type: 'DUST', amount: 100 },
        }],
        allUnlocked: ['dust-ach'],
      }),
    }));
    expect(r.updates.dustEarnedTotal).toBe(100);
    expect(r.updates.dust).toBe(100);
  });

  it('casualGamesPlayed + rankedGamesPlayed sum to gamesPlayed', () => {
    const r = computeMatchEnd(baseInput({
      isRanked: true,
      userData: { gamesPlayed: 5, casualGamesPlayed: 3, rankedGamesPlayed: 2 },
    }));
    expect(r.updates.casualGamesPlayed + r.updates.rankedGamesPlayed)
      .toBe(r.updates.gamesPlayed);
  });
});

describe('computeMatchEnd — rank + season', () => {
  it('DIAMOND ELO unlocks diamond-frost card back', () => {
    const r = computeMatchEnd(baseInput({ newElo: 1810 }));
    expect(r.updates.cardBacks).toContain('diamond-frost');
  });

  it('LEGEND ELO unlocks legend card back', () => {
    const r = computeMatchEnd(baseInput({ newElo: 2200 }));
    expect(r.updates.cardBacks).toContain('legend');
  });

  it('BRONZE ELO does not unlock anything new', () => {
    const r = computeMatchEnd(baseInput({
      newElo: 800,
      userData: { cardBacks: ['default'] },
    }));
    expect(r.updates.cardBacks).toEqual(['default']);
  });

  it('stale seasonId triggers seasonData refresh', () => {
    const r = computeMatchEnd(baseInput({
      currentSeasonId: 'season-2',
      userData: { seasonData: { seasonId: 'season-1', peakElo: 1900, peakRankTier: 'DIAMOND', rewardsClaimed: true } },
      newElo: 1100,
    }));
    expect(r.updates.seasonData.seasonId).toBe('season-2');
    expect(r.updates.seasonData.peakElo).toBe(1100);
    expect(r.updates.seasonData.peakRankTier).toBe('BRONZE');
    expect(r.updates.seasonData.rewardsClaimed).toBe(false);
  });

  it('same seasonId + higher newElo bumps peak', () => {
    const r = computeMatchEnd(baseInput({
      userData: { seasonData: { seasonId: 'season-1', peakElo: 1000, peakRankTier: 'BRONZE', rewardsClaimed: false } },
      newElo: 1300,
    }));
    expect(r.updates.seasonData.peakElo).toBe(1300);
    expect(r.updates.seasonData.peakRankTier).toBe('SILVER');
  });

  it('same seasonId + lower newElo keeps peak (tier-floor interaction)', () => {
    const r = computeMatchEnd(baseInput({
      userData: { seasonData: { seasonId: 'season-1', peakElo: 1600, peakRankTier: 'GOLD', rewardsClaimed: false } },
      newElo: 1200,
    }));
    expect(r.updates.seasonData.peakElo).toBe(1600);
    expect(r.updates.seasonData.peakRankTier).toBe('GOLD');
  });
});

describe('computeMatchEnd — win streak tracking', () => {
  it('first win sets current=1, best=1', () => {
    const r = computeMatchEnd(baseInput({ isWin: true }));
    expect(r.updates.currentWinStreak).toBe(1);
    expect(r.updates.bestWinStreak).toBe(1);
  });

  it('second win bumps current to 2, best to 2', () => {
    const r = computeMatchEnd(baseInput({
      isWin: true, userData: { currentWinStreak: 1, bestWinStreak: 1 },
    }));
    expect(r.updates.currentWinStreak).toBe(2);
    expect(r.updates.bestWinStreak).toBe(2);
  });

  it('loss resets currentWinStreak to 0 but preserves best', () => {
    const r = computeMatchEnd(baseInput({
      isWin: false, userData: { currentWinStreak: 5, bestWinStreak: 7 },
    }));
    expect(r.updates.currentWinStreak).toBe(0);
    expect(r.updates.bestWinStreak).toBe(7);
  });

  it('current below historical best does not lower best', () => {
    const r = computeMatchEnd(baseInput({
      isWin: true, userData: { currentWinStreak: 0, bestWinStreak: 10 },
    }));
    expect(r.updates.currentWinStreak).toBe(1);
    expect(r.updates.bestWinStreak).toBe(10);
  });

  it('streak-3 achievement fires on the 3rd win (not the 4th)', () => {
    // Simulate an achievement checker that only unlocks 'streak-3'
    // when bestWinStreak reaches 3.
    const streakChecker = (d: any, _hl: any, _a: string[]) => {
      if ((d.bestWinStreak ?? 0) >= 3) {
        return {
          newlyUnlocked: [{ name: 'On a Roll', description: '', reward: { type: 'GOLD', amount: 50 } }],
          allUnlocked: ['streak-3'],
        };
      }
      return { newlyUnlocked: [], allUnlocked: [] };
    };
    const r = computeMatchEnd(baseInput({
      isWin: true,
      userData: { currentWinStreak: 2, bestWinStreak: 2 },
      achievementsCheck: streakChecker,
    }));
    // The achievement should have fired on this (the 3rd) win.
    expect(r.updates.achievements).toContain('streak-3');
    // And the 50g reward should be included in the gold update.
    expect(r.updates.gold).toBeGreaterThanOrEqual(60); // 10 base + 50 ach
  });
});

describe('computeMatchEnd — achievements + rewards shape', () => {
  it('achievement GOLD reward is added to updates.gold', () => {
    const r = computeMatchEnd(baseInput({
      isWin: true,
      achievementsCheck: () => ({
        newlyUnlocked: [{ id: 'first-win', name: 'First Win', description: '', reward: { type: 'GOLD', amount: 50 } }],
        allUnlocked: ['first-win'],
      }),
    }));
    expect(r.updates.gold).toBe(10 + 50); // base + achievement
    expect(r.rewards.achievementsUnlocked).toHaveLength(1);
  });

  it('eloChange equals newElo - oldElo', () => {
    const r = computeMatchEnd(baseInput({ newElo: 1050, oldElo: 1000 }));
    expect(r.rewards.eloChange).toBe(50);
  });

  it('rewards.rankTier reflects newElo bucket', () => {
    expect(computeMatchEnd(baseInput({ newElo: 1100 })).rewards.rankTier).toBe('BRONZE');
    expect(computeMatchEnd(baseInput({ newElo: 1250 })).rewards.rankTier).toBe('SILVER');
    expect(computeMatchEnd(baseInput({ newElo: 1600 })).rewards.rankTier).toBe('GOLD');
    expect(computeMatchEnd(baseInput({ newElo: 1850 })).rewards.rankTier).toBe('DIAMOND');
    expect(computeMatchEnd(baseInput({ newElo: 2200 })).rewards.rankTier).toBe('LEGEND');
  });
});
