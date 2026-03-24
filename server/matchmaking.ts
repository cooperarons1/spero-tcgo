import type { HeroClass } from '../shared/types.js';

export interface QueueEntry {
  uid: string;
  socketId: string;
  displayName: string;
  heroClass: HeroClass;
  deckCards: string[];
  queuedAt: number;
  elo: number;
}

const queue: QueueEntry[] = [];

const QUEUE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function addToQueue(entry: Omit<QueueEntry, 'elo'> & { elo?: number }): void {
  removeFromQueue(entry.uid);
  queue.push({ ...entry, elo: entry.elo ?? 1000 });
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

/** Calculate new ELO ratings after a game. K-factor = 32. */
export function calculateElo(winnerElo: number, loserElo: number): { newWinnerElo: number; newLoserElo: number } {
  const K = 32;
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
  return {
    newWinnerElo: Math.round(winnerElo + K * (1 - expectedWinner)),
    newLoserElo: Math.round(loserElo + K * (0 - expectedLoser)),
  };
}
