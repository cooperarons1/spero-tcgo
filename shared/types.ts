// ─── Card Database (static, 224 entries) ───

export interface CardDef {
  rawNum: number;
  cardCode: string;
  name: string;
  cost: number;
  stackGroup: string;
  typeA: 'CHARACTER' | 'EQUIPMENT' | 'ACTION' | 'COMBAT TRICK';
  typeB: string; // HUMAN, AI, ANIMAL COMPANION, WILD ANIMAL, ALPHA WILD ANIMAL, SIDEPLAY
  species: string;
  color: CardColor;
  smarts: number;
  power: number;
  rulesText: string;
  flavor: string;
}

export type CardColor = 'red' | 'blue' | 'yellow' | 'green' | 'black' | 'none';

// ─── Runtime Card Instance ───

export interface CardInstance {
  instanceId: string;
  cardCode: string;
  faceUp: boolean;
}

// ─── Stack ───

export interface Stack {
  stackId: string;
  cards: CardInstance[]; // bottom-to-top
  tapped: boolean;
  ownerId: string;
  skipNextUntap?: boolean;
  createdOnTurn?: number;
}

// ─── Player Zone ───

export interface PlayerZone {
  playerId: string;
  playerName: string;
  hand: CardInstance[];
  stacks: Stack[];
  sideplay: CardInstance[];
  discardPile: CardInstance[];
}

// ─── Turn Phases ───

export type TurnPhase = 'UNTAP' | 'DRAW' | 'BUILD' | 'ACTION' | 'END';

// ─── Combat Trick Effect ───

export interface CombatTrickEffect {
  statBonus?: { power: number; smarts: number };
  drawCards?: number;
  damageToOpposingStack?: number;
  damageToThisStack?: number;
  noDamageThisCombat?: boolean;
  thisStackNoDamage?: boolean;
  switchStat?: boolean;
  blockOpponentTricks?: boolean;
  perCardInStack?: { power: number; smarts: number };
  perStunnedCard?: { power: number; smarts: number };
  reduceOpposingCharacterPower?: boolean;
  opposingNoUntap?: boolean;
  viciousBonus?: number;
  smartsStrategyBonus?: number;
  powerStrategyBonus?: number;
  conditionalWildAnimal?: CombatTrickEffect;
  recycleTrickFromDiscard?: boolean;
  restoreCardInThisStack?: boolean;
  restoreCardInAnyStack?: boolean;
  stunCardInOpposingStack?: boolean;
  stunViciousCard?: boolean;
  stunSmartsStrategyCard?: boolean;
  stunPowerStrategyCard?: boolean;
  destroyEquipmentInOpposingStack?: boolean;
  drawCardsIfNoDamageTaken?: number;
}

// ─── Combat State ───

export type CombatPhase =
  | 'AWAITING_BLOCK'
  | 'AWAITING_DEFENDER_TRICK'
  | 'AWAITING_ATTACKER_TRICK'
  | 'RESOLVING';

export interface CombatState {
  attackerStackId: string;
  attackerPlayerId: string;
  defenderPlayerId: string;
  defenderStackId: string | null; // null = unblocked
  missionType: 'POWER' | 'SMARTS';
  attackerStat: number;
  defenderStat: number;
  attackerTrickId: string | null;
  defenderTrickId: string | null;
  phase: CombatPhase;
  isDuel: boolean;
  atkTrickEffect: CombatTrickEffect | null;
  defTrickEffect: CombatTrickEffect | null;
}

// ─── Pending Interaction ───

export interface TargetChoice {
  interactionId: string;
  effectSource: string;        // cardCode that triggered it
  prompt: string;              // "Choose a card to stun"
  targetType: 'card-in-stack' | 'stack' | 'card-in-discard' | 'card-in-deck' | 'sideplay';
  validTargets: TargetOption[];
  allowSkip: boolean;
  context: 'combat-trick' | 'on-play' | 'action' | 'sideplay-trigger';
}

export interface TargetOption {
  id: string;
  label: string;
  sublabel?: string;
  stackId?: string;
  ownerPlayerId?: string;
}

export interface PendingInteraction {
  type: 'BLOCK_DECISION' | 'COMBAT_TRICK' | 'CHOOSE_TARGET';
  waitingForPlayerId: string;
  timeoutAt: number; // timestamp
  targetChoice?: TargetChoice;
}

// ─── Game Log ───

export type LogCategory = 'BUILD' | 'MISSION' | 'COMBAT' | 'AP' | 'PHASE' | 'GAME';

export interface LogEntry {
  id: number;
  turnNumber: number;
  playerIndex: 0 | 1 | null;
  message: string;
  category: LogCategory;
}

// ─── Player Stats ───

export interface PlayerStats {
  apEarned: number;
  missionsLaunched: number;
  missionsUnblocked: number;
  cardsPlayed: number;
  combatTricksUsed: number;
  damageDealt: number;
  duelsInitiated: number;
  blocksAttempted: number;
  blocksSucceeded: number;
  buildsFaceDown: number;
  actionsPlayed: number;
  stacksLost: number;
  turnsPlayed: number;
  buildsUsed: number;
  missionsBlocked: number;
}

export interface CardStats {
  timesPlayed: number;
  combatWins: number;
  combatLosses: number;
  trickUses: number;
}

// ─── Combat Result ───

export interface CombatResult {
  missionType: 'POWER' | 'SMARTS';
  isDuel: boolean;
  attackerName: string;
  defenderName: string;
  attackerStackName: string;
  defenderStackName: string;
  attackerBase: number;
  defenderBase: number;
  attackerTrickName: string | null;
  attackerTrickBonus: number;
  defenderTrickName: string | null;
  defenderTrickBonus: number;
  attackerTotal: number;
  defenderTotal: number;
  outcome: 'ATK_WIN' | 'DEF_WIN' | 'TIE';
  attackerDamage: number;
  defenderDamage: number;
  apAwarded: number;
}

// ─── Game State ───

export interface GameState {
  players: [PlayerZone, PlayerZone];
  decks: [CardInstance[], CardInstance[]];
  currentPlayerIndex: 0 | 1;
  turnPhase: TurnPhase;
  buildsRemaining: number;
  actedStacks: Set<string>; // stackIds that acted this turn
  apScores: [number, number];
  winner: string | null; // playerId
  winReason: 'ap' | 'deckout' | 'concede' | null;
  turnNumber: number;
  isFirstTurn: boolean; // first player's first turn (no draw, no actions)
  combatState: CombatState | null;
  pendingInteraction: PendingInteraction | null;
  lastAction: string | null;
  log: LogEntry[];
  playerStats: [PlayerStats, PlayerStats];
  combatResult: CombatResult | null;
  turnDurations: number[];
  apTimeline: [number, number][];
  cardStats: Record<string, CardStats>;
  turnStartedAt: number | null;
}

// ─── Client State (sanitized per player) ───

export interface ClientCardInstance {
  instanceId: string;
  cardCode: string | null; // null if face-down opponent card
  faceUp: boolean;
}

export interface ClientStack {
  stackId: string;
  cards: ClientCardInstance[];
  tapped: boolean;
  ownerId: string;
  createdOnTurn?: number;
}

export interface ClientPlayerInfo {
  playerId: string;
  playerName: string;
  handCount: number;
  stacks: ClientStack[];
  sideplay: ClientCardInstance[];
  discardCount: number;
  discard: ClientCardInstance[];
}

export interface ClientCombatState {
  attackerStackId: string;
  attackerPlayerId: string;
  defenderPlayerId: string;
  defenderStackId: string | null;
  missionType: 'POWER' | 'SMARTS';
  attackerStat: number;
  defenderStat: number;
  phase: CombatPhase;
  isDuel: boolean;
  // Tricks visible only after resolution
  attackerTrickCode: string | null;
  defenderTrickCode: string | null;
}

export interface ClientGameState {
  myPlayerId: string;
  myPlayerIndex: 0 | 1;
  myPlayerName: string;
  myHand: ClientCardInstance[];
  myStacks: ClientStack[];
  mySideplay: ClientCardInstance[];
  myDiscardCount: number;
  myDiscard: ClientCardInstance[];
  opponent: ClientPlayerInfo;
  deckCount: number;
  opponentDeckCount: number;
  currentPlayerIndex: 0 | 1;
  turnPhase: TurnPhase;
  buildsRemaining: number;
  actedStacks: string[];
  apScores: [number, number];
  winner: string | null;
  winReason: 'ap' | 'deckout' | 'concede' | null;
  turnNumber: number;
  isFirstTurn: boolean;
  combatState: ClientCombatState | null;
  pendingInteraction: PendingInteraction | null;
  lastAction: string | null;
  log: LogEntry[];
  playerStats: [PlayerStats, PlayerStats];
  combatResult: CombatResult | null;
  turnDeadline: number | null;
  cardStats: Record<string, CardStats> | null;
  apTimeline: [number, number][] | null;
  turnDurations: number[] | null;
}

// ─── Lobby ───

export interface LobbyState {
  code: string;
  players: { id: string; name: string; isHost: boolean }[];
  isHost: boolean;
}

// ─── Room ───

export interface DeckList {
  id: string;
  name: string;
  cards: string[];    // cardCodes, length 60, duplicates = multiple copies
  createdAt: number;
  updatedAt: number;
  isStarterDeck?: boolean;
}

export const DECK_SIZE = 60;
export const MAX_COPIES_PER_CARD = 2;
export const AP_TO_WIN = 15;

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  createdAt: number;
  gamesPlayed: number;
  gamesWon: number;
}

export interface Room {
  code: string;
  hostId: string;
  game: GameState | null;
  players: Map<string, string>; // uid -> playerName
  sockets: Map<string, string>; // uid -> socketId
  timerInterval: ReturnType<typeof setInterval> | null;
  rematchProposedBy: string | null;
  lastFirstPlayerIndex: 0 | 1 | null;
  selectedDecks: Map<string, string[]>; // uid -> cardCodes
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
