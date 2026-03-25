import type { HeroClass } from './types.js';

export interface StarterDeckDef {
  id: string;
  name: string;
  heroClass: HeroClass;
  cards: string[]; // 30 card codes
}

// Jimmy — Aggro/Burn (30 cards)
const JIMMY_STARTER: string[] = [
  // Class cards (12) + Secrets (2)
  'JIM001', 'JIM001', // Ember Sprite 1 mana
  'JIM002', 'JIM002', // Flame Imp 1 mana
  'JIM003', 'JIM003', // Fire Axe 2 mana weapon
  'JIM005', 'JIM005', // Blazing Firehawk 3 mana
  'JIM006',            // Volcanis Hound 3 mana 4/3
  'JIM009',            // Volcanus, Pyromancer King (legendary — 1 copy)
  'JIM016',            // Emberstorm Phoenix 6 mana 5/6 (legendary — 1 copy)
  'JIM004',            // Pyro Whelpling 2 mana
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
  // Class cards (12)
  'TAL001', 'TAL001', // Seedling 1 mana
  'TAL003', 'TAL003', // Wild Growth 2 mana ramp
  'TAL005', 'TAL005', // Thornguard 3 mana 2/4 Taunt
  'TAL007', 'TAL007', // Swipe 4 mana spell
  'TAL008', 'TAL008', // Healing Touch 3 mana spell
  'TAL010', 'TAL010', // Ancient of Lore 7 mana
  // Neutral filler (18)
  'NEU002', 'NEU002', // Squire 1 mana 1/2
  'NEU004', 'NEU004', // River Crocolisk 2 mana 2/3
  'NEU010', 'NEU010', // Woodland Defender 3 mana 2/4 Taunt
  'NEU016', 'NEU016', // Oasis Snapjaw 4 mana 2/7
  'NEU021', 'NEU021', // Fen Creeper 5 mana 3/6 Taunt
  'NEU026', 'NEU026', // Boulderfist Ogre 6 mana 6/7
  'NEU027', 'NEU027', // Sunwalker 6 mana 4/5 Taunt DS
  'NEU045', 'NEU045', // Ironfur Grizzly 3 mana 3/3 Taunt
  'NEU015', 'NEU015', // Chillwind Yeti 4 mana 4/5
];

// Derek — Tech/Utility (30 cards)
const DEREK_STARTER: string[] = [
  // Class cards (12)
  'DRK001', 'DRK001', // Clockwork Gnome 1 mana
  'DRK003', 'DRK003', // Arcane Intellect 3 mana draw
  'DRK005', 'DRK005', // Gadget Goblin 3 mana
  'DRK007', 'DRK007', // Sap 2 mana bounce
  'DRK009', 'DRK009', // Sprint 7 mana draw
  'DRK010',            // Tinker's Oil 4 mana weapon (legendary — 1 copy)
  'DRK004',            // Schematic Archivist 3 mana
  // Neutral filler (18)
  'NEU003', 'NEU003', // Scrappy Fighter 1 mana 2/1
  'NEU005', 'NEU005', // Raptor 2 mana 3/2
  'NEU011', 'NEU011', // Harvest Golem 3 mana 2/3 DR
  'NEU015', 'NEU015', // Chillwind Yeti 4 mana 4/5
  'NEU022', 'NEU022', // Stranglethorn Tiger 5 mana 5/5 Stealth
  'NEU026', 'NEU026', // Boulderfist Ogre 6 mana 6/7
  'NEU024', 'NEU024', // Azure Drake 5 mana 4/4 BC draw
  'NEU007', 'NEU007', // Novice Explorer 2 mana 1/1 BC draw
  'NEU012', 'NEU012', // Jungle Panther 3 mana 4/2 Stealth
];

// Anders — Control/Frost (30 cards)
const ANDERS_STARTER: string[] = [
  // Class cards (12) + Secrets (2)
  'AND001', 'AND001', // Ice Shard 1 mana spell
  'AND003', 'AND003', // Frostbolt 2 mana spell
  'AND005', 'AND005', // Water Elemental 4 mana 3/6
  'AND007', 'AND007', // Blizzard 6 mana AoE
  'AND010', 'AND010', // Glacial Spike 1 mana 2/1 freeze
  'AND009',           // Frost Giant 10 mana 8/8 (legendary = 1 copy)
  'AND008',           // Glacial Barrier 5 mana spell
  'AND_S01',           // Runic Counter (secret)
  'AND_S02',           // Mirror Reflection (secret)
  // Neutral filler (16)
  'NEU004', 'NEU004', // River Crocolisk 2 mana 2/3
  'NEU010', 'NEU010', // Woodland Defender 3 mana 2/4 Taunt
  'NEU015', 'NEU015', // Chillwind Yeti 4 mana 4/5
  'NEU021', 'NEU021', // Fen Creeper 5 mana 3/6 Taunt
  'NEU026', 'NEU026', // Boulderfist Ogre 6 mana 6/7
  'NEU035', 'NEU035', // Ironclad Behemoth 8 mana 8/8
  'NEU046', 'NEU046', // Earthen Ring Farseer 3 mana 3/3 BC heal
  'NEU002', 'NEU002', // Squire 1 mana 1/2
];

// Des — Dark Orra Aggro/Control (30 cards)
const DES_STARTER: string[] = [
  // Class cards (12) + Secrets (2) + New cards
  'DES001', 'DES001', // 1 mana
  'DES003', 'DES003', // 2 mana
  'DES_NEW_01', 'DES_NEW_01', // 2 mana Dark Pact (Life Tap draw)
  'DES_NEW_02', 'DES_NEW_02', // 3 mana Void Siphon (Life Tap minion)
  'DES005', 'DES005', // 3 mana
  'DES011', 'DES011', // 3 mana (reduced from 4)
  'DES_S01',           // Shadow Ambush (secret)
  'DES_S02',           // Dark Bargain (secret)
  // Neutral filler (14)
  'NEU003', 'NEU003', // Scrappy Brawler 1 mana 2/1
  'NEU005', 'NEU005', // Razor Raptor 2 mana 3/2
  'NEU041', 'NEU041', // Treasure Scavenger 2 mana 2/1 DR draw
  'NEU012', 'NEU012', // Shadowpaw Stalker 3 mana 4/2 Stealth
  'NEU015', 'NEU015', // Summit Brute 4 mana 4/5
  'NEU023', 'NEU023', // Duskfang Assassin 5 mana 4/4 BC 3 dmg hero
  'NEU026', 'NEU026', // Stonefist Ogre 6 mana 6/7
  'NEU029', 'NEU029', // Reckless Rocketeer 6 mana 5/2 Charge
];

// Astrid — Protector (30 cards)
const ASTRID_STARTER: string[] = [
  // Class cards (12) + Secrets (2) + New cards
  'AST001', 'AST001', // 1 mana
  'AST003', 'AST003', // 2 mana
  'AST_NEW_01', 'AST_NEW_01', // 3 mana Shield Maiden's Insight (draw)
  'AST005', 'AST005', // 3 mana
  'AST007', 'AST007', // 4 mana
  'AST_NEW_02',        // 6 mana Radiant Protector (Divine Shield + summon)
  'AST_S01',           // Guardian's Oath (secret)
  'AST_S02',           // Second Chance (secret)
  // Neutral filler (15)
  'NEU002', 'NEU002', // Eager Apprentice 1 mana 1/2
  'NEU006', 'NEU006', // Blessed Recruit 2 mana 2/2 Divine Shield
  'NEU010', 'NEU010', // Fernwood Protector 3 mana 2/4 Taunt
  'NEU013', 'NEU013', // Gilded Templar 3 mana 3/1 Divine Shield
  'NEU019', 'NEU019', // Prism Drake 4 mana 4/4 Divine Shield
  'NEU021', 'NEU021', // Mirewalker Brute 5 mana 3/6 Taunt
  'NEU046', 'NEU046', // Wellspring Soothsayer 3 mana 3/3 BC heal
  'NEU016', 'NEU016', // Shellback Tortoise 4 mana 2/7
  'AST009',           // 5 mana class card
];

// Ava — Tech Inventor (30 cards)
const AVA_STARTER: string[] = [
  // Class cards (12)
  'AVA001', 'AVA001', // 1 mana
  'AVA003', 'AVA003', // 2 mana
  'AVA005', 'AVA005', // 3 mana
  'AVA007', 'AVA007', // 4 mana
  'AVA009', 'AVA009', // 5 mana
  'AVA011', 'AVA011', // 6 mana
  // Neutral filler (18)
  'NEU003', 'NEU003', // Scrappy Brawler 1 mana 2/1
  'NEU007', 'NEU007', // Novice Cartographer 2 mana 1/1 BC draw
  'NEU011', 'NEU011', // Patchwork Golem 3 mana 2/3 DR summon 2/1
  'NEU014', 'NEU014', // Tuskwood Handler 3 mana 2/3 BC summon 1/1
  'NEU012', 'NEU012', // Shadowpaw Stalker 3 mana 4/2 Stealth
  'NEU022', 'NEU022', // Gloomveil Predator 5 mana 5/5 Stealth
  'NEU024', 'NEU024', // Cerulean Wyrm 5 mana 4/4 BC draw
  'NEU015', 'NEU015', // Summit Brute 4 mana 4/5
  'NEU047', 'NEU047', // Sworn Cavalier 5 mana 4/4 BC summon 2/2
];

// Lucas — Trickster (30 cards)
const LUCAS_STARTER: string[] = [
  // Class cards (12)
  'LUC001', 'LUC001', // 1 mana
  'LUC003', 'LUC003', // 2 mana
  'LUC005', 'LUC005', // 3 mana
  'LUC007', 'LUC007', // 4 mana
  'LUC009', 'LUC009', // 5 mana
  'LUC011', 'LUC011', // 6 mana
  // Neutral filler (18)
  'NEU003', 'NEU003', // Scrappy Brawler 1 mana 2/1
  'NEU041', 'NEU041', // Treasure Scavenger 2 mana 2/1 DR draw
  'NEU005', 'NEU005', // Razor Raptor 2 mana 3/2
  'NEU012', 'NEU012', // Shadowpaw Stalker 3 mana 4/2 Stealth
  'NEU009', 'NEU009', // Ironhide Patroller 3 mana 3/4
  'NEU017', 'NEU017', // Frontline Charger 4 mana 2/5 Charge
  'NEU022', 'NEU022', // Gloomveil Predator 5 mana 5/5 Stealth
  'NEU029', 'NEU029', // Reckless Rocketeer 6 mana 5/2 Charge
  'NEU026', 'NEU026', // Stonefist Ogre 6 mana 6/7
];

// Izzy — Navigator (30 cards)
const IZZY_STARTER: string[] = [
  // Class cards (12) + New card
  'IZZ001', 'IZZ001', // 1 mana
  'IZZ003', 'IZZ003', // 2 mana
  'IZZ005', 'IZZ005', // 3 mana
  'IZZ007', 'IZZ007', // 4 mana
  'IZZ009', 'IZZ009', // 5 mana
  'IZZ011', 'IZZ011', // 6 mana
  'IZZ_NEW_01',        // 7 mana Sparkle Avalanche (armor AoE finisher)
  // Neutral filler (17)
  'NEU002', 'NEU002', // Eager Apprentice 1 mana 1/2
  'NEU004', 'NEU004', // Marsh Lurker 2 mana 2/3
  'NEU011', 'NEU011', // Patchwork Golem 3 mana 2/3 DR summon 2/1
  'NEU045', 'NEU045', // Bristleback Bear 3 mana 3/3 Taunt
  'NEU015', 'NEU015', // Summit Brute 4 mana 4/5
  'NEU021', 'NEU021', // Mirewalker Brute 5 mana 3/6 Taunt
  'NEU026', 'NEU026', // Stonefist Ogre 6 mana 6/7
  'NEU035',            // Ironclad Behemoth 8 mana 8/8
  'NEU046', 'NEU046', // Wellspring Soothsayer 3 mana 3/3 BC heal
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
