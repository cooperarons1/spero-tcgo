import type { HeroClass } from '../shared/types.js';

export interface QueueEntry {
  uid: string;
  socketId: string;
  displayName: string;
  heroClass: HeroClass;
  deckCards: string[];
  queuedAt: number;
}

const queue: QueueEntry[] = [];

const QUEUE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function addToQueue(entry: QueueEntry): void {
  removeFromQueue(entry.uid);
  queue.push(entry);
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
    const p1 = queue.shift()!;
    const p2 = queue.shift()!;
    return { matched: [p1, p2], timedOut };
  }

  return { matched: null, timedOut };
}
