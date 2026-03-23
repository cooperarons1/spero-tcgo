import type { HeroClass } from './types.js';

export interface StarterDeckDef {
  id: string;
  name: string;
  heroClass: HeroClass;
  cards: string[]; // 30 card codes
}

// Jimmy — Aggro/Burn (30 cards)
const JIMMY_STARTER: string[] = [
  // Class cards (12)
  'JIM001', 'JIM001', // Ember Sprite 1 mana
  'JIM002', 'JIM002', // Flame Imp 1 mana
  'JIM003', 'JIM003', // Fire Axe 2 mana weapon
  'JIM005', 'JIM005', // Blazing Firehawk 3 mana
  'JIM006', 'JIM006', // Lava Burst 3 mana spell
  'JIM009', 'JIM009', // Inferno 4 mana spell
  // Neutral filler (18)
  'NEU003', 'NEU003', // Scrappy Fighter 1 mana 2/1
  'NEU005', 'NEU005', // Raptor 2 mana 3/2
  'NEU009', 'NEU009', // Iron Sentinel 3 mana 3/4
  'NEU015', 'NEU015', // Chillwind Yeti 4 mana 4/5
  'NEU022', 'NEU022', // Stranglethorn Tiger 5 mana 5/5 Stealth
  'NEU026', 'NEU026', // Boulderfist Ogre 6 mana 6/7
  'NEU029', 'NEU029', // Reckless Rocketeer 6 mana 5/2 Charge
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
  'DRK010', 'DRK010', // Tinker's Oil 4 mana weapon
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
  // Class cards (12)
  'AND001', 'AND001', // Ice Shard 1 mana spell
  'AND003', 'AND003', // Frostbolt 2 mana spell
  'AND005', 'AND005', // Water Elemental 4 mana 3/6
  'AND007', 'AND007', // Blizzard 6 mana AoE
  'AND010', 'AND010', // Glacial Spike 1 mana 2/1 freeze
  'AND009',           // Frost Giant 10 mana 8/8 (legendary = 1 copy)
  'AND008',           // Glacial Barrier 5 mana spell
  // Neutral filler (17)
  'NEU004', 'NEU004', // River Crocolisk 2 mana 2/3
  'NEU010', 'NEU010', // Woodland Defender 3 mana 2/4 Taunt
  'NEU015', 'NEU015', // Chillwind Yeti 4 mana 4/5
  'NEU021', 'NEU021', // Fen Creeper 5 mana 3/6 Taunt
  'NEU026', 'NEU026', // Boulderfist Ogre 6 mana 6/7
  'NEU035', 'NEU035', // Ironclad Behemoth 8 mana 8/8
  'NEU027', 'NEU027', // Sunwalker 6 mana 4/5 Taunt DS
  'NEU046', 'NEU046', // Earthen Ring Farseer 3 mana 3/3 BC heal
  'NEU002', 'NEU002', // Squire 1 mana 1/2
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
];
