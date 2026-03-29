/**
 * Ranked Seasons — Miro TCG
 * Monthly seasons with end-of-season rewards based on peak rank.
 * Seasons auto-compute from the current date.
 */

export interface Season {
  id: string;
  name: string;
  number: number;
  startDate: string; // ISO date
  endDate: string;
}

export interface SeasonReward {
  rankTier: string;
  goldReward: number;
  dustReward: number;
  packReward: number;
  cardBack?: string; // card back id awarded at this tier
}

/** User's season-specific data stored in Firestore */
export interface UserSeasonData {
  seasonId: string;
  peakElo: number;
  peakRankTier: string;
  rewardsClaimed: boolean;
}

// ─── Season Names ───
const SEASON_NAMES = [
  'Aster Academy',
  'Dominion Rising',
  'Riptide Reef',
  'Frozen Peaks',
  'Orra Crucible',
  'Ameti Awakening',
  'Gavalon Sands',
  'Polar Wilderness',
  'Alpha Convergence',
  'Starfall Summit',
  'Coral Depths',
  'Shadow Frontier',
];

// Season 1 started March 2026
const SEASON_EPOCH_YEAR = 2026;
const SEASON_EPOCH_MONTH = 3; // March (1-indexed)

/** Compute the season for any given date */
export function getSeasonForDate(date: Date = new Date()): Season {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed

  // Months since epoch
  const monthsSinceEpoch = (year - SEASON_EPOCH_YEAR) * 12 + (month - SEASON_EPOCH_MONTH);
  const seasonNumber = Math.max(1, monthsSinceEpoch + 1);
  const nameIndex = (seasonNumber - 1) % SEASON_NAMES.length;

  // Season runs from 1st of month to 1st of next month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1); // 1st of next month

  const pad = (n: number) => String(n).padStart(2, '0');

  return {
    id: `season-${year}-${pad(month)}`,
    name: `Season ${seasonNumber}: ${SEASON_NAMES[nameIndex]}`,
    number: seasonNumber,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/** Get the previous season (for reward claiming) */
export function getPreviousSeason(date: Date = new Date()): Season {
  const prev = new Date(date.getFullYear(), date.getMonth() - 1, 15);
  return getSeasonForDate(prev);
}

export const CURRENT_SEASON = getSeasonForDate();

export const SEASON_REWARDS: SeasonReward[] = [
  { rankTier: 'BRONZE', goldReward: 50, dustReward: 0, packReward: 1 },
  { rankTier: 'SILVER', goldReward: 100, dustReward: 50, packReward: 2 },
  { rankTier: 'GOLD', goldReward: 200, dustReward: 100, packReward: 3 },
  { rankTier: 'DIAMOND', goldReward: 300, dustReward: 200, packReward: 5 },
  { rankTier: 'LEGEND', goldReward: 500, dustReward: 400, packReward: 5, cardBack: 'legend' },
];

export function getSeasonReward(rankTier: string): SeasonReward {
  return SEASON_REWARDS.find(r => r.rankTier === rankTier) ?? SEASON_REWARDS[0];
}

export function getSeasonDaysLeft(date: Date = new Date()): number {
  const season = getSeasonForDate(date);
  const end = new Date(season.endDate);
  return Math.max(0, Math.ceil((end.getTime() - date.getTime()) / 86400000));
}

/**
 * Soft-reset ELO for new season.
 * Pulls toward 1000 — high ELO players drop partially, low ones rise partially.
 * Formula: newElo = floor((oldElo + 1000) / 2)
 */
export function softResetElo(elo: number): number {
  return Math.floor((elo + 1000) / 2);
}

// ─── Card Backs ───

export interface CardBackDef {
  id: string;
  name: string;
  description: string;
  /** How the card back is obtained */
  source: 'default' | 'season-reward' | 'battle-pass' | 'achievement' | 'shop';
  /** Season number for season rewards */
  seasonNumber?: number;
  /** CSS gradient or image path for rendering */
  style: {
    type: 'gradient' | 'image';
    value: string; // gradient CSS or image URL path
    borderColor: string; // tailwind color for border
  };
}

export const CARD_BACKS: CardBackDef[] = [
  {
    id: 'default',
    name: 'Miro Classic',
    description: 'The classic Miro card back.',
    source: 'default',
    style: { type: 'image', value: '/cards/card-back.png', borderColor: 'border-amber-700' },
  },
  {
    id: 'aster-academy',
    name: 'Aster Academy',
    description: 'Awarded for completing Season 1.',
    source: 'season-reward',
    seasonNumber: 1,
    style: { type: 'gradient', value: 'linear-gradient(135deg, #1e3a5f 0%, #0f1b2d 50%, #2563eb 100%)', borderColor: 'border-blue-500' },
  },
  {
    id: 'dominion-rising',
    name: 'Dominion Rising',
    description: 'Awarded for completing Season 2.',
    source: 'season-reward',
    seasonNumber: 2,
    style: { type: 'gradient', value: 'linear-gradient(135deg, #4a1942 0%, #1a0a1a 50%, #9333ea 100%)', borderColor: 'border-purple-500' },
  },
  {
    id: 'riptide-reef',
    name: 'Riptide Reef',
    description: 'Awarded for completing Season 3.',
    source: 'season-reward',
    seasonNumber: 3,
    style: { type: 'gradient', value: 'linear-gradient(135deg, #0d4f4f 0%, #0a2a2a 50%, #14b8a6 100%)', borderColor: 'border-teal-500' },
  },
  {
    id: 'legend',
    name: 'Legend',
    description: 'Reached Legend rank in a ranked season.',
    source: 'season-reward',
    style: { type: 'gradient', value: 'linear-gradient(135deg, #7c2d12 0%, #451a03 30%, #f59e0b 70%, #92400e 100%)', borderColor: 'border-yellow-500' },
  },
  {
    id: 'battle-pass-s1',
    name: 'Orra Gems',
    description: 'Season 1 Battle Pass tier 50 reward.',
    source: 'battle-pass',
    style: { type: 'gradient', value: 'linear-gradient(135deg, #065f46 0%, #022c22 50%, #10b981 100%)', borderColor: 'border-emerald-500' },
  },
  {
    id: 'diamond-frost',
    name: 'Diamond Frost',
    description: 'Reached Diamond rank in a ranked season.',
    source: 'achievement',
    style: { type: 'gradient', value: 'linear-gradient(135deg, #164e63 0%, #0c2d3d 50%, #22d3ee 100%)', borderColor: 'border-cyan-400' },
  },
  {
    id: 'golden-champion',
    name: 'Golden Champion',
    description: 'Earned 500 wins with any hero.',
    source: 'achievement',
    style: { type: 'gradient', value: 'linear-gradient(135deg, #78350f 0%, #451a03 50%, #fbbf24 100%)', borderColor: 'border-yellow-400' },
  },
];

export function getCardBack(id: string): CardBackDef {
  return CARD_BACKS.find(cb => cb.id === id) ?? CARD_BACKS[0];
}
