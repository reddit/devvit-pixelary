import { z } from 'zod';

// Core Pixelary Types
export const CandidateWordSchema = z.object({
  dictionaryName: z.string(),
  word: z.string(),
});
export type CandidateWord = z.infer<typeof CandidateWordSchema>;

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
  extraTime: z.number().int(),
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

export const CollectionDataSchema = z.object({
  postId: z.string(),
  data: z.object({
    data: z.string(),
    colors: z.array(z.string()).max(256),
    bg: z.number().int().min(0),
    size: z.number().int().min(1).max(64).default(16),
  }),
  authorUsername: z.string(),
});
export type CollectionData = z.infer<typeof CollectionDataSchema>;

export const PostGuessesSchema = z.object({
  guesses: z.record(z.string(), z.number().int()),
  wordCount: z.number().int(),
  guessCount: z.number().int(),
  playerCount: z.number().int().optional(),
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

export const WordSelectionEventSchema = z.object({
  userId: z.string(),
  postId: z.string(),
  options: z.array(CandidateWordSchema),
  word: z.string().optional(),
  type: z.enum(['refresh', 'manual', 'auto']),
});
export type WordSelectionEvent = z.infer<typeof WordSelectionEventSchema>;

// Word Metadata Types
export const WordReportSchema = z.object({
  username: z.string(),
  reason: z.string().optional(),
  timestamp: z.number().int(),
});
export type WordReport = z.infer<typeof WordReportSchema>;

export const WordStatsSchema = z.object({
  exposures: z.number().int(), // Times shown in word selection
  picks: z.number().int(), // Times selected by users
  submissions: z.number().int(), // Times a drawing was submitted
  guesses: z.number().int(), // Total guess attempts
  solves: z.number().int(), // Total successful solves
});
export type WordStats = z.infer<typeof WordStatsSchema>;

export const WordMetadataSchema = z.object({
  word: z.string(),
  addedBy: z.string(),
  addedAt: z.number().int(),
  commentId: z.string(), // The !add comment ID for tracking
  reports: z.array(WordReportSchema),
  stats: WordStatsSchema,
});
export type WordMetadata = z.infer<typeof WordMetadataSchema>;

export const WordCommandCommentSchema = z.object({
  command: z.string(),
  word: z.string(),
  author: z.string(),
  timestamp: z.number().int(),
});
export type WordCommandComment = z.infer<typeof WordCommandCommentSchema>;

// Drawing Post Data (extends base DrawingPostData)
export const DrawingPostDataExtendedSchema = z.object({
  type: z.literal('drawing'),
  postId: z.string(),
  word: z.string(),
  dictionaryName: z.string(),
  data: z.object({
    data: z.string(),
    colors: z.array(z.string()).max(256),
    bg: z.number().int().min(0),
    size: z.number().int().min(1).max(64).default(16),
  }),
  authorUserId: z.string(),
  authorUsername: z.string(),
  date: z.number().int(),
  solves: z.number().int(),
  skips: z.number().int(),
  seed: z.string().optional(),
  mode: z.string().optional(),
  createdAt: z.number().int().optional(),
  timerSec: z.number().int().optional(),
  admins: z.array(z.string()).optional(),
  pinnedCommentId: z.string().optional(),
  lastCommentUpdate: z.number().int().optional(),
});
export type DrawingPostDataExtended = z.infer<
  typeof DrawingPostDataExtendedSchema
>;

// Collection Post Data
export const CollectionPostDataExtendedSchema = z.object({
  type: z.literal('collection'),
  postId: z.string(),
  data: z.array(CollectionDataSchema),
  timeframe: z.string(),
});
export type CollectionPostDataExtended = z.infer<
  typeof CollectionPostDataExtendedSchema
>;

// Input/Output Schemas for API
export const DrawingSubmitInputSchema = z.object({
  word: z.string(),
  dictionaryName: z.string(),
  data: z.object({
    data: z.string(),
    colors: z.array(z.string()).max(256),
    bg: z.number().int().min(0),
    size: z.number().int().min(1).max(64).default(16),
  }),
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

export const FeaturedCommunityInputSchema = z.object({
  subredditName: z.string(),
});
export type FeaturedCommunityInput = z.infer<
  typeof FeaturedCommunityInputSchema
>;

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

export const CollectionCreateInputSchema = z.object({
  timeframe: z.enum(['week', 'month', 'all']).default('week'),
  limit: z.number().int().min(1).max(50).default(20),
});
export type CollectionCreateInput = z.infer<typeof CollectionCreateInputSchema>;

export const WordSelectionLogInputSchema = z.object({
  postId: z.string(),
  options: z.array(CandidateWordSchema),
  word: z.string().optional(),
  type: z.enum(['refresh', 'manual', 'auto']),
});
export type WordSelectionLogInput = z.infer<typeof WordSelectionLogInputSchema>;

// Realtime Message Types
export const GuessRealtimeMessageSchema = z.object({
  type: z.literal('guess_submitted'),
  postId: z.string(),
  correct: z.boolean(),
  isFirstSolve: z.boolean().optional(),
  timestamp: z.number().int(),
});
export type GuessRealtimeMessage = z.infer<typeof GuessRealtimeMessageSchema>;
