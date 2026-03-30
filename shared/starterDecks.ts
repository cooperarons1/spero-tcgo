import type { HeroClass } from './types.js';

export interface StarterDeckDef {
  id: string;
  name: string;
  heroClass: HeroClass;
  cards: string[];
}

const JIMMY_STARTER: string[] = ['JIM038', 'JIM038', 'JIM020', 'JIM020', 'JIM017', 'JIM017', 'JIM023', 'JIM023', 'JIM033', 'JIM033', 'JIM024', 'JIM024', 'JIM_BOND_01', 'JIM_BOND_02', 'JIM_S01', 'JIM_S02', 'JIM034', 'JIM029', 'JIM021', 'JIM035', 'NEU100', 'NEU100', 'NEU082', 'NEU082', 'NEU069', 'NEU069', 'NEU074', 'NEU074', 'NEU097', 'NEU099'];
const TALA_STARTER: string[] = ['TAL031', 'TAL031', 'TAL033', 'TAL033', 'TAL017', 'TAL017', 'TAL018', 'TAL018', 'TAL023', 'TAL023', 'TAL_BOND_01', 'TAL_BOND_02', 'TAL020', 'TAL030', 'TAL016', 'TAL024', 'TAL021', 'TAL034', 'NEU100', 'NEU100', 'NEU068', 'NEU068', 'NEU090', 'NEU090', 'NEU092', 'NEU092', 'NEU098', 'NEU099', 'NEU065', 'NEU063'];
const DEREK_STARTER: string[] = ['DRK039', 'DRK039', 'DRK031', 'DRK031', 'DRK047', 'DRK047', 'DRK020', 'DRK020', 'DRK_BOND_01', 'DRK_BOND_02', 'DRK036', 'DRK025', 'DRK027', 'DRK038', 'DRK017', 'DRK021', 'DRK024', 'DRK019', 'DRK029', 'DRK032', 'NEU068', 'NEU068', 'NEU085', 'NEU085', 'NEU074', 'NEU074', 'NEU093', 'NEU093', 'NEU099', 'NEU078'];
const ANDERS_STARTER: string[] = ['AND016', 'AND016', 'AND020', 'AND020', 'AND028', 'AND028', 'AND_BOND_01', 'AND_BOND_02', 'AND_S01', 'AND_S03', 'AND017', 'AND021', 'AND023', 'AND024', 'AND030', 'AND018', 'AND025', 'AND022', 'NEU100', 'NEU100', 'NEU084', 'NEU084', 'NEU065', 'NEU065', 'NEU063', 'NEU063', 'NEU078', 'NEU099', 'NEU090', 'NEU092'];
const DES_STARTER: string[] = ['DES021', 'DES021', 'DES028', 'DES028', 'DES037', 'DES037', 'DES_S01', 'DES_S02', 'DES_COLLAR_02', 'DES_COLLAR_03', 'DES025', 'DES032', 'DES027', 'DES030', 'DES034', 'DES026', 'DES033', 'DES022', 'NEU094', 'NEU094', 'NEU082', 'NEU082', 'NEU069', 'NEU069', 'NEU091', 'NEU091', 'NEU099', 'NEU074', 'NEU078', 'NEU097'];
const ASTRID_STARTER: string[] = ['AST026', 'AST026', 'AST028', 'AST028', 'AST023', 'AST023', 'AST_S01', 'AST_S02', 'AST_BOND_01', 'AST_BOND_02', 'AST037', 'AST040', 'AST029', 'AST034', 'AST039', 'AST025', 'AST033', 'AST031', 'NEU068', 'NEU068', 'NEU090', 'NEU090', 'NEU065', 'NEU065', 'NEU063', 'NEU063', 'NEU100', 'NEU100', 'NEU099', 'NEU092'];
const AVA_STARTER: string[] = ['AVA024', 'AVA024', 'AVA030', 'AVA030', 'AVA036', 'AVA036', 'AVA037', 'AVA037', 'AVA_BOND_01', 'AVA_BOND_02', 'AVA027', 'AVA023', 'AVA035', 'AVA025', 'AVA028', 'AVA031', 'AVA026', 'AVA029', 'AVA021', 'NEU094', 'NEU094', 'NEU084', 'NEU084', 'NEU085', 'NEU085', 'NEU074', 'NEU074', 'NEU068', 'NEU090', 'NEU099'];
// Combo-focused: cheap spells to enable combo minions, burst damage finishers
const LUCAS_STARTER: string[] = [
  'LUC036', 'LUC036',  // Pinch x2 (1m 2/1 combo: 1 face dmg)
  'LUC037', 'LUC037',  // Poke x2 (1m 2/1 combo: stealth)
  'LUC024', 'LUC024',  // Face to Face x2 (1m spell: 3 face dmg)
  'LUC021', 'LUC021',  // Agile Strength x2 (1m spell: +2 atk)
  'LUC022', 'LUC022',  // Ayto x2 (2m 3/2 combo: +1/+1)
  'LUC028', 'LUC028',  // Harley x2 (2m 2/3 combo: +2 atk)
  'LUC029', 'LUC029',  // Hunting Trophy x2 (2m spell: destroy damaged)
  'LUC038', 'LUC038',  // Sho x2 (3m 4/3 combo: draw)
  'LUC030',             // Jie (3m 3/4 combo: bounce enemy)
  'LUC027',             // Focus of Return (1m spell: bounce friendly)
  'LUC023',             // Cicero (4m 3/4 stealth+combo: draw)
  'LUC031', 'LUC031',  // Kato x2 (4m 5/4 combo: 2 face dmg)
  'LUC040',             // Tandem (4m 4/4 combo: +2/+1)
  'LUC032',             // Hugo (5m 5/4 stealth+combo: 3 dmg+draw)
  'LUC034',             // Mercurio (5m 4/4 stealth+combo: +3/+3 windfury)
  'NEU065', 'NEU065',  // Cardboard Pickaxe x2 (1m 1/3 weapon — cheap combo enabler)
  'NEU090', 'NEU090',  // Short Sword x2 (1m 2/2 weapon)
  'LUC026',             // Feather Cloak (2m 1/3 weapon)
  'LUC041',             // Trickwing (2m 2/2 stealth)
];
const IZZY_STARTER: string[] = ['IZZ025', 'IZZ025', 'IZZ023', 'IZZ023', 'IZZ030', 'IZZ030', 'IZZ021', 'IZZ021', 'IZZ_BOND_01', 'IZZ_BOND_02', 'IZZ027', 'IZZ029', 'IZZ026', 'IZZ033', 'IZZ034', 'IZZ024', 'IZZ037', 'IZZ039', 'NEU068', 'NEU068', 'NEU090', 'NEU090', 'NEU065', 'NEU065', 'NEU093', 'NEU093', 'NEU100', 'NEU100', 'NEU084', 'NEU099'];

function validateStarterDeck(name: string, cards: string[]): string[] {
  if (cards.length !== 30) {
    throw new Error(`Starter deck "${name}" has ${cards.length} cards, expected 30`);
  }
  const counts = new Map<string, number>();
  for (const c of cards) {
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  for (const [card, count] of counts) {
    if (count > 2) {
      throw new Error(`Starter deck "${name}" has ${count}x ${card}, max is 2`);
    }
  }
  return cards;
}

export const STARTER_DECKS: StarterDeckDef[] = [
  { id: 'starter-jimmy', name: "Jimmy's Inferno", heroClass: 'JIMMY', cards: validateStarterDeck("Jimmy's Inferno", JIMMY_STARTER) },
  { id: 'starter-tala', name: "Tala's Grove", heroClass: 'TALA', cards: validateStarterDeck("Tala's Grove", TALA_STARTER) },
  { id: 'starter-derek', name: "Derek's Workshop", heroClass: 'DEREK', cards: validateStarterDeck("Derek's Workshop", DEREK_STARTER) },
  { id: 'starter-anders', name: "Anders' Glacier", heroClass: 'ANDERS', cards: validateStarterDeck("Anders' Glacier", ANDERS_STARTER) },
  { id: 'starter-des', name: "Des' Shadow", heroClass: 'DES', cards: validateStarterDeck("Des' Shadow", DES_STARTER) },
  { id: 'starter-astrid', name: "Astrid's Bastion", heroClass: 'ASTRID', cards: validateStarterDeck("Astrid's Bastion", ASTRID_STARTER) },
  { id: 'starter-ava', name: "Ava's Laboratory", heroClass: 'AVA', cards: validateStarterDeck("Ava's Laboratory", AVA_STARTER) },
  { id: 'starter-lucas', name: "Lucas' Gambit", heroClass: 'LUCAS', cards: validateStarterDeck("Lucas' Gambit", LUCAS_STARTER) },
  { id: 'starter-izzy', name: "Izzy's Expedition", heroClass: 'IZZY', cards: validateStarterDeck("Izzy's Expedition", IZZY_STARTER) },
];
