import type { HeroClass } from './types.js';

export interface StarterDeckDef {
  id: string;
  name: string;
  heroClass: HeroClass;
  cards: string[]; // 30 card codes
}

// Jimmy — Aggro/Burn (30 cards)
const JIMMY_STARTER: string[] = [
  // Class cards (12) + Secrets (2) + Bond pair (2)
  'JIM001', 'JIM001', // Ember Sprite 1 mana
  'JIM002', 'JIM002', // Flame Imp 1 mana
  'JIM003', 'JIM003', // Fire Axe 2 mana weapon
  'JIM005', 'JIM005', // Blazing Firehawk 3 mana
  'JIM009',            // Volcanus, Pyromancer King (legendary — 1 copy)
  'JIM016',            // Emberstorm Phoenix 6 mana 5/6 (legendary — 1 copy)
  'JIM_BOND_01',       // Otto, Loyal Otter 2 mana (Bond)
  'JIM_BOND_02',       // Bella, Snow Guardian 4 mana (Bond)
  'JIM_S01',           // Ember Trap (secret)
  'JIM_S02',           // Blaze Snare (secret)
  // Neutral filler (16)
  'NEU003', 'NEU003', // Scrappy Fighter 1 mana 2/1
  'NEU005', 'NEU005', // Raptor 2 mana 3/2
  'NEU009', 'NEU009', // Iron Sentinel 3 mana 3/4
  'NEU015', 'NEU015', // Chillwind Yeti 4 mana 4/5
  'NEU022', 'NEU022', // Stranglethorn Tiger 5 mana 5/5 Stealth
  'NEU026', 'NEU026', // Boulderfist Ogre 6 mana 6/7
  'NEU041', 'NEU041', // Loot Hoarder 2 mana 2/1 DR
  'NEU012', 'NEU012', // Jungle Panther 3 mana 4/2 Stealth
];

// Tala — Nature/Heal (30 cards)
const TALA_STARTER: string[] = [
  // Class cards (10) + Bond pair (2) + Orra Charge (1)
  'TAL001', 'TAL001', // Seedling 1 mana
  'TAL003', 'TAL003', // Wild Growth 2 mana ramp
  'TAL005', 'TAL005', // Thornguard 3 mana 2/4 Taunt
  'TAL007', 'TAL007', // Swipe 4 mana spell
  'TAL008', 'TAL008', // Healing Touch 3 mana spell
  'TAL_BOND_01',       // Rootwhisper 2 mana (Bond)
  'TAL_BOND_02',       // Bloomkeeper 3 mana (Bond)
  'TAL_ORRA_01',       // Tala's Healing Bloom 2 mana (Orra Charge)
  // Neutral filler (17)
  'NEU002', 'NEU002', // Squire 1 mana 1/2
  'NEU004', 'NEU004', // River Crocolisk 2 mana 2/3
  'NEU010', 'NEU010', // Woodland Defender 3 mana 2/4 Taunt
  'NEU016', 'NEU016', // Oasis Snapjaw 4 mana 2/7
  'NEU021', 'NEU021', // Fen Creeper 5 mana 3/6 Taunt
  'NEU026', 'NEU026', // Boulderfist Ogre 6 mana 6/7
  'NEU027', 'NEU027', // Sunwalker 6 mana 4/5 Taunt DS
  'NEU045', 'NEU045', // Ironfur Grizzly 3 mana 3/3 Taunt
  'NEU015',            // Chillwind Yeti 4 mana 4/5
];

// Derek — Tech/Utility (30 cards)
const DEREK_STARTER: string[] = [
  // Class cards (12) + Bond pair (2) + Orra Charge (1)
  'DRK001', 'DRK001', // Clockwork Gnome 1 mana
  'DRK003', 'DRK003', // Arcane Intellect 3 mana draw
  'DRK005', 'DRK005', // Gadget Goblin 3 mana
  'DRK007', 'DRK007', // Sap 2 mana bounce
  'DRK009',            // Sprint 7 mana draw
  'DRK010',            // Tinker's Oil 4 mana weapon (legendary — 1 copy)
  'DRK_BOND_01',       // Sengo, Shadow Leopard 3 mana (Bond)
  'DRK_BOND_02',       // Derek's Drone 2 mana (Bond)
  'DRK_ORRA_01',       // Orra Overloader 5 mana (Orra Charge)
  // Neutral filler (17)
  'NEU003', 'NEU003', // Scrappy Fighter 1 mana 2/1
  'NEU005', 'NEU005', // Raptor 2 mana 3/2
  'NEU011', 'NEU011', // Harvest Golem 3 mana 2/3 DR
  'NEU015', 'NEU015', // Chillwind Yeti 4 mana 4/5
  'NEU022', 'NEU022', // Stranglethorn Tiger 5 mana 5/5 Stealth
  'NEU026', 'NEU026', // Boulderfist Ogre 6 mana 6/7
  'NEU024', 'NEU024', // Azure Drake 5 mana 4/4 BC draw
  'NEU007', 'NEU007', // Novice Explorer 2 mana 1/1 BC draw
  'NEU012',            // Jungle Panther 3 mana 4/2 Stealth
];

// Anders — Control/Frost (30 cards)
const ANDERS_STARTER: string[] = [
  // Class cards (10) + Secrets (2) + Bond pair (2) + Orra Charge (1)
  'AND001', 'AND001', // Frost Sprite 1 mana
  'AND003', 'AND003', // Permafrost Bulwark 3 mana
  'AND005', 'AND005', // Deepwater Elemental 4 mana 3/6
  'AND007',           // Avalanche Warden 6 mana AoE
  'AND010', 'AND010', // Frostpiercer 2 mana spell
  'AND009',           // Anders, Warden of the Depths (legendary)
  'AND_BOND_01',       // Frostfang 3 mana (Bond)
  'AND_BOND_02',       // Icelash 2 mana (Bond)
  'AND_ORRA_01',       // Frostcore Sentinel 4 mana (Orra Charge)
  'AND_S01',           // Runic Counter (secret)
  'AND_S02',           // Mirror Reflection (secret)
  // Neutral filler (15)
  'NEU004', 'NEU004', // Riptide Lurker 2 mana 2/3
  'NEU010', 'NEU010', // Everbloom Warden 3 mana 2/4 Taunt
  'NEU015', 'NEU015', // Summit Yeti 4 mana 4/5
  'NEU021', 'NEU021', // Tundra Behemoth 5 mana 3/6 Taunt
  'NEU026', 'NEU026', // Frostpeak Ogre 6 mana 7/6
  'NEU035',           // Polar Colossus 8 mana 8/8
  'NEU046', 'NEU046', // Orra Wellspring Healer 3 mana 3/3 BC heal
  'NEU002', 'NEU002', // Aster Recruit 1 mana 1/2
];

// Des — Dark Orra Aggro/Control (30 cards)
const DES_STARTER: string[] = [
  // Class cards (10) + Secrets (2) + Collar cards (3) + Orra Charge (1)
  'DES001', 'DES001', // Shadow Recruit 1 mana
  'DES003', 'DES003', // Dark Orra Siphon 1 mana spell
  'DES_NEW_01', 'DES_NEW_01', // Dark Pact 2 mana (Life Tap draw)
  'DES011', 'DES011', // Corrupting Influence 3 mana
  'DES_COLLAR_01',     // Dominion Handler 4 mana (Collar)
  'DES_COLLAR_02',     // Collar Drone 3 mana (Collar + DR)
  'DES_COLLAR_05',     // Collar of Submission 3 mana (Collar spell)
  'DES_ORRA_01',       // Polara Core 5 mana (Orra Charge)
  'DES_S01',           // Shadow Ambush (secret)
  'DES_S02',           // Dark Bargain (secret)
  // Neutral filler (14)
  'NEU003', 'NEU003', // Gavalon Scrapper 1 mana 2/1
  'NEU005', 'NEU005', // Snowfield Raptor 2 mana 3/2
  'NEU041', 'NEU041', // Orra Scavenger 2 mana 2/1 DR draw
  'NEU012', 'NEU012', // Polara Stalker 3 mana 4/2 Stealth
  'NEU015', 'NEU015', // Summit Yeti 4 mana 4/5
  'NEU023', 'NEU023', // Dominion Assassin 5 mana 4/4 BC 3 dmg hero
  'NEU026', 'NEU026', // Frostpeak Ogre 6 mana 7/6
  'NEU029', 'NEU029', // Gavalon Rocketeer 5 mana 4/2 Charge
];

// Astrid — Protector (30 cards)
const ASTRID_STARTER: string[] = [
  // Class cards (10) + Secrets (2) + Bond pair (2) + New cards
  'AST001', 'AST001', // Aster Shieldbearer 1 mana
  'AST003', 'AST003', // Orra Barrier 1 mana spell
  'AST005', 'AST005', // Shield of the Ameti 2 mana spell
  'AST007', 'AST007', // Mink Companion 3 mana
  'AST_NEW_01',        // Shield Maiden's Insight 3 mana (draw)
  'AST_NEW_02',        // Radiant Protector 6 mana
  'AST_BOND_01',       // Mighty, Loyal Mink 2 mana (Bond)
  'AST_BOND_02',       // Astrid's Shield 3 mana (Bond)
  'AST_S01',           // Guardian's Oath (secret)
  'AST_S02',           // Second Chance (secret)
  // Neutral filler (16)
  'NEU002', 'NEU002', // Aster Recruit 1 mana 1/2
  'NEU006', 'NEU006', // Orraglass Trainee 2 mana 2/2 Divine Shield
  'NEU010', 'NEU010', // Everbloom Warden 3 mana 2/4 Taunt
  'NEU013', 'NEU013', // Orra Templar 3 mana 3/1 Divine Shield
  'NEU019', 'NEU019', // Orra Drake 4 mana 4/4 Divine Shield
  'NEU021', 'NEU021', // Tundra Behemoth 5 mana 3/6 Taunt
  'NEU046', 'NEU046', // Orra Wellspring Healer 3 mana 3/3 BC heal
  'NEU016',           // Glacial Shellback 4 mana 2/7
  'AST009',           // Astrid's Resolve 3 mana spell
];

// Ava — Tech Inventor (30 cards)
const AVA_STARTER: string[] = [
  // Class cards (10) + Bond pair (2) + Orra Charge (1)
  'AVA001', 'AVA001', // Gadget Sparker 1 mana
  'AVA003', 'AVA003', // Drone Assembly 2 mana
  'AVA005', 'AVA005', // Workshop Tinkerer 2 mana
  'AVA011', 'AVA011', // Drone Carrier 4 mana
  'AVA004',           // Luna Interface 2 mana draw
  'AVA_BOND_01',       // Fiona, Sky Glider 2 mana (Bond)
  'AVA_BOND_02',       // Luna Device 3 mana (Bond)
  'AVA_ORRA_01',       // Orra Turret 4 mana (Orra Charge)
  // Neutral filler (17)
  'NEU003', 'NEU003', // Gavalon Scrapper 1 mana 2/1
  'NEU007', 'NEU007', // Academy Cartographer 2 mana 1/2 BC draw
  'NEU011', 'NEU011', // Orra-Forged Golem 3 mana 2/3 DR summon 2/1
  'NEU014', 'NEU014', // Miro Beastkeeper 3 mana 2/3 BC summon 1/1
  'NEU012', 'NEU012', // Polara Stalker 3 mana 4/2 Stealth
  'NEU022', 'NEU022', // Polar Predator 5 mana 5/5 Stealth
  'NEU024', 'NEU024', // Miro Skywyrm 5 mana 4/4 BC draw
  'NEU015', 'NEU015', // Summit Yeti 4 mana 4/5
  'NEU047', 'NEU047', // Ameti Knight 5 mana 4/4 BC summon 2/2
];

// Lucas — Trickster (30 cards)
const LUCAS_STARTER: string[] = [
  // Class cards (10) + Bond pair (2) + Orra Charge (1)
  'LUC001', 'LUC001', // Coyote Pup 1 mana
  'LUC003', 'LUC003', // Gavalon Pickpocket 1 mana
  'LUC005',           // Jax, Coyote Scout 2 mana draw
  'LUC006', 'LUC006', // Trickster's Gambit 2 mana bounce
  'LUC009',           // Polara Infiltrator 3 mana Stealth bounce
  'LUC_BOND_01',       // Jax, Desert Coyote 2 mana (Bond)
  'LUC_BOND_02',       // Owl Sketch 3 mana (Bond)
  'LUC_ORRA_01',       // Sandtrap Orraglyph 3 mana (Orra Charge)
  // Neutral filler (17)
  'NEU003', 'NEU003', // Gavalon Scrapper 1 mana 2/1
  'NEU041', 'NEU041', // Orra Scavenger 2 mana 2/1 DR draw
  'NEU005', 'NEU005', // Snowfield Raptor 2 mana 3/2
  'NEU012', 'NEU012', // Polara Stalker 3 mana 4/2 Stealth
  'NEU009', 'NEU009', // Aster Patroller 3 mana 3/4
  'NEU017', 'NEU017', // Hoverboard Charger 4 mana 2/5 Charge
  'NEU022', 'NEU022', // Polar Predator 5 mana 5/5 Stealth
  'NEU029', 'NEU029', // Gavalon Rocketeer 5 mana 4/2 Charge
  'NEU026', 'NEU026', // Frostpeak Ogre 6 mana 7/6
  'LUC008',           // Coyote Pack Runner 3 mana Charge
];

// Izzy — Navigator (30 cards)
const IZZY_STARTER: string[] = [
  // Class cards (10) + Bond pair (2) + Orra Charge (1) + New card
  'IZZ001', 'IZZ001', // Sparkle Initiate 1 mana
  'IZZ003', 'IZZ003', // Sparkle Burst 1 mana armor
  'IZZ005', 'IZZ005', // Puffin Navigator 2 mana
  'IZZ007', 'IZZ007', // Sparkle Channeler 3 mana
  'IZZ009',           // Diamond Ice Warden 3 mana Taunt
  'IZZ_BOND_01',       // Bling, Puffin Navigator 2 mana (Bond)
  'IZZ_BOND_02',       // Sparkle Compass 3 mana (Bond)
  'IZZ_ORRA_01',       // Orra Battery 3 mana (Orra Charge)
  'IZZ_NEW_01',        // Sparkle Avalanche 7 mana (armor AoE finisher)
  // Neutral filler (16)
  'NEU002', 'NEU002', // Aster Recruit 1 mana 1/2
  'NEU004', 'NEU004', // Riptide Lurker 2 mana 2/3
  'NEU045', 'NEU045', // Snowpeak Bear 3 mana 3/3 Taunt
  'NEU015', 'NEU015', // Summit Yeti 4 mana 4/5
  'NEU021', 'NEU021', // Tundra Behemoth 5 mana 3/6 Taunt
  'NEU026', 'NEU026', // Frostpeak Ogre 6 mana 7/6
  'NEU035',           // Polar Colossus 8 mana 8/8
  'NEU046', 'NEU046', // Orra Wellspring Healer 3 mana 3/3 BC heal
  'NEU011', 'NEU011', // Orra-Forged Golem 3 mana 2/3 DR summon 2/1
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
  {
    id: 'starter-jimmy',
    name: "Jimmy's Inferno",
    heroClass: 'JIMMY',
    cards: validateStarterDeck("Jimmy's Inferno", JIMMY_STARTER),
  },
  {
    id: 'starter-tala',
    name: "Tala's Grove",
    heroClass: 'TALA',
    cards: validateStarterDeck("Tala's Grove", TALA_STARTER),
  },
  {
    id: 'starter-derek',
    name: "Derek's Workshop",
    heroClass: 'DEREK',
    cards: validateStarterDeck("Derek's Workshop", DEREK_STARTER),
  },
  {
    id: 'starter-anders',
    name: "Anders' Glacier",
    heroClass: 'ANDERS',
    cards: validateStarterDeck("Anders' Glacier", ANDERS_STARTER),
  },
  {
    id: 'starter-des',
    name: "Des' Shadow",
    heroClass: 'DES',
    cards: validateStarterDeck("Des' Shadow", DES_STARTER),
  },
  {
    id: 'starter-astrid',
    name: "Astrid's Bastion",
    heroClass: 'ASTRID',
    cards: validateStarterDeck("Astrid's Bastion", ASTRID_STARTER),
  },
  {
    id: 'starter-ava',
    name: "Ava's Laboratory",
    heroClass: 'AVA',
    cards: validateStarterDeck("Ava's Laboratory", AVA_STARTER),
  },
  {
    id: 'starter-lucas',
    name: "Lucas' Gambit",
    heroClass: 'LUCAS',
    cards: validateStarterDeck("Lucas' Gambit", LUCAS_STARTER),
  },
  {
    id: 'starter-izzy',
    name: "Izzy's Expedition",
    heroClass: 'IZZY',
    cards: validateStarterDeck("Izzy's Expedition", IZZY_STARTER),
  },
];
