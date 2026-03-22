export interface StarterDeckDef {
  id: string;
  name: string;
  color: string;
  cards: string[]; // 60 card codes
}

/**
 * Synergistic starter decks built around characters that share stackGroups.
 * Each deck: exactly 60 cards, no card appears more than 2x, multi-color where
 * characters naturally span colors.
 */

// Deck 1: "Jimmy's Crew" — Red + Blue + Yellow
// Jimmy stack (Red), Otto (Blue), Linus AI (Yellow)
const JIMMYS_CREW: string[] = [
  // Characters — core 2x
  'R013', 'R013', // Jimmy
  'R011', 'R011', // Surfing Jimmy
  'R015', 'R015', // Snowboarding Jimmy
  'U014', 'U014', // Otto
  'U015', 'U015', // Fearless Otto
  'Y001', 'Y001', // Linus
  'Y002', 'Y002', // Smart Linus
  // Characters — support 1x
  'R012',          // Fast Jimmy
  'R014',          // Adventurous Jimmy
  'U016',          // Sneaky Otto
  'Y003',          // Linus on Gavelon
  'R019',          // Dr. Innova (any color combat trick)
  // Equipment
  'R020', 'R020',  // Golden Plasma Hammer
  'R022', 'R022',  // Flaming Sword
  'R021',          // Fire Orb
  'Y020',          // Yellow Aster Egg
  'U020',          // Ice Bow
  // Actions
  'R007', 'R007',  // Search for Knowledge
  'R003',          // Fireball
  'R004',          // Abundant Harvest
  'R006',          // Meltdown
  'Y009',          // Planning
  // Combat Tricks
  'R025', 'R025',  // Burst of Strength
  'R026', 'R026',  // Sucker Punch
  'R024',          // Booby Trap
  'R027',          // Superiority
  'R028',          // Nice Find
  'R029',          // Deft Maneuver
  'Y008',          // Flexible Approach
  // Colorless fill
  'LESS004', 'LESS004', // Hercules
  'LESS028', 'LESS028', // Benjie
  'LESS036', 'LESS036', // Rory
  'LESS027',        // Helping Hand
  'LESS005',        // Mean Hercules
  'LESS029',        // Willie
  'LESS030',        // Sonic
  'LESS040',        // Daisy
  'LESS031',        // Reggie
  'LESS041',        // Everett
  'LESS023',        // Fuel Cell Box
  'LESS032',        // Buster
  'LESS033',        // Rosie
  'LESS037',        // Savannah
  'LESS038',        // Amra
  'LESS039',        // Nala
];

// Deck 2: "Tala's Rangers" — Green + Blue
// Tala stack (Green), Snowball (Blue), Lexi AI (Green)
const TALAS_RANGERS: string[] = [
  // Characters — core 2x
  'GR015', 'GR015', // Tala
  'GR011', 'GR011', // Rescue Tala
  'GR012', 'GR012', // Champ Tala
  'U017', 'U017',   // Snowball
  'U018', 'U018',   // Tracker Snowball
  'GR013', 'GR013', // Lexi
  'GR014', 'GR014', // Flying Lexi
  // Characters — support 1x
  'GR016',           // Masterful Tala
  'U019',            // Crafty Snowball
  'U010',            // Hoot the Snow Owl
  'GR031',           // Kingley
  // Equipment (added extra copies of key equipment)
  'GR022', 'GR022',  // Healing Hedron
  'U025', 'U025',    // Ice Armor
  'GR021',           // Flora Orb
  'U021',            // Spear of Balance
  'U024',            // Multi-Tool
  'GR032',           // Escape Hatch
  // Actions (added 2x Grand Trickery for more combat trick tutoring)
  'GR004', 'GR004',  // Double Remedy
  'GR002', 'GR002',  // Grand Trickery (2x for more trick access)
  'GR029',           // From the Vault
  'GR033',           // Recharge
  'U002',            // Blizzard
  'U004',            // Team Up
  // Combat Tricks (boosted key tricks)
  'GR027', 'GR027',  // Reinforcements
  'U026', 'U026',    // Truce
  'GR024',           // Calming Force
  'GR025',           // Strength in Numbers
  'GR028',           // Refresh
  'U030',            // Freeze
  'U031',            // Deflection
  // Colorless fill (trimmed one filler to make room for extra Grand Trickery)
  'LESS006', 'LESS006', // Xolo
  'LESS033', 'LESS033', // Rosie
  'LESS007',         // Fearless Xolo
  'LESS034',         // Aviator Glasses
  'LESS008',         // Haydar
  'LESS037',         // Savannah
  'LESS026',         // Chomp
  'LESS035',         // Rampage
  'LESS029',         // Willie
  'LESS030',         // Sonic
  'LESS031',         // Reggie
  'LESS041',         // Everett
  'LESS023',         // Fuel Cell Box
  'LESS009',         // Rolo
  'LESS040',         // Daisy
];

// Deck 3: "Derek's Arsenal" — Yellow + Green
// Derek (Yellow, plays any color), Ava (Yellow, tutors), Astrid (Green, extra builds), Leonardo AI (Yellow)
const DEREKS_ARSENAL: string[] = [
  // Characters — core 2x
  'Y004', 'Y004',   // Derek
  'Y005', 'Y005',   // Smart Derek
  'Y006', 'Y006',   // Surfing Derek
  'Y016', 'Y016',   // Ava
  'Y017', 'Y017',   // Clever Ava
  'GR017', 'GR017', // Astrid
  'GR018', 'GR018', // Astrid the Diplomat
  // Characters — support 1x
  'Y018',            // Resourceful Ava
  'GR019',           // Elegant Astrid
  'Y019',            // Leonardo
  'Y023',            // Lucy AI
  'Y024',            // Turig AI
  // Equipment
  'Y020', 'Y020',    // Yellow Aster Egg
  'Y027', 'Y027',    // Radio
  'Y021',            // Plasma Amulet
  'GR021',           // Flora Orb
  'LESS021',         // Colorless Aster Egg
  'LESS024',         // Aster Boots of Speed
  // Actions
  'Y009', 'Y009',    // Planning (draw 3)
  'Y012',            // Tweedle
  'Y013',            // Double Tweedle
  'Y014',            // Tweedle All
  'Y015',            // Be the Ball
  'GR029',           // From the Vault
  // Combat Tricks
  'Y011', 'Y011',    // Daze
  'Y008', 'Y008',    // Flexible Approach
  'Y022',            // Blind Side
  'Y034',            // Plasma Storm
  'GR026',           // Intelligence Replenished
  'LESS027',         // Helping Hand
  // Colorless fill
  'LESS014', 'LESS014', // Levi
  'LESS015', 'LESS015', // Charlotte
  'LESS010',         // Hanu
  'LESS016',         // Willa
  'LESS017',         // Wise Willa
  'LESS042',         // Phantom
  'LESS043',         // Shadow
  'LESS022',         // Aster Key
  'LESS028',         // Benjie
  'LESS036',         // Rory
  'LESS009',         // Rolo
  'LESS004',         // Hercules
  'LESS033',         // Rosie
  'LESS038',         // Amra
  'LESS029',         // Willie
  'LESS030',         // Sonic
];

// Deck 4: "Anders' Pack" — Red + Green
// Anders (Red), Fang (Green), Izzy+Bling (Red), Mighty Mink (Green)
const ANDERS_PACK: string[] = [
  // Characters — core 2x
  'R008', 'R008',   // Anders
  'R009', 'R009',   // Hockbandy Star Anders
  'R010', 'R010',   // Pilot Anders
  'GR006', 'GR006', // Fang
  'R016', 'R016',   // Izzy
  'GR007', 'GR007', // Mighty the Mink
  'R018', 'R018',   // Bling
  // Characters — support 1x
  'R017',            // Masterful Izzy
  'GR008',           // Elegant Mighty
  'GR009',           // Sengo
  'GR010',           // Fiona
  'GR020',           // Ms. Swift
  // Equipment
  'R020', 'R020',    // Golden Plasma Hammer (X=cards in stack)
  'R022',            // Flaming Sword
  'R033',            // Aster Academy Space Jet
  'GR022',           // Healing Hedron
  'GR032',           // Escape Hatch
  'LESS023',         // Fuel Cell Box
  // Actions
  'R003', 'R003',    // Fireball
  'GR004', 'GR004',  // Double Remedy
  'R004',            // Abundant Harvest
  'R006',            // Meltdown
  'R034',            // On the Hunt
  'GR033',           // Recharge
  'GR001',           // Bronze Bear Coin
  // Combat Tricks
  'R025', 'R025',    // Burst of Strength
  'GR027', 'GR027',  // Reinforcements
  'R026',            // Sucker Punch
  'R027',            // Superiority
  'GR024',           // Calming Force
  'GR025',           // Strength in Numbers
  'LESS026',         // Chomp
  // Colorless fill
  'LESS009', 'LESS009', // Rolo
  'LESS028', 'LESS028', // Benjie
  'LESS011',         // Rolo Pack Leader
  'LESS036',         // Rory
  'LESS038',         // Amra
  'LESS041',         // Everett
  'LESS004',         // Hercules
  'LESS005',         // Mean Hercules
  'LESS029',         // Willie
  'LESS030',         // Sonic
  'LESS037',         // Savannah
  'LESS040',         // Daisy
  'LESS042',         // Phantom
  'LESS043',         // Shadow
];

// Deck 5: "Shadow Command" — Black
// Des (BL011-BL013), Venus (BL016-BL017), Dawson (BL028-BL030), Lucas+Jax (BL019-BL021), Jack (BL031-BL032)
const SHADOW_COMMAND: string[] = [
  // Characters — core 2x (reduced some to 1x for balance)
  'BL011', 'BL011', // Des Aster
  'BL012',           // Commander Des (reduced from 2x → 1x)
  'BL019', 'BL019', // Lucas
  'BL020',           // Speedy Lucas (reduced from 2x → 1x)
  'BL017', 'BL017', // Venus
  'BL016', 'BL016', // Princess Venus
  'BL030', 'BL030', // Dawson
  'BL028', 'BL028', // Loyal Dawson
  // Characters — support 1x
  'BL013',           // Controlling Des
  'BL014',           // Bossy Venus
  'BL021',           // Jax
  'BL029',           // Dawson The Mercenary
  'BL018',           // Eldena (any color Action)
  'BL031',           // Explorer Jack
  'BL032',           // Professor Jack
  // Equipment
  'BL024', 'BL024',  // Obsidian Armor
  'BL022',           // Collar
  'BL023',           // Black Aster Egg
  'LESS025',         // Dampening Orb
  // Actions (reduced Oora Drain from 2x → 1x)
  'BL003', 'BL003',  // Night Lightning
  'BL006',            // Oora Drain (reduced from 2x → 1x)
  'BL002',           // Battle of Wits
  'BL004',           // Demolish
  'BL001',           // Cargo Ship
  'BL008',           // Obey
  'BL009',           // Really Ruthless
  // Combat Tricks
  'BL025', 'BL025',  // Dark Plasma Ball
  'BL027', 'BL027',  // Perfect Plan
  'BL026',           // Clever Deterrence
  'LESS035',         // Rampage
  // Colorless fill (Vicious-synergy wild animals + extra fillers for balance)
  'LESS028', 'LESS028', // Benjie (Vicious +1)
  'LESS009', 'LESS009', // Rolo (Vicious)
  'LESS011',         // Rolo Pack Leader
  'LESS041',         // Everett (Vicious +2)
  'LESS036',         // Rory
  'LESS038',         // Amra
  'LESS043',         // Shadow
  'LESS004',         // Hercules
  'LESS005',         // Mean Hercules
  'LESS006',         // Xolo
  'LESS029',         // Willie
  'LESS030',         // Sonic
  'LESS031',         // Reggie
  'LESS033',         // Rosie
  'LESS037',         // Savannah
  'LESS040',         // Daisy (added filler to replace removed copies)
  'LESS032',         // Buster (added filler)
  'LESS039',         // Nala (added filler)
];

// Validate at module load: each deck must be exactly 60 cards, no card > 2 copies
function validateDeck(name: string, cards: string[]): string[] {
  if (cards.length !== 60) {
    throw new Error(`Starter deck "${name}" has ${cards.length} cards, expected 60`);
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
    id: 'starter-jimmys-crew',
    name: "Jimmy's Crew",
    color: 'red',
    cards: validateDeck("Jimmy's Crew", JIMMYS_CREW),
  },
  {
    id: 'starter-talas-rangers',
    name: "Tala's Rangers",
    color: 'green',
    cards: validateDeck("Tala's Rangers", TALAS_RANGERS),
  },
  {
    id: 'starter-dereks-arsenal',
    name: "Derek's Arsenal",
    color: 'yellow',
    cards: validateDeck("Derek's Arsenal", DEREKS_ARSENAL),
  },
  {
    id: 'starter-anders-pack',
    name: "Anders' Pack",
    color: 'red',
    cards: validateDeck("Anders' Pack", ANDERS_PACK),
  },
  {
    id: 'starter-shadow-command',
    name: 'Shadow Command',
    color: 'black',
    cards: validateDeck('Shadow Command', SHADOW_COMMAND),
  },
];
