import { z } from 'zod';

// Core Pixelary Types
// CandidateWord removed: use plain strings for candidates

export const SlateDataSchema = z.object({
  slateId: z.string(),
  words: z.array(z.string()),
  timestamp: z.number(),
});
export type SlateData = z.infer<typeof SlateDataSchema>;

export const WordMetricsSchema = z.object({
  impressions: z.number(),
  clicks: z.number(),
  clickRate: z.number(),
  publishes: z.number(),
  publishRate: z.number(),
});
export type WordMetrics = z.infer<typeof WordMetricsSchema>;

export const DictionarySchema = z.object({
  name: z.string(),
  words: z.array(z.string()),
});
export type Dictionary = z.infer<typeof DictionarySchema>;

export const LevelSchema = z.object({
  rank: z.number().int(),
  name: z.string(),
  min: z.number().int(),
  max: z.number().int(),
});
export type Level = z.infer<typeof LevelSchema>;

export const UserProfileSchema = z.object({
  username: z.string(),
  userId: z.string(),
  score: z.number().int(),
  level: z.number().int(),
  levelName: z.string(),
  rank: z.number().int(),
  solved: z.boolean(),
  skipped: z.boolean(),
  guessCount: z.number().int(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const GuessResultSchema = z.object({
  correct: z.boolean(),
  points: z.number().int(),
  isFirstSolve: z.boolean(),
  totalSolves: z.number().int(),
});
export type GuessResult = z.infer<typeof GuessResultSchema>;

export const PostGuessesSchema = z.object({
  guesses: z.record(z.string(), z.number().int()),
  wordCount: z.number().int(),
  guessCount: z.number().int(),
  playerCount: z.number().int(),
  solvedCount: z.number().int(),
});
export type PostGuesses = z.infer<typeof PostGuessesSchema>;

export const UserDataSchema = z.object({
  score: z.number().int(),
  solved: z.boolean(),
  skipped: z.boolean(),
  levelRank: z.number().int(),
  levelName: z.string(),
  guessCount: z.number().int(),
});
export type UserData = z.infer<typeof UserDataSchema>;

// Drawing Post Data
export const DrawingDataSchema = z.object({
  data: z.string(),
  colors: z.array(z.string()).max(256),
  bg: z.number().int().min(0),
  size: z.number().int().min(1).max(64).default(16),
});
export type DrawingData = z.infer<typeof DrawingDataSchema>;

export const DrawingPostDataSchema = z.object({
  type: z.literal('drawing'),
  word: z.string(),
  dictionary: z.string(),
  drawing: DrawingDataSchema,
  authorId: z.string(),
  authorName: z.string(),
});
export type DrawingPostData = z.infer<typeof DrawingPostDataSchema>;

export const DrawingPostDataExtendedSchema = z.object({
  type: z.literal('drawing'),
  postId: z.string(),
  word: z.string(),
  dictionary: z.string(),
  drawing: DrawingDataSchema,
  authorId: z.string(),
  authorName: z.string(),
  playerCount: z.number().int(),
  solvedPercentage: z.number().int(),
  pinnedCommentId: z.string().optional(),
  lastCommentUpdate: z.number().int().optional(),
});
export type DrawingPostDataExtended = z.infer<
  typeof DrawingPostDataExtendedSchema
>;

// Input/Output Schemas for API
export const DrawingSubmitInputSchema = z.object({
  word: z.string(),
  dictionary: z.string(),
  drawing: DrawingDataSchema,
  imageData: z.string().optional(),
});
export type DrawingSubmitInput = z.infer<typeof DrawingSubmitInputSchema>;

export const GuessSubmitInputSchema = z.object({
  postId: z.string(),
  guess: z.string(),
  createComment: z.boolean().default(false),
});
export type GuessSubmitInput = z.infer<typeof GuessSubmitInputSchema>;

export const DictionaryAddInputSchema = z.object({
  word: z.string().min(1).max(50),
});
export type DictionaryAddInput = z.infer<typeof DictionaryAddInputSchema>;

export const DictionaryRemoveInputSchema = z.object({
  word: z.string().min(1).max(50),
});
export type DictionaryRemoveInput = z.infer<typeof DictionaryRemoveInputSchema>;

export const UserDrawingsInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
});
export type UserDrawingsInput = z.infer<typeof UserDrawingsInputSchema>;

export const LeaderboardInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(10),
});
export type LeaderboardInput = z.infer<typeof LeaderboardInputSchema>;

export const GuessStatsInputSchema = z.object({
  postId: z.string(),
});
export type GuessStatsInput = z.infer<typeof GuessStatsInputSchema>;

export const PostDataInputSchema = z.object({
  postId: z.string(),
});
export type PostDataInput = z.infer<typeof PostDataInputSchema>;

// Tournament Post Data
export const TournamentPostDataSchema = z.object({
  type: z.literal('tournament'),
  word: z.string(),
  dictionary: z.string(),
});
export type TournamentPostData = z.infer<typeof TournamentPostDataSchema>;
