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
}

// ─── Pending Interaction ───

export interface PendingInteraction {
  type: 'BLOCK_DECISION' | 'COMBAT_TRICK';
  waitingForPlayerId: string;
  timeoutAt: number; // timestamp
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
  turnNumber: number;
  isFirstTurn: boolean; // first player's first turn (no draw, no actions)
  combatState: CombatState | null;
  pendingInteraction: PendingInteraction | null;
  lastAction: string | null;
  log: LogEntry[];
  playerStats: [PlayerStats, PlayerStats];
  combatResult: CombatResult | null;
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
}

export interface ClientPlayerInfo {
  playerId: string;
  playerName: string;
  handCount: number;
  stacks: ClientStack[];
  sideplay: ClientCardInstance[];
  discardCount: number;
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
  myHand: ClientCardInstance[];
  myStacks: ClientStack[];
  mySideplay: ClientCardInstance[];
  myDiscardCount: number;
  opponent: ClientPlayerInfo;
  deckCount: number;
  currentPlayerIndex: 0 | 1;
  turnPhase: TurnPhase;
  buildsRemaining: number;
  actedStacks: string[];
  apScores: [number, number];
  winner: string | null;
  turnNumber: number;
  isFirstTurn: boolean;
  combatState: ClientCombatState | null;
  pendingInteraction: PendingInteraction | null;
  lastAction: string | null;
  log: LogEntry[];
  playerStats: [PlayerStats, PlayerStats];
  combatResult: CombatResult | null;
}

// ─── Lobby ───

export interface LobbyState {
  code: string;
  players: { id: string; name: string; isHost: boolean }[];
  isHost: boolean;
}

// ─── Room ───

export interface Room {
  code: string;
  hostId: string;
  game: GameState | null;
  players: Map<string, string>; // socketId -> playerName
}
