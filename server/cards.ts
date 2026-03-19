import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { CardDef } from '../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const raw = JSON.parse(readFileSync(path.join(__dirname, '..', 'data', 'cards.json'), 'utf-8'));

const cardDefs: Map<string, CardDef> = new Map();
for (const c of raw) {
  cardDefs.set(c.cardCode, c as CardDef);
}

export function getCardDef(cardCode: string): CardDef {
  const def = cardDefs.get(cardCode);
  if (!def) throw new Error(`Unknown cardCode: ${cardCode}`);
  return def;
}

export function getAllCardDefs(): CardDef[] {
  return Array.from(cardDefs.values());
}

export function getCardsByColor(color: string): CardDef[] {
  return getAllCardDefs().filter((c) => c.color === color);
}
