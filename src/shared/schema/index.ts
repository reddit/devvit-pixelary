import { z } from 'zod';

// Post Data Types (defined first to avoid circular references)
export const PostTypeSchema = z.enum([
  'drawing',
  'pinned',
  'weekly-leaderboard',
]);
export type PostType = z.infer<typeof PostTypeSchema>;

export const DrawingPostDataSchema = z.object({
  type: z.literal('drawing'),
  seed: z.string().optional(),
  mode: z.string().optional(),
  createdAt: z.number().optional(),
  timerSec: z.number().optional(),
  admins: z.array(z.string()).optional(),
});
export type DrawingPostData = z.infer<typeof DrawingPostDataSchema>;

export const PinnedPostDataSchema = z.object({
  type: z.literal('pinned'),
  pinnedAt: z.number(),
  pinnedBy: z.string(),
  message: z.string().optional(),
});
export type PinnedPostData = z.infer<typeof PinnedPostDataSchema>;

export const WeeklyLeaderboardPostDataSchema = z.object({
  type: z.literal('weekly-leaderboard'),
  weekStart: z.number(),
  weekEnd: z.number(),
  topScores: z.array(
    z.object({
      username: z.string(),
      score: z.number().int(),
      rank: z.number().int(),
    })
  ),
});
export type WeeklyLeaderboardPostData = z.infer<
  typeof WeeklyLeaderboardPostDataSchema
>;

export const PostDataSchema = z.discriminatedUnion('type', [
  DrawingPostDataSchema,
  PinnedPostDataSchema,
  WeeklyLeaderboardPostDataSchema,
]);
export type PostData = z.infer<typeof PostDataSchema>;

// Session
export const SessionInitOutputSchema = z.object({
  postId: z.string().nullable(),
  username: z.string().nullable(),
  config: z
    .object({
      seed: z.string().optional(),
      mode: z.string().optional(),
      createdAt: z.number().optional(),
    })
    .nullable(),
  stats: z
    .object({
      plays: z.number().int(),
      completions: z.number().int(),
      activeUsers: z.number().int(),
    })
    .nullable(),
  postType: PostTypeSchema.default('drawing'),
  postData: PostDataSchema.nullable(),
});
export type SessionInitOutput = z.infer<typeof SessionInitOutputSchema>;

// Drawing
export { DrawingDataSchema, DrawingUtils } from './drawing';

// Pixelary-specific types
export * from './pixelary';

export const DrawingGetInputSchema = z
  .object({ username: z.string().optional() })
  .optional();
export type DrawingGetInput = z.infer<typeof DrawingGetInputSchema>;

// Progress / Leaderboard
export const ScoreSubmitInputSchema = z.object({ score: z.number().int() });
export type ScoreSubmitInput = z.infer<typeof ScoreSubmitInputSchema>;

export const LeaderboardTopInputSchema = z.object({
  limit: z.number().int().default(10),
});
export type LeaderboardTopInput = z.infer<typeof LeaderboardTopInputSchema>;

export const LeaderboardEntrySchema = z.object({
  username: z.string(),
  score: z.number().int(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const LeaderboardSchema = z.array(LeaderboardEntrySchema);
export type Leaderboard = z.infer<typeof LeaderboardSchema>;

// Stats and Presence
export const StatsSchema = z.object({
  plays: z.number().int(),
  completions: z.number().int(),
  activeUsers: z.number().int(),
});
export type Stats = z.infer<typeof StatsSchema>;
