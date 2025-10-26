import { z } from 'zod';

// Post Data Types (defined first to avoid circular references)
export const PostTypeSchema = z.enum(['drawing', 'pinned', 'collection']);
export type PostType = z.infer<typeof PostTypeSchema>;

// DrawingPostDataSchema is imported from pixelary.ts
import { DrawingPostDataSchema } from './pixelary';

export const PinnedPostDataSchema = z.object({
  type: z.literal('pinned'),
});
export type PinnedPostData = z.infer<typeof PinnedPostDataSchema>;

export const CollectionPostDataSchema = z.object({
  type: z.literal('collection'),
  collectionId: z.string(),
  label: z.string(),
});
export type CollectionPostData = z.infer<typeof CollectionPostDataSchema>;

export const PostDataSchema = z.discriminatedUnion('type', [
  DrawingPostDataSchema,
  PinnedPostDataSchema,
  CollectionPostDataSchema,
]);
export type PostData = z.infer<typeof PostDataSchema>;

// Drawing
export { DrawingDataSchema, DrawingUtils } from './drawing';

// Pixelary-specific types
export * from './pixelary';

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

// Collection form input schemas
export const CollectionFormInputSchema = z.object({
  postTitle: z.string().min(1).max(300),
  label: z.string().min(1).max(1000),
  numberOfDays: z.number().int().min(1).max(365),
  numberOfDrawings: z.coerce
    .number()
    .int()
    .refine((val) => val === 3 || val === 6 || val === 9, {
      message: 'Number of drawings must be 3, 6, or 9',
    }),
});
export type CollectionFormInput = z.infer<typeof CollectionFormInputSchema>;
