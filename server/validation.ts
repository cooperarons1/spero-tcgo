import { z } from 'zod';

export const PlayerNameSchema = z.string().min(1).max(15).regex(/^[a-zA-Z0-9 ]+$/);

export const RoomCodeSchema = z.string().length(6).regex(/^[A-Z]+$/);

export const JoinRoomSchema = z.object({
  code: z.string().min(1).max(6),
  name: z.string().min(1).max(15).regex(/^[a-zA-Z0-9 ]+$/),
});

// ── Game Actions ──

export const MulliganConfirmSchema = z.object({
  replacements: z.array(z.boolean()),
});

export const PlayCardSchema = z.object({
  cardInstanceId: z.string(),
  position: z.number().int().min(0).max(6).optional(),
  targetId: z.string().optional().nullable(),
});

export const AttackSchema = z.object({
  attackerInstanceId: z.string(),
  targetId: z.string(),
});

export const HeroPowerSchema = z.object({
  targetId: z.string().optional().nullable(),
});

export const ActivateLocationSchema = z.object({
  locationInstanceId: z.string(),
  targetId: z.string().optional().nullable(),
});

export const EmoteSchema = z.object({
  emoteId: z.string().max(20),
});

export const SelectDeckSchema = z.object({
  heroClass: z.enum(['DEREK', 'TALA', 'JIMMY', 'ANDERS', 'DES', 'ASTRID', 'AVA', 'LUCAS', 'IZZY']),
  deckCards: z.array(z.string()).nullable(),
});

export const DeckListSchema = z.object({
  id: z.string(),
  name: z.string().max(30),
  heroClass: z.enum(['DEREK', 'TALA', 'JIMMY', 'ANDERS', 'DES', 'ASTRID', 'AVA', 'LUCAS', 'IZZY']),
  cards: z.array(z.string()),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const JoinQueueSchema = z.object({
  heroClass: z.enum(['DEREK', 'TALA', 'JIMMY', 'ANDERS', 'DES', 'ASTRID', 'AVA', 'LUCAS', 'IZZY']),
  deckCards: z.array(z.string()).length(30),
  mode: z.enum(['casual', 'ranked']).default('casual'),
});

export const StartAIGameSchema = z.object({
  heroClass: z.enum(['DEREK', 'TALA', 'JIMMY', 'ANDERS', 'DES', 'ASTRID', 'AVA', 'LUCAS', 'IZZY']),
  deckCards: z.array(z.string()).length(30),
});

export const HoverHandSchema = z.object({
  isHovering: z.boolean(),
});

export const ChooseTargetSchema = z.object({
  interactionId: z.string(),
  selectedTargetId: z.string().nullable(),
});

// ── Friends & Chat ──

export const SearchUsersSchema = z.object({
  query: z.string().min(1).max(30),
});

export const FriendRequestSchema = z.object({
  targetUid: z.string().min(1).max(128),
});

export const FriendRequestActionSchema = z.object({
  requestId: z.string().min(1).max(128),
});

export const RemoveFriendSchema = z.object({
  friendUid: z.string().min(1).max(128),
});

export const SendChatSchema = z.object({
  friendUid: z.string().min(1).max(128),
  text: z.string().min(1).max(500),
});

export const ChallengeFriendSchema = z.object({
  friendUid: z.string().min(1).max(128),
  heroClass: z.enum(['DEREK', 'TALA', 'JIMMY', 'ANDERS', 'DES', 'ASTRID', 'AVA', 'LUCAS', 'IZZY']),
  deckCards: z.array(z.string()).length(30),
});

export const ChallengeResponseSchema = z.object({
  challengeId: z.string().min(1).max(128),
  accept: z.boolean(),
  heroClass: z.enum(['DEREK', 'TALA', 'JIMMY', 'ANDERS', 'DES', 'ASTRID', 'AVA', 'LUCAS', 'IZZY']).optional(),
  deckCards: z.array(z.string()).length(30).optional(),
});

// ── Shop ──

export const CraftCardSchema = z.object({
  cardCode: z.string().min(1).max(50),
});

export const DisenchantCardSchema = z.object({
  cardCode: z.string().min(1).max(50),
});

// ── Profile ──

export const SelectCardBackSchema = z.object({
  cardBackId: z.string().min(1).max(50),
});

export const SelectCoinSchema = z.object({
  coinId: z.string().min(1).max(50),
});

export const ClaimBattlepassRewardSchema = z.object({
  tier: z.number().int().min(1).max(100),
  track: z.enum(['free', 'premium']),
});
