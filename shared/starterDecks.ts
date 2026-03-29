import type { HeroClass } from './types.js';

export interface StarterDeckDef {
  id: string;
  name: string;
  heroClass: HeroClass;
  cards: string[]; // 30 card codes
}

// Jimmy — Aggro/Burn (30 cards)
const JIMMY_STARTER: string[] = [
  // Class (16) + Bond (2) + Secrets (2)
  'JIM038', 'JIM038', // Warning Shot 0 mana
  'JIM020', 'JIM020', // Bottled Flame 1 mana
  'JIM_BOND_01',       // Otto, Loyal Otter 2 mana (Bond)
  'JIM017', 'JIM017', // Anvil to Iron 2 mana
  'JIM023', 'JIM023', // Chuck 2 mana 3/2
  'JIM_BOND_02',       // Bella, Snow Guardian 4 mana (Bond)
  'JIM_S01',           // Ember Trap (secret)
  'JIM_S02',           // Blaze Snare (secret)
  'JIM024', 'JIM024', // Eddie 3 mana 3/3
  'JIM034',            // Spear of Penetration 3 mana weapon
  'JIM029',            // Giant Slayer 3 mana
  'JIM021',            // Bronson 4 mana Charge
  'JIM035',            // Stern 4 mana 5/3
  'JIM025',            // Embra 5 mana 4/4
  'JIM027',            // Fenris 5 mana 5/4
  // Neutral (10)
  'NEU100', 'NEU100', // Yip 1 mana 1/2
  'NEU082', 'NEU082', // Tumbler 2 mana 3/2
  'NEU069', 'NEU069', // Garf 3 mana 4/3
  'NEU074', 'NEU074', // Jorge 4 mana 4/4
  'NEU097',            // Trav 4 mana 4/4
  'NEU099',            // Voulder 7 mana 7/7
];

// Tala — Nature/Heal (30 cards)
const TALA_STARTER: string[] = [
  // Class (16) + Bond (2)
  'TAL031', 'TAL031', // Plup 1 mana 1/2
  'TAL033', 'TAL033', // Stix 1 mana 2/1
  'TAL_BOND_01',       // Snowball, Arctic Scout 2 mana (Bond)
  'TAL017', 'TAL017', // Brea 2 mana 2/3
  'TAL018', 'TAL018', // Cultivating Acacia 2 mana spell
  'TAL_BOND_02',       // Tala's Ice Orb 3 mana (Bond)
  'TAL020',            // Emmy 3 mana 2/4
  'TAL036',            // Vanilla 3 mana 2/4
  'TAL030',            // Pineapple Armor 3 mana weapon
  'TAL016',            // Asmita 4 mana 3/5
  'TAL024',            // Kandu 4 mana 3/5
  'TAL028',            // Nature's End 4 mana spell
  'TAL021',            // Freya 5 mana 3/6
  'TAL032',            // Relentless Stampede 5 mana spell
  'TAL029',            // Nature's Wrath 6 mana spell
  // Neutral (11)
  'NEU100', 'NEU100', // Yip 1 mana 1/2
  'NEU068', 'NEU068', // Felix 2 mana 2/3
  'NEU090', 'NEU090', // Percy 3 mana 2/4
  'NEU092', 'NEU092', // Rhea 4 mana 3/5
  'NEU098',            // Tybiel 6 mana 5/6
  'NEU099',            // Voulder 7 mana 7/7
  'TAL034',            // The Grand Sequoia 8 mana legendary
];

// Derek — Mech/Tech (30 cards)
const DEREK_STARTER: string[] = [
  // Class (18) + Bond (2)
  'DRK039', 'DRK039', // Skip 1 mana 1/2 MECH
  'DRK_BOND_02',       // Rosie, Bottlenose Scout 2 mana (Bond)
  'DRK031', 'DRK031', // Pero 2 mana 2/2 MECH
  'DRK036',            // Recorder 2 mana 1/3 draw
  'DRK047', 'DRK047', // Zims 2 mana 2/3 MECH
  'DRK_BOND_01',       // Sengo, Shadow Leopard 3 mana (Bond)
  'DRK020', 'DRK020', // Candice 3 mana 3/3 MECH
  'DRK025',            // Helix Robot 3 mana Charge MECH
  'DRK027',            // Klein 3 mana 2/4
  'DRK038',            // Scrap Scythe 3 mana weapon
  'DRK017',            // Andrii 4 mana 4/3 MECH
  'DRK021',            // Caytum 4 mana 3/4 draw MECH
  'DRK024',            // GPU 4 mana 3/4 epic MECH
  'DRK019',            // Bjorn 5 mana 4/5 MECH
  'DRK029',            // Megabyte 5 mana 4/5
  'DRK032',            // Prema 6 mana 5/6 MECH
  // Neutral (8)
  'NEU068', 'NEU068', // Felix 2 mana 2/3
  'NEU085', 'NEU085', // Morris 3 mana 3/3
  'NEU074', 'NEU074', // Jorge 4 mana 4/4
  'NEU093', 'NEU093', // Skales 5 mana 4/5
];

// Anders — Control/Frost (30 cards)
const ANDERS_STARTER: string[] = [
  // Class (14) + Bond (2) + Secrets (2)
  'AND016', 'AND016', // Bottled Water 1 mana spell
  'AND_BOND_02',       // Icelash 2 mana (Bond)
  'AND020', 'AND020', // Concealed in Ice 2 mana
  'AND028', 'AND028', // Monico 2 mana 2/3
  'AND_BOND_01',       // Frostfang 3 mana (Bond)
  'AND_S01',           // Runic Counter (secret)
  'AND_S03',           // Frost Barrier (secret)
  'AND017',            // Calix 3 mana 2/4
  'AND021',            // Fiddle of Silence 3 mana weapon
  'AND023',            // Glasglow 4 mana 3/4
  'AND024',            // Hailstorm 4 mana spell
  'AND018',            // Caspian 5 mana 4/5
  'AND025',            // Ice Storm 5 mana spell
  'AND022',            // Glacius 6 mana 5/6
  // Neutral (10)
  'NEU100', 'NEU100', // Yip 1 mana 1/2
  'NEU084', 'NEU084', // Mina 2 mana 1/3 Taunt
  'NEU065', 'NEU065', // Emyren 4 mana 3/5 Taunt
  'NEU063', 'NEU063', // Boris 5 mana 5/5 Taunt
  'NEU078',            // Kron 6 mana 6/6
  'NEU099',            // Voulder 7 mana 7/7
];

// Des — Dark/Destruction (30 cards)
const DES_STARTER: string[] = [
  // Class (16) + Collar (2) + Secrets (2)
  'DES021', 'DES021', // Crimson Cells 2 mana spell
  'DES028', 'DES028', // Maso 2 mana 3/2
  'DES_S01',           // Shadow Ambush (secret)
  'DES_S02',           // Dark Bargain (secret)
  'DES_COLLAR_02',     // Collar Drone 2 mana (hardcoded)
  'DES037', 'DES037', // Vrasp 3 mana 4/2 Stealth
  'DES025',            // Ezra 3 mana 4/3
  'DES032',            // Stolen Identity 3 mana spell
  'DES_COLLAR_03',     // Des Aster, Puppetmaster 8 mana (hardcoded)
  'DES027',            // Lateo 4 mana 4/4
  'DES030',            // Selena 4 mana 3/4
  'DES034',            // Twilight's Judgment 4 mana spell
  'DES026',            // Kabistan 5 mana 5/4
  'DES033',            // The Anarchist 5 mana legendary
  'DES022',            // Death's Descent 6 mana spell
  'DES031',            // Shazarda 7 mana 6/6
  // Neutral (8)
  'NEU094', 'NEU094', // RoRo 1 mana 1/1 DR draw
  'NEU082', 'NEU082', // Tumbler 2 mana 3/2
  'NEU069', 'NEU069', // Garf 3 mana 4/3
  'NEU099',            // Voulder 7 mana 7/7
  'NEU091',            // Pierre 5 mana 4/5
];

// Astrid — Protector/Divine Shield (30 cards)
const ASTRID_STARTER: string[] = [
  // Class (14) + Bond (2) + Secrets (2)
  'AST_S01',           // Guardian's Oath (secret)
  'AST_S02',           // Second Chance (secret)
  'AST_BOND_01',       // Mighty, Loyal Mink 2 mana (Bond)
  'AST026', 'AST026', // Chest of Fortitude 2 mana
  'AST028', 'AST028', // Elle 2 mana 2/3 DS
  'AST_BOND_02',       // Astrid's Shield 3 mana (Bond)
  'AST023', 'AST023', // Alexis 3 mana 2/5 Taunt
  'AST037',            // Tamara 3 mana 2/4 DS
  'AST040',            // Yvette 3 mana 2/4
  'AST029',            // Jasten 4 mana 3/5 Taunt DS
  'AST034',            // Roderick 4 mana 3/5 Taunt
  'AST039',            // Triumphant 4 mana spell
  'AST025',            // Call to Arms 5 mana summon
  'AST033',            // Raphael 5 mana 4/6
  'AST038',            // Trinity 5 mana 3/6 Taunt DS
  'AST031',            // Lady Arinna 6 mana legendary
  // Neutral (11)
  'NEU100', 'NEU100', // Yip 1 mana 1/2
  'NEU068', 'NEU068', // Felix 2 mana 2/3
  'NEU090', 'NEU090', // Percy 3 mana 2/4 Taunt
  'NEU065', 'NEU065', // Emyren 4 mana 3/5 Taunt
  'NEU063', 'NEU063', // Boris 5 mana 5/5 Taunt
  'NEU099',            // Voulder 7 mana 7/7
];

// Ava — Inventor/Drone Swarm (30 cards)
const AVA_STARTER: string[] = [
  // Class (16) + Bond (2)
  'AVA024', 'AVA024', // Chip 1 mana 1/2 MECH
  'AVA030', 'AVA030', // Peep 1 mana 1/1 DR draw
  'AVA036', 'AVA036', // Tiny Spark 1 mana spell
  'AVA_BOND_01',       // Fiona, Sky Glider 2 mana (Bond)
  'AVA037', 'AVA037', // Whizz 2 mana 2/2 summon drone
  'AVA027',            // Recycle 2 mana spell
  'AVA_BOND_02',       // Luna Device 3 mana (Bond)
  'AVA023',            // Airdrop 3 mana summon
  'AVA035',            // Sall-E 3 mana 2/4 MECH
  'AVA025',            // Fiona, Acrobat 4 mana
  'AVA028',            // Manufacture Reinforcements 4 mana
  'AVA031',            // Q Launcher 4 mana weapon
  'AVA026',            // Giga 5 mana 4/5 MECH
  'AVA029',            // Nullification Field 5 mana spell
  'AVA021',            // Breakthrough Innovation 6 mana
  // Neutral (8)
  'NEU094', 'NEU094', // RoRo 1 mana 1/1 DR draw
  'NEU084', 'NEU084', // Mina 2 mana 1/3 Taunt
  'NEU085', 'NEU085', // Morris 3 mana 3/3
  'NEU074', 'NEU074', // Jorge 4 mana 4/4
];

// Lucas — Combo/Stealth Trickster (30 cards)
const LUCAS_STARTER: string[] = [
  // Class (16) + Bond (2)
  'LUC036', 'LUC036', // Pinch 1 mana Combo
  'LUC040', 'LUC040', // Poke 1 mana Combo Stealth
  'LUC_BOND_01',       // Jax, Desert Coyote 2 mana (Bond)
  'LUC021', 'LUC021', // Agile Strength 2 mana spell
  'LUC025', 'LUC025', // Farrah 3 mana Stealth
  'LUC_BOND_02',       // Owl Sketch 3 mana (Bond)
  'LUC028',            // Face to Face 2 mana spell
  'LUC022',            // Ayto 2 mana Combo
  'LUC027',            // Jie 3 mana Combo bounce
  'LUC038',            // Sho 3 mana Combo draw
  'LUC024',            // Cicero 4 mana Stealth
  'LUC031',            // Kato 4 mana Combo
  'LUC035',            // Mercurio 5 mana Stealth Combo
  'LUC032',            // Hugo, Shadow Blade 5 mana
  // Neutral (8)
  'NEU082', 'NEU082', // Tumbler 2 mana 3/2
  'NEU069', 'NEU069', // Garf 3 mana 4/3
  'NEU074', 'NEU074', // Jorge 4 mana 4/4
  'NEU091', 'NEU091', // Pierre 5 mana 4/5
];

// Izzy — Armor/Sparkle Navigator (30 cards)
const IZZY_STARTER: string[] = [
  // Class (16) + Bond (2)
  'IZZ025', 'IZZ025', // Little Dipper 1 mana 1/2 armor
  'IZZ_BOND_01',       // Bling, Puffin Navigator 2 mana (Bond)
  'IZZ023', 'IZZ023', // Carmi 2 mana 2/3 armor
  'IZZ030', 'IZZ030', // Kite 2 mana Windfury
  'IZZ_BOND_02',       // Sparkle Compass 3 mana (Bond)
  'IZZ027',            // Brittana, Sparkle Scout 3 mana
  'IZZ021', 'IZZ021', // Balanced Progress 3 mana buff spell
  'IZZ024',            // Coastal Typhoon 5 mana spell
  'IZZ029',            // Extreme Gusts 3 mana bounce
  'IZZ026',            // Cynthie 3 mana 2/4
  'IZZ033',            // Raye 4 mana 3/4
  'IZZ034',            // Senga, Wind Rider 4 mana Windfury
  'IZZ037',            // Sygna 5 mana 4/5 armor
  'IZZ039',            // Zahava 6 mana 5/6 armor
  // Neutral (8)
  'NEU068', 'NEU068', // Felix 2 mana 2/3
  'NEU090', 'NEU090', // Percy 3 mana 2/4 Taunt
  'NEU065', 'NEU065', // Emyren 4 mana 3/5 Taunt
  'NEU093', 'NEU093', // Skales 5 mana 4/5 Taunt
];

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
