import type { HeroClass } from '../shared/types.js';

export interface QueueEntry {
  uid: string;
  socketId: string;
  displayName: string;
  heroClass: HeroClass;
  deckCards: string[];
  queuedAt: number;
  elo: number;
  mode: 'casual' | 'ranked';
}

const queue: QueueEntry[] = [];

const QUEUE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function addToQueue(entry: Omit<QueueEntry, 'elo'> & { elo?: number }): void {
  removeFromQueue(entry.uid);
  queue.push({ ...entry, elo: entry.elo ?? 1000, mode: entry.mode ?? 'casual' });
}

export function removeFromQueue(uid: string): void {
  const idx = queue.findIndex(e => e.uid === uid);
  if (idx >= 0) queue.splice(idx, 1);
}

export function isInQueue(uid: string): boolean {
  return queue.some(e => e.uid === uid);
}

export function processQueue(): { matched: [QueueEntry, QueueEntry] | null; timedOut: QueueEntry[] } {
  const now = Date.now();
  const timedOut: QueueEntry[] = [];

  for (let i = queue.length - 1; i >= 0; i--) {
    if (now - queue[i].queuedAt > QUEUE_TIMEOUT_MS) {
      timedOut.push(queue.splice(i, 1)[0]);
    }
  }

  if (queue.length >= 2) {
    // Try to find the best ELO-based match
    for (let i = 0; i < queue.length; i++) {
      const p1 = queue[i];
      const waitSeconds = (now - p1.queuedAt) / 1000;

      // Determine allowed ELO range based on wait time
      let allowedRange: number;
      if (waitSeconds >= 60) {
        allowedRange = Infinity; // match anyone
      } else if (waitSeconds >= 30) {
        allowedRange = 400;
      } else {
        allowedRange = 200;
      }

      // Find closest ELO opponent
      let bestIdx = -1;
      let bestEloDiff = Infinity;
      for (let j = 0; j < queue.length; j++) {
        if (j === i) continue;
        if (queue[j].mode !== p1.mode) continue; // only match same mode
        const diff = Math.abs(p1.elo - queue[j].elo);
        if (diff <= allowedRange && diff < bestEloDiff) {
          bestEloDiff = diff;
          bestIdx = j;
        }
      }

      if (bestIdx !== -1) {
        // Remove both from queue (remove higher index first to preserve indices)
        const [hiIdx, loIdx] = bestIdx > i ? [bestIdx, i] : [i, bestIdx];
        const pHi = queue.splice(hiIdx, 1)[0];
        const pLo = queue.splice(loIdx, 1)[0];
        const matched: [QueueEntry, QueueEntry] = hiIdx > i ? [pLo, pHi] : [pHi, pLo];
        return { matched, timedOut };
      }
    }
  }

  return { matched: null, timedOut };
}

/** Placement-match count — K-factor is scaled during a player's first
 * few ranked games so they settle near their true rank faster.
 * Matches typical ladder design (chess USCF K=40 for provisional). */
export const PLACEMENT_MATCHES = 5;
export const K_PLACEMENT = 48;   // 1.5× normal
export const K_NORMAL = 32;

/** K-factor for a player based on their ranked-games-played. First
 * PLACEMENT_MATCHES games use the higher K so provisional players
 * hit their true rank in ~5 games instead of 20+. */
export function kFactorFor(rankedGamesPlayed: number): number {
  return rankedGamesPlayed < PLACEMENT_MATCHES ? K_PLACEMENT : K_NORMAL;
}

/** Rank-tier floors — once a player reaches a tier this season, ELO
 * can't drop below that tier's threshold for the rest of the season.
 * Prevents a tilted loss streak from dropping you from Gold all the
 * way to Bronze overnight. Mirrors getRankTier thresholds. */
const TIER_FLOORS: Record<string, number> = {
  BRONZE: 0,
  SILVER: 1200,
  GOLD: 1500,
  DIAMOND: 1800,
  LEGEND: 2100,
};

/** Clamp ELO to the floor of the peak tier reached this season. */
export function applyRankFloor(newElo: number, peakRankTier: string): number {
  const floor = TIER_FLOORS[peakRankTier] ?? 0;
  return Math.max(newElo, floor);
}

/** Calculate new ELO ratings after a game. K defaults to 32 per side
 * unless a placement K is passed in via opts (used when a player has
 * fewer than PLACEMENT_MATCHES ranked games). */
export function calculateElo(
  winnerElo: number,
  loserElo: number,
  opts?: { winnerK?: number; loserK?: number },
): { newWinnerElo: number; newLoserElo: number } {
  const winnerK = opts?.winnerK ?? K_NORMAL;
  const loserK = opts?.loserK ?? K_NORMAL;
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
  return {
    newWinnerElo: Math.round(winnerElo + winnerK * (1 - expectedWinner)),
    newLoserElo: Math.round(loserElo + loserK * (0 - expectedLoser)),
  };
}
