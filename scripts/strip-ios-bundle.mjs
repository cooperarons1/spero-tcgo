// Strip card art from the iOS bundle. cardArt.tsx fetches from the
// Firebase Hosting CDN via assetUrl(), so the bundled copies were dead
// weight bloating the IPA by 314 MB and slowing first install + launch.
// Keeps card-back.png/webp because Card.tsx renders it via a bare
// `/cards/card-back.png` path (it ships even on offline cold start).

import { rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PUBLIC = 'ios/App/App/public';
const CARDS = join(PUBLIC, 'cards');
const KEEP = new Set(['card-back.png', 'card-back.webp']);

if (!existsSync(CARDS)) {
  console.log(`[strip-ios] ${CARDS} not present; skipping.`);
  process.exit(0);
}

let removedBytes = 0;
let removedCount = 0;

for (const entry of readdirSync(CARDS)) {
  if (KEEP.has(entry)) continue;
  const path = join(CARDS, entry);
  const stat = statSync(path);
  removedBytes += stat.isDirectory() ? dirSize(path) : stat.size;
  rmSync(path, { recursive: true, force: true });
  removedCount += 1;
}

function dirSize(p) {
  let total = 0;
  for (const e of readdirSync(p)) {
    const child = join(p, e);
    const s = statSync(child);
    total += s.isDirectory() ? dirSize(child) : s.size;
  }
  return total;
}

const mb = (removedBytes / (1024 * 1024)).toFixed(1);
console.log(`[strip-ios] removed ${removedCount} entries from ${CARDS} (${mb} MB freed; cards now CDN-only on iOS).`);
