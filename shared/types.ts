// ─── Card Types ───

export type CardType = 'MINION' | 'SPELL' | 'WEAPON';
export type CardRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type HeroClass = 'DEREK' | 'TALA' | 'JIMMY' | 'ANDERS' | 'NEUTRAL';

export type Keyword =
  | 'TAUNT'
  | 'CHARGE'
  | 'DIVINE_SHIELD'
  | 'BATTLECRY'
  | 'DEATHRATTLE'
  | 'FREEZE'
  | 'WINDFURY'
  | 'STEALTH';

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
  | 'GRANT_KEYWORD';

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
  heroPowerUsed: boolean;
  fatigueDamage: number;   // increments each draw from empty deck
  graveyard: CardInstance[];
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
  winReason: 'kill' | 'fatigue' | 'concede' | null;
  lastAction: string | null;
  log: LogEntry[];
  turnStartedAt: number | null;
  playerStats: [PlayerStats, PlayerStats];
  pendingInteraction: PendingInteraction | null;
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
  context: 'battlecry' | 'spell' | 'hero-power';
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
  weapon: Weapon | null;
  heroPowerUsed: boolean;
  fatigueDamage: number;
  graveyardCount: number;
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
  myWeapon: Weapon | null;
  myHeroPowerUsed: boolean;
  myFatigueDamage: number;
  myGraveyardCount: number;
  opponent: ClientPlayerInfo;
  deckCount: number;
  opponentDeckCount: number;
  currentPlayerIndex: 0 | 1;
  turnNumber: number;
  phase: 'MULLIGAN' | 'PLAYING';
  mulliganConfirmed: [boolean, boolean];
  winner: string | null;
  winReason: 'kill' | 'fatigue' | 'concede' | null;
  lastAction: string | null;
  log: LogEntry[];
  pendingInteraction: PendingInteraction | null;
  turnDeadline: number | null;
  playerStats: [PlayerStats, PlayerStats];
}

// ─── Constants ───

export const DECK_SIZE = 30;
export const MAX_COPIES_PER_CARD = 2;
export const MAX_COPIES_LEGENDARY = 1;
export const MAX_BOARD_SIZE = 7;
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

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  createdAt: number;
  gamesPlayed: number;
  gamesWon: number;
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
