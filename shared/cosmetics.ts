// Cosmetic catalog: card backs and coin skins. Every account gets the
// base versions for free; others are earned via battle pass, ranked
// play, daily quests, etc. The client reads this catalog to render the
// picker in the Collection screen; the server validates
// selectedCardBack / selectedCoin against ownedCardBacks /
// ownedCoins before applying them in-game.

export type CosmeticUnlock =
  | { type: 'BASE' }                // granted to every account on signup
  | { type: 'BATTLEPASS'; tier: number }
  | { type: 'RANKED'; minRank: string }
  | { type: 'ACHIEVEMENT'; id: string }
  | { type: 'SEASONAL'; season: string };

export interface CardBackDef {
  id: string;
  name: string;
  imagePath: string;           // relative to /cards/ or /cardbacks/
  unlock: CosmeticUnlock;
  description?: string;
}

export interface CoinDef {
  id: string;
  name: string;
  imagePath: string;
  unlock: CosmeticUnlock;
  description?: string;
}

export const CARD_BACKS: CardBackDef[] = [
  {
    id: 'default',
    name: 'Miro Classic',
    imagePath: '/cards/card-back.png',
    unlock: { type: 'BASE' },
    description: 'The original Miro card back. Everyone starts with it.',
  },
  {
    id: 'bronze',
    name: 'Bronze Circuit',
    imagePath: '/cards/card-back.png', // TODO: swap when art exists
    unlock: { type: 'RANKED', minRank: 'BRONZE' },
    description: 'Reach Bronze rank.',
  },
  {
    id: 'silver',
    name: 'Silver Lattice',
    imagePath: '/cards/card-back.png',
    unlock: { type: 'RANKED', minRank: 'SILVER' },
    description: 'Reach Silver rank.',
  },
  {
    id: 'gold',
    name: 'Gold Filament',
    imagePath: '/cards/card-back.png',
    unlock: { type: 'RANKED', minRank: 'GOLD' },
    description: 'Reach Gold rank.',
  },
  {
    id: 'season1',
    name: 'Season 1: Aster Bloom',
    imagePath: '/cards/card-back.png',
    unlock: { type: 'SEASONAL', season: 'S1' },
    description: 'Earned during Season 1.',
  },
];

export const COINS: CoinDef[] = [
  {
    id: 'default',
    name: 'Miro Coin',
    imagePath: '/cards/coin.png',
    unlock: { type: 'BASE' },
    description: 'The classic coin. Everyone starts with it.',
  },
  {
    id: 'bp-tier-10',
    name: 'Glacier Coin',
    imagePath: '/cards/coin.png',
    unlock: { type: 'BATTLEPASS', tier: 10 },
    description: 'Battle Pass Tier 10.',
  },
  {
    id: 'bp-tier-25',
    name: 'Embered Coin',
    imagePath: '/cards/coin.png',
    unlock: { type: 'BATTLEPASS', tier: 25 },
    description: 'Battle Pass Tier 25.',
  },
  {
    id: 'rank-diamond',
    name: 'Diamond Coin',
    imagePath: '/cards/coin.png',
    unlock: { type: 'RANKED', minRank: 'DIAMOND' },
    description: 'Reach Diamond rank.',
  },
];

export const BASE_CARD_BACK_ID = 'default';
export const BASE_COIN_ID = 'default';

export function getCardBack(id: string): CardBackDef | undefined {
  return CARD_BACKS.find(c => c.id === id);
}

export function getCoin(id: string): CoinDef | undefined {
  return COINS.find(c => c.id === id);
}
