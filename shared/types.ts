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

export interface Room {
  code: string;
  hostId: string;
  game: GameState | null;
  players: Map<string, string>; // socketId -> playerName
  timerInterval: ReturnType<typeof setInterval> | null;
}
