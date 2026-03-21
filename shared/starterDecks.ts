export interface StarterDeckDef {
  id: string;
  name: string;
  color: string;
  cards: string[]; // 60 card codes
}

// Red cards (41 unique)
const RED_CARDS = [
  'BL005', 'R001', 'R002', 'R003', 'R004', 'R005', 'R006', 'R007', 'R008', 'R009',
  'R010', 'R011', 'R012', 'R013', 'R014', 'R015', 'R016', 'R017', 'R018', 'R019',
  'R020', 'R021', 'R022', 'R023', 'R024', 'R025', 'R026', 'R027', 'R028', 'R029',
  'R030', 'R031', 'R032', 'R033', 'R034', 'R035', 'R036', 'R037', 'R038', 'R039', 'R040',
];

// Green cards (35 unique)
const GREEN_CARDS = [
  'GR001', 'GR002', 'GR003', 'GR004', 'GR005', 'GR006', 'GR007', 'GR008', 'GR009', 'GR010',
  'GR011', 'GR012', 'GR013', 'GR014', 'GR015', 'GR016', 'GR017', 'GR018', 'GR019', 'GR020',
  'GR021', 'GR022', 'GR023', 'GR024', 'GR025', 'GR026', 'GR027', 'GR028', 'GR029', 'GR030',
  'GR031', 'GR032', 'GR033', 'GR034', 'GR035',
];

// Blue cards (33 unique)
const BLUE_CARDS = [
  'U001', 'U002', 'U003', 'U004', 'U005', 'U006', 'U007', 'U008', 'U009', 'U010',
  'U011', 'U012', 'U013', 'U014', 'U015', 'U016', 'U017', 'U018', 'U019', 'U020',
  'U021', 'U022', 'U023', 'U024', 'U025', 'U026', 'U027', 'U028', 'U029', 'U030',
  'U031', 'U032', 'U033',
];

// Yellow cards (32 unique)
const YELLOW_CARDS = [
  'Y001', 'Y002', 'Y003', 'Y004', 'Y005', 'Y006', 'Y007', 'Y008', 'Y009', 'Y011',
  'Y012', 'Y013', 'Y014', 'Y015', 'Y016', 'Y017', 'Y018', 'Y019', 'Y020', 'Y021',
  'Y022', 'Y023', 'Y024', 'Y025', 'Y026', 'Y027', 'Y028', 'Y032', 'Y033', 'Y034',
  'Y035', 'Y036',
];

// Black cards (34 unique, BL005 is red)
const BLACK_CARDS = [
  'BL001', 'BL002', 'BL003', 'BL004', 'BL006', 'BL007', 'BL008', 'BL009', 'BL010',
  'BL011', 'BL012', 'BL013', 'BL014', 'BL015', 'BL016', 'BL017', 'BL018', 'BL019',
  'BL020', 'BL021', 'BL022', 'BL023', 'BL024', 'BL025', 'BL026', 'BL027', 'BL028',
  'BL029', 'BL030', 'BL031', 'BL032', 'BL033', 'BL034', 'BL035',
];

// All 44 colorless cards
const COLORLESS_CARDS = [
  'LESS001', 'LESS002', 'LESS003', 'LESS004', 'LESS005', 'LESS006', 'LESS007', 'LESS008',
  'LESS009', 'LESS010', 'LESS011', 'LESS012', 'LESS013', 'LESS014', 'LESS015', 'LESS016',
  'LESS017', 'LESS018', 'LESS019', 'LESS020', 'LESS021', 'LESS022', 'LESS023', 'LESS024',
  'LESS025', 'LESS026', 'LESS027', 'LESS028', 'LESS029', 'LESS030', 'LESS031', 'LESS032',
  'LESS033', 'LESS034', 'LESS035', 'LESS036', 'LESS037', 'LESS038', 'LESS039', 'LESS040',
  'LESS041', 'LESS042', 'LESS043',
];

/** Fill a deck to 60 cards using colorless cards (up to 2 copies each) */
function fillWithColorless(colorCards: string[], pool: string[]): string[] {
  const needed = 60 - colorCards.length;
  const filler: string[] = [];
  let poolIdx = 0;

  // First pass: 1 copy each
  while (filler.length < needed && poolIdx < pool.length) {
    filler.push(pool[poolIdx]);
    poolIdx++;
  }
  // Second pass: 2nd copy if still needed
  let poolIdx2 = 0;
  while (filler.length < needed && poolIdx2 < pool.length) {
    filler.push(pool[poolIdx2]);
    poolIdx2++;
  }

  return [...colorCards, ...filler.slice(0, needed)];
}

// Distribute colorless so each deck gets a different starting slice
function colorlessSlice(offset: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < COLORLESS_CARDS.length; i++) {
    result.push(COLORLESS_CARDS[(i + offset) % COLORLESS_CARDS.length]);
  }
  return result;
}

export const STARTER_DECKS: StarterDeckDef[] = [
  {
    id: 'starter-red-blaze',
    name: 'Red Blaze',
    color: 'red',
    cards: fillWithColorless(RED_CARDS, colorlessSlice(0)),
  },
  {
    id: 'starter-green-guardian',
    name: 'Green Guardian',
    color: 'green',
    cards: fillWithColorless(GREEN_CARDS, colorlessSlice(8)),
  },
  {
    id: 'starter-blue-control',
    name: 'Blue Control',
    color: 'blue',
    cards: fillWithColorless(BLUE_CARDS, colorlessSlice(16)),
  },
  {
    id: 'starter-yellow-trickster',
    name: 'Yellow Trickster',
    color: 'yellow',
    cards: fillWithColorless(YELLOW_CARDS, colorlessSlice(24)),
  },
  {
    id: 'starter-shadow-arsenal',
    name: 'Shadow Arsenal',
    color: 'black',
    cards: fillWithColorless(BLACK_CARDS, colorlessSlice(32)),
  },
];
