/**
 * Ranked Seasons — Miro TCG
 * Monthly seasons with end-of-season rewards based on peak rank.
 */

export interface Season {
  id: string;
  name: string;
  startDate: string; // ISO date
  endDate: string;
}

export interface SeasonReward {
  rankTier: string;
  goldReward: number;
  dustReward: number;
  packReward: number;
  cardBack?: string;
}

// Current season
export const CURRENT_SEASON: Season = {
  id: 'season-2026-04',
  name: 'Season 1: Aster Academy',
  startDate: '2026-03-01',
  endDate: '2026-04-01',
};

export const SEASON_REWARDS: SeasonReward[] = [
  { rankTier: 'BRONZE', goldReward: 50, dustReward: 0, packReward: 1 },
  { rankTier: 'SILVER', goldReward: 100, dustReward: 50, packReward: 2 },
  { rankTier: 'GOLD', goldReward: 200, dustReward: 100, packReward: 3 },
  { rankTier: 'DIAMOND', goldReward: 300, dustReward: 200, packReward: 5 },
  { rankTier: 'LEGEND', goldReward: 500, dustReward: 400, packReward: 5, cardBack: 'legend-season1' },
];

export function getSeasonReward(rankTier: string): SeasonReward {
  return SEASON_REWARDS.find(r => r.rankTier === rankTier) ?? SEASON_REWARDS[0];
}

export function getSeasonDaysLeft(): number {
  const end = new Date(CURRENT_SEASON.endDate);
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
}
