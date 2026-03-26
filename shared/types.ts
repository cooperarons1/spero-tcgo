// ─── Card Types ───

export type CardType = 'MINION' | 'SPELL' | 'WEAPON' | 'LOCATION';
export type CardRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type HeroClass = 'DEREK' | 'TALA' | 'JIMMY' | 'ANDERS' | 'DES' | 'ASTRID' | 'AVA' | 'LUCAS' | 'IZZY' | 'NEUTRAL';
export type MinionType = 'BEAST' | 'MECH' | 'ELEMENTAL' | 'SPIRIT' | 'DRAGON' | 'PIRATE' | 'UNDEAD' | null;

export type Keyword =
  | 'TAUNT'
  | 'CHARGE'
  | 'DIVINE_SHIELD'
  | 'BATTLECRY'
  | 'DEATHRATTLE'
  | 'FREEZE'
  | 'WINDFURY'
  | 'STEALTH'
  | 'SECRET'
  | 'END_OF_TURN'
  | 'COMBO'
  | 'BOND'
  | 'COLLAR'
  | 'ORRA_CHARGE';

// ─── Secrets ───

export type SecretTrigger =
  | 'WHEN_ATTACKED'              // opponent declares any attack
  | 'WHEN_HERO_ATTACKED'         // opponent attacks your hero
  | 'WHEN_MINION_PLAYED'         // opponent plays a minion
  | 'WHEN_SPELL_CAST'            // opponent casts a spell
  | 'WHEN_FRIENDLY_MINION_DIES'; // one of your minions dies

export interface ActiveSecret {
  instanceId: string;
  cardCode: string;
  ownerPlayerIndex: 0 | 1;
}

export interface CardDef {
  cardCode: string;
  name: string;
  manaCost: number;
  type: CardType;
  heroClass: HeroClass;
  rarity: CardRarity;
  attack: number;       // minions & weapons
  health: number;       // minions (durability for weapons)
  text: string;         // ability text
  flavor: string;
  keywords: Keyword[];
  battlecryEffect?: EffectDef;
  battlecryEffects?: EffectDef[];
  deathrattleEffect?: EffectDef;
  spellEffect?: EffectDef;
  spellEffects?: EffectDef[];
  secretTrigger?: SecretTrigger;
  secretEffect?: EffectDef;
  secretEffects?: EffectDef[];
  endOfTurnEffect?: EffectDef;
  comboEffect?: EffectDef;
  comboEffects?: EffectDef[];
  minionType?: MinionType;
  locationEffect?: EffectDef;
  locationEffects?: EffectDef[];
  // Bond: named partner pairing
  bondPartnerCode?: string;       // cardCode of the bond partner
  bondEffect?: EffectDef;         // effect applied to BOTH when bond triggers
  // Orra Charge: ticking time-bomb minions
  orraChargeMax?: number;         // charges needed to fire
  orraChargeEffect?: EffectDef;   // effect that fires at max charge
}

// ─── Effect System ───

export type EffectType =
  | 'DEAL_DAMAGE'
  | 'RESTORE_HEALTH'
  | 'DRAW_CARDS'
  | 'SUMMON_MINION'
  | 'BUFF_MINION'
  | 'BUFF_ALL_FRIENDLY'
  | 'BUFF_ALL_ENEMY'
  | 'DESTROY_MINION'
  | 'FREEZE_TARGET'
  | 'SILENCE_TARGET'
  | 'GAIN_ARMOR'
  | 'DEAL_DAMAGE_ALL_ENEMIES'
  | 'DEAL_DAMAGE_ALL_MINIONS'
  | 'DEAL_DAMAGE_RANDOM_ENEMY'
  | 'RETURN_TO_HAND'
  | 'GAIN_MANA_CRYSTAL'
  | 'GAIN_TEMPORARY_MANA'
  | 'GRANT_KEYWORD'
  | 'COUNTER_SPELL'
  | 'COPY_MINION'
  | 'DEAL_DAMAGE_BASED_ON_ARMOR'
  | 'DRAW_CARDS_CONDITIONAL'
  | 'SWAP_ATTACK_HEALTH';

export type EffectTarget =
  | 'NONE'
  | 'TARGET_MINION'
  | 'TARGET_ANY'          // minion or hero
  | 'TARGET_FRIENDLY_MINION'
  | 'TARGET_ENEMY_MINION'
  | 'TARGET_HERO'
  | 'ALL_ENEMY_MINIONS'
  | 'ALL_FRIENDLY_MINIONS'
  | 'ALL_MINIONS'
  | 'SELF'                // the minion itself
  | 'RANDOM_ENEMY'
  | 'RANDOM_ENEMY_MINION';

export interface EffectDef {
  type: EffectType;
  target: EffectTarget;
  value?: number;         // damage/heal amount, cards to draw, etc.
  attackBuff?: number;
  healthBuff?: number;
  summonCardCode?: string;
  summonCount?: number;
  grantKeyword?: Keyword; // for GRANT_KEYWORD effect
  condition?: string;     // for conditional effects (e.g. 'HAS_DIVINE_SHIELD_MINION')
}

// ─── Enchantment (buff/debuff on a minion) ───

export interface Enchantment {
  source: string;    // cardCode that caused it
  attackMod: number;
  healthMod: number;
  addedKeywords?: Keyword[];
}

// ─── Runtime Card Instance ───

export interface CardInstance {
  instanceId: string;
  cardCode: string;
}

// ─── Board Minion (in-play instance) ───

export interface BoardMinion {
  instanceId: string;
  cardCode: string;
  currentAttack: number;
  currentHealth: number;
  maxHealth: number;
  canAttack: boolean;       // false on summon turn (summoning sickness)
  attacksRemaining: number; // usually 1, Windfury = 2
  hasDivineShield: boolean;
  isFrozen: boolean;
  isSilenced: boolean;
  hasStealthUntilAttack: boolean;
  enchantments: Enchantment[];
  // Orra Charge state
  currentOrraCharge?: number;
  // Collar state
  isCollared?: boolean;
  collarOwnerIndex?: 0 | 1; // which player will gain this minion
}

// ─── Board Location ───

export interface BoardLocation {
  instanceId: string;
  cardCode: string;
  durability: number;
  maxDurability: number;
  cooldownRemaining: number; // 1 on play, decrements each turn
  activatedThisTurn: boolean;
}

// ─── Weapon ───

export interface Weapon {
  cardCode: string;
  currentAttack: number;
  durability: number;
}

// ─── Player State ───

export interface PlayerState {
  playerId: string;
  playerName: string;
  heroClass: HeroClass;
  health: number;          // starts 30
  maxHealth: number;
  armor: number;
  mana: number;            // current available
  maxMana: number;         // crystals this turn (1-10)
  hand: CardInstance[];    // max 10
  board: BoardMinion[];    // max 7
  weapon: Weapon | null;
  locations: BoardLocation[];
  heroPowerUsed: boolean;
  heroAttackThisTurn: number; // temporary hero attack (e.g. Lucas hero power)
  fatigueDamage: number;   // increments each draw from empty deck
  graveyard: CardInstance[];
  secrets: ActiveSecret[];
  // Hero power upgrade system
  heroPowerUpgraded: boolean;
  upgradeProgress: number; // tracks progress toward upgrade condition
}

// ─── Game State ───

export interface GameState {
  players: [PlayerState, PlayerState];
  decks: [CardInstance[], CardInstance[]];
  currentPlayerIndex: 0 | 1;
  turnNumber: number;
  phase: 'MULLIGAN' | 'PLAYING';
  mulliganChoices: [boolean[] | null, boolean[] | null];
  mulliganConfirmed: [boolean, boolean];
  winner: string | null;
  winReason: 'kill' | 'fatigue' | 'concede' | 'disconnect' | null;
  lastAction: string | null;
  log: LogEntry[];
  turnStartedAt: number | null;
  playerStats: [PlayerStats, PlayerStats];
  pendingInteraction: PendingInteraction | null;
  cardsPlayedThisTurn: number; // for COMBO mechanic
  spectators?: string[];       // spectator user IDs
}

// ─── Game Log ───

export type LogCategory = 'PLAY' | 'COMBAT' | 'EFFECT' | 'TURN' | 'GAME';

export interface LogEntry {
  id: number;
  turnNumber: number;
  playerIndex: 0 | 1 | null;
  message: string;
  category: LogCategory;
}

// ─── Player Stats ───

export interface PlayerStats {
  minionsPlayed: number;
  spellsCast: number;
  weaponsEquipped: number;
  locationsPlayed: number;
  heroPowerUses: number;
  minionsKilled: number;
  damageDealtToHeroes: number;
  damageDealtToMinions: number;
  healingDone: number;
  cardsDrawn: number;
  turnsPlayed: number;
  manaSpent: number;
}

// ─── Pending Interaction (for Battlecry / spell targeting) ───

export interface TargetChoice {
  interactionId: string;
  effectSource: string;        // cardCode that triggered it
  prompt: string;              // "Choose a target"
  validTargets: TargetOption[];
  allowSkip: boolean;
  context: 'battlecry' | 'spell' | 'hero-power' | 'location';
}

export interface TargetOption {
  id: string;       // instanceId for minion, 'hero-0' / 'hero-1' for heroes
  label: string;
  sublabel?: string;
  ownerPlayerIndex?: 0 | 1;
}

export interface PendingInteraction {
  type: 'CHOOSE_TARGET';
  waitingForPlayerId: string;
  timeoutAt: number;
  targetChoice?: TargetChoice;
}

// ─── Client State (sanitized per player) ───

export interface ClientCardInstance {
  instanceId: string;
  cardCode: string | null; // null if in opponent's hand
}

export interface ClientPlayerInfo {
  playerId: string;
  playerName: string;
  heroClass: HeroClass;
  health: number;
  maxHealth: number;
  armor: number;
  mana: number;
  maxMana: number;
  handCount: number;
  board: BoardMinion[];
  locations: BoardLocation[];
  weapon: Weapon | null;
  heroPowerUsed: boolean;
  heroAttackThisTurn: number;
  fatigueDamage: number;
  graveyardCount: number;
  secretCount: number;
  heroPowerUpgraded: boolean;
  upgradeProgress: number;
}

export interface ClientGameState {
  myPlayerId: string;
  myPlayerIndex: 0 | 1;
  myPlayerName: string;
  myHeroClass: HeroClass;
  myHealth: number;
  myMaxHealth: number;
  myArmor: number;
  myMana: number;
  myMaxMana: number;
  myHand: ClientCardInstance[];
  myBoard: BoardMinion[];
  myLocations: BoardLocation[];
  myWeapon: Weapon | null;
  myHeroPowerUsed: boolean;
  myHeroAttackThisTurn: number;
  myFatigueDamage: number;
  myGraveyardCount: number;
  mySecrets: ActiveSecret[];
  myHeroPowerUpgraded: boolean;
  myUpgradeProgress: number;
  opponent: ClientPlayerInfo;
  deckCount: number;
  opponentDeckCount: number;
  currentPlayerIndex: 0 | 1;
  turnNumber: number;
  phase: 'MULLIGAN' | 'PLAYING';
  mulliganConfirmed: [boolean, boolean];
  winner: string | null;
  winReason: 'kill' | 'fatigue' | 'concede' | 'disconnect' | null;
  lastAction: string | null;
  log: LogEntry[];
  pendingInteraction: PendingInteraction | null;
  turnDeadline: number | null;
  playerStats: [PlayerStats, PlayerStats];
  spectatorCount: number;
  isSpectator?: boolean;
}

// ─── Constants ───

export const DECK_SIZE = 30;
export const MAX_COPIES_PER_CARD = 2;
export const MAX_COPIES_LEGENDARY = 1;
export const MAX_BOARD_SIZE = 7;
export const MAX_SECRETS = 5;
export const MAX_HAND_SIZE = 10;
export const MAX_MANA = 10;
export const STARTING_HEALTH = 30;
export const HERO_POWER_COST = 2;
export const TURN_TIMEOUT_MS = 75_000;

// ─── Lobby ───

export interface LobbyState {
  code: string;
  players: { id: string; name: string; isHost: boolean }[];
  isHost: boolean;
}

// ─── DeckList ───

export interface DeckList {
  id: string;
  name: string;
  heroClass: HeroClass;
  cards: string[];    // cardCodes, length 30, duplicates = multiple copies
  createdAt: number;
  updatedAt: number;
  isStarterDeck?: boolean;
}

// ─── Room ───

export interface Room {
  code: string;
  hostId: string;
  game: GameState | null;
  players: Map<string, string>; // uid -> playerName
  sockets: Map<string, string>; // uid -> socketId
  timerInterval: ReturnType<typeof setInterval> | null;
  rematchProposedBy: string | null;
  lastFirstPlayerIndex: 0 | 1 | null;
  selectedDecks: Map<string, { heroClass: HeroClass; cards: string[] }>;
  isAIGame?: boolean;
  aiPlayerId?: string;
}

// ─── User Profile ───

export type RankTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND' | 'LEGEND';

export function getRankTier(elo: number): RankTier {
  if (elo >= 2100) return 'LEGEND';
  if (elo >= 1800) return 'DIAMOND';
  if (elo >= 1500) return 'GOLD';
  if (elo >= 1200) return 'SILVER';
  return 'BRONZE';
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  createdAt: number;
  gamesPlayed: number;
  gamesWon: number;
  elo: number;
  rankTier: RankTier;
  xp: number;
  level: number;
  gold: number;
  quests?: DailyQuest[];
  questsRefreshedAt?: number;
}

// ─── Daily Quests ───

export type QuestType =
  | 'WIN_GAMES_AS_CLASS'
  | 'PLAY_MINIONS'
  | 'DEAL_DAMAGE_TO_HEROES'
  | 'CAST_SPELLS'
  | 'DESTROY_MINIONS'
  | 'WIN_GAMES';

export interface DailyQuest {
  id: string;
  type: QuestType;
  description: string;
  target: number;       // how many to complete
  progress: number;     // current progress
  reward: number;       // gold reward
  heroClass?: HeroClass; // for class-specific quests
  completed: boolean;
}

// ─── Friends & Chat ───

export interface FriendRecord {
  uid: string;
  displayName: string;
  addedAt: number;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromName: string;
  toUid: string;
  toName: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  fromUid: string;
  text: string;
  timestamp: number;
}

export interface DuelChallenge {
  id: string;
  fromUid: string;
  fromName: string;
  toUid: string;
  createdAt: number;
}
