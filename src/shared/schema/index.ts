import { z } from 'zod';

// Post Data Types (defined first to avoid circular references)
export const PostTypeSchema = z.enum(['drawing', 'pinned']);
export type PostType = z.infer<typeof PostTypeSchema>;

// DrawingPostDataSchema is imported from pixelary.ts
import { DrawingPostDataSchema } from './pixelary';

export const PinnedPostDataSchema = z.object({
  type: z.literal('pinned'),
});
export type PinnedPostData = z.infer<typeof PinnedPostDataSchema>;

export const PostDataSchema = z.discriminatedUnion('type', [
  DrawingPostDataSchema,
  PinnedPostDataSchema,
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
