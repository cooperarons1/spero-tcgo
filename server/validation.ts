import { z } from 'zod';

export const PlayerNameSchema = z.string().min(1).max(15).regex(/^[a-zA-Z0-9 ]+$/);

export const RoomCodeSchema = z.string().length(6).regex(/^[A-Z]+$/);

export const JoinRoomSchema = z.object({
  code: z.string().min(1).max(6),
  name: z.string().min(1).max(15).regex(/^[a-zA-Z0-9 ]+$/),
});

export const BuildCardSchema = z.object({
  cardInstanceId: z.string(),
  targetStackId: z.string().optional(),
  faceDown: z.boolean().optional(),
});

export const SplitStackSchema = z.object({
  stackId: z.string(),
  cardInstanceIds: z.array(z.string()),
});

export const CombineStacksSchema = z.object({
  stackId1: z.string(),
  stackId2: z.string(),
});

export const RestoreCardSchema = z.object({
  stackId: z.string(),
  cardInstanceId: z.string(),
});

export const StackTargetSchema = z.object({
  stackId: z.string(),
});

export const PlayActionCardSchema = z.object({
  cardInstanceId: z.string(),
  stackId: z.string(),
});

export const DuelSchema = z.object({
  attackerStackId: z.string(),
  targetStackId: z.string(),
});

export const BlockDecisionSchema = z.object({
  blockingStackId: z.string().nullable(),
});

export const PlayCombatTrickSchema = z.object({
  cardInstanceId: z.string().nullable(),
});

export const HoverHandSchema = z.object({
  isHovering: z.boolean(),
});

export const ChooseTargetSchema = z.object({
  interactionId: z.string(),
  selectedTargetId: z.string().nullable(),
});

export const EmoteSchema = z.object({
  emoteId: z.string().max(20),
});

export const SelectDeckSchema = z.object({
  deckCards: z.array(z.string()).nullable(),
});

export const DeckListSchema = z.object({
  id: z.string(),
  name: z.string().max(30),
  cards: z.array(z.string()),
  createdAt: z.number(),
  updatedAt: z.number(),
});
