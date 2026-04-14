import { describe, it, expect, vi } from 'vitest';
import {
  calculateXP,
  calculateHeroXP,
  getLevel,
  getHeroLevel,
  getHeroXPForLevel,
  getHeroLevelProgress,
  shouldRefreshQuests,
  generateDailyQuests,
  updateQuestProgress,
} from '../quests.js';
import type { DailyQuest, PlayerStats } from '../../shared/types.js';

// ── XP / Level calculations ───────────────────────────────────────

describe('calculateXP', () => {
  it('returns 50 for a win', () => { expect(calculateXP(true)).toBe(50); });
  it('returns 20 for a loss', () => { expect(calculateXP(false)).toBe(20); });
});

describe('calculateHeroXP', () => {
  it('returns 30 for a win', () => { expect(calculateHeroXP(true)).toBe(30); });
  it('returns 10 for a loss', () => { expect(calculateHeroXP(false)).toBe(10); });
});

describe('getLevel', () => {
  it('level 1 at 0 XP', () => { expect(getLevel(0)).toBe(1); });
  it('level 1 at 99 XP', () => { expect(getLevel(99)).toBe(1); });
  it('level 2 at 100 XP', () => { expect(getLevel(100)).toBe(2); });
  it('level 10 at 999 XP', () => { expect(getLevel(999)).toBe(10); });
  it('level 11 at 1000 XP', () => { expect(getLevel(1000)).toBe(11); });
});

describe('getHeroLevel', () => {
  it('level 1 at 0 XP', () => { expect(getHeroLevel(0)).toBe(1); });
  it('level 1 at 49 XP', () => { expect(getHeroLevel(49)).toBe(1); });
  it('level 2 at 50 XP', () => { expect(getHeroLevel(50)).toBe(2); });
  it('level 10 at 450 XP', () => { expect(getHeroLevel(450)).toBe(10); });
  it('caps at 60', () => { expect(getHeroLevel(5000)).toBe(60); });
});

describe('getHeroXPForLevel', () => {
  it('0 XP for level 1', () => { expect(getHeroXPForLevel(1)).toBe(0); });
  it('50 XP for level 2', () => { expect(getHeroXPForLevel(2)).toBe(50); });
  it('450 XP for level 10', () => { expect(getHeroXPForLevel(10)).toBe(450); });
  it('0 XP for level 0 (clamp)', () => { expect(getHeroXPForLevel(0)).toBe(0); });
  it('0 XP for negative level (clamp)', () => { expect(getHeroXPForLevel(-1)).toBe(0); });
});

describe('getHeroLevelProgress', () => {
  it('0 progress at 0 XP', () => { expect(getHeroLevelProgress(0)).toBe(0); });
  it('0.5 at 25 XP (mid level 1)', () => { expect(getHeroLevelProgress(25)).toBe(0.5); });
  it('0 at level boundary (50 XP)', () => { expect(getHeroLevelProgress(50)).toBe(0); });
  it('1.0 at max level', () => { expect(getHeroLevelProgress(3000)).toBe(1); });
  it('correct mid-level at 75 XP', () => { expect(getHeroLevelProgress(75)).toBe(0.5); });
});

// ── Quest refresh logic ───────────────────────────────────────────

describe('shouldRefreshQuests', () => {
  it('returns true when never refreshed', () => {
    expect(shouldRefreshQuests(undefined)).toBe(true);
  });

  it('returns false when refreshed today', () => {
    expect(shouldRefreshQuests(Date.now())).toBe(false);
  });

  it('returns true when refreshed yesterday', () => {
    const yesterday = Date.now() - 25 * 60 * 60 * 1000;
    expect(shouldRefreshQuests(yesterday)).toBe(true);
  });
});

// ── Quest generation ──────────────────────────────────────────────

describe('generateDailyQuests', () => {
  it('generates exactly 3 quests', () => {
    const quests = generateDailyQuests();
    expect(quests).toHaveLength(3);
  });

  it('all quests have required fields', () => {
    const quests = generateDailyQuests();
    for (const q of quests) {
      expect(q.id).toBeTruthy();
      expect(q.type).toBeTruthy();
      expect(q.target).toBeGreaterThan(0);
      expect(q.reward).toBeGreaterThan(0);
      expect(q.progress).toBe(0);
      expect(q.completed).toBe(false);
    }
  });

  it('no duplicate type-target combos', () => {
    // Run multiple times to increase confidence
    for (let i = 0; i < 20; i++) {
      const quests = generateDailyQuests();
      const keys = quests.map(q => `${q.type}-${q.target}`);
      expect(new Set(keys).size).toBe(3);
    }
  });
});

// ── Quest progress ────────────────────────────────────────────────

function makeQuest(type: string, target: number, heroClass?: string): DailyQuest {
  return {
    id: `test-${type}`,
    type: type as any,
    description: 'test',
    target,
    progress: 0,
    reward: 50,
    heroClass: heroClass as any,
    completed: false,
  };
}

const baseStats: PlayerStats = {
  minionsPlayed: 5,
  spellsCast: 3,
  damageDealtToHeroes: 10,
  minionsKilled: 4,
  cardsDrawn: 7,
  manaSpent: 20,
  turnsPlayed: 8,
};

describe('updateQuestProgress', () => {
  it('WIN_GAMES increments on win', () => {
    const quests = [makeQuest('WIN_GAMES', 3)];
    const result = updateQuestProgress(quests, true, 'JIMMY', baseStats);
    expect(result.quests[0].progress).toBe(1);
  });

  it('WIN_GAMES does not increment on loss', () => {
    const quests = [makeQuest('WIN_GAMES', 3)];
    const result = updateQuestProgress(quests, false, 'JIMMY', baseStats);
    expect(result.quests[0].progress).toBe(0);
  });

  it('WIN_GAMES_AS_CLASS increments on win with matching class', () => {
    const quests = [makeQuest('WIN_GAMES_AS_CLASS', 3, 'JIMMY')];
    const result = updateQuestProgress(quests, true, 'JIMMY', baseStats);
    expect(result.quests[0].progress).toBe(1);
  });

  it('WIN_GAMES_AS_CLASS does not increment on wrong class', () => {
    const quests = [makeQuest('WIN_GAMES_AS_CLASS', 3, 'JIMMY')];
    const result = updateQuestProgress(quests, true, 'TALA', baseStats);
    expect(result.quests[0].progress).toBe(0);
  });

  it('PLAY_MINIONS adds minionsPlayed', () => {
    const quests = [makeQuest('PLAY_MINIONS', 10)];
    const result = updateQuestProgress(quests, false, 'JIMMY', baseStats);
    expect(result.quests[0].progress).toBe(5);
  });

  it('DEAL_DAMAGE_TO_HEROES adds damage', () => {
    const quests = [makeQuest('DEAL_DAMAGE_TO_HEROES', 20)];
    const result = updateQuestProgress(quests, false, 'JIMMY', baseStats);
    expect(result.quests[0].progress).toBe(10);
  });

  it('CAST_SPELLS adds spellsCast', () => {
    const quests = [makeQuest('CAST_SPELLS', 5)];
    const result = updateQuestProgress(quests, false, 'JIMMY', baseStats);
    expect(result.quests[0].progress).toBe(3);
  });

  it('DESTROY_MINIONS adds minionsKilled', () => {
    const quests = [makeQuest('DESTROY_MINIONS', 8)];
    const result = updateQuestProgress(quests, false, 'JIMMY', baseStats);
    expect(result.quests[0].progress).toBe(4);
  });

  it('completion triggers gold reward', () => {
    const quests = [makeQuest('WIN_GAMES', 1)];
    quests[0].reward = 75;
    const result = updateQuestProgress(quests, true, 'JIMMY', baseStats);
    expect(result.quests[0].completed).toBe(true);
    expect(result.goldEarned).toBe(75);
  });

  it('already-completed quest not double-counted', () => {
    const quests = [makeQuest('WIN_GAMES', 1)];
    quests[0].completed = true;
    quests[0].progress = 1;
    const result = updateQuestProgress(quests, true, 'JIMMY', baseStats);
    expect(result.goldEarned).toBe(0);
    expect(result.quests[0].progress).toBe(1); // unchanged
  });

  it('multiple quests updated in single call', () => {
    const quests = [
      makeQuest('WIN_GAMES', 1),
      makeQuest('PLAY_MINIONS', 5),
    ];
    const result = updateQuestProgress(quests, true, 'JIMMY', baseStats);
    expect(result.quests[0].completed).toBe(true);
    expect(result.quests[1].completed).toBe(true);
    expect(result.goldEarned).toBe(100); // 50 + 50
  });
});
