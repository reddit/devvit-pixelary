import { initTRPC } from '@trpc/server';
import type { Context } from './context';
import { z } from 'zod';
import type { T3 } from '@devvit/shared-types/tid.js';
import { isT3, assertT3 } from '@devvit/shared-types/tid.js';
import {
  getWords,
  addWord,
  removeWord,
  getBannedWords,
  getAllowedWords,
} from '../services/dictionary';
import { generateSlate, trackSlateAction } from '../services/slate';
import {
  createDrawing,
  submitGuess,
  skipDrawing,
  getDrawing,
  getDrawings,
  getGuesses,
  getUserDrawingsWithData,
} from '../services/drawing';
import {
  getLeaderboard,
  getScore,
  getRank,
  getUserLevel,
} from '../services/progression';
import { isAdmin, isModerator } from '../services/redis';
import { DrawingDataSchema } from '../../shared/schema/pixelary';
import { trackEventFromContext } from '../services/telemetry';
import type { EventType } from '../services/telemetry';

const t = initTRPC.context<Context>().create();

export const appRouter = t.router({
  system: t.router({
    ping: t.procedure.query(() => ({ ok: true }) as const),
  }),

  // Pixelary-specific endpoints
  app: t.router({
    // Dictionary endpoints
    dictionary: t.router({
      get: t.procedure.query(async ({ ctx }) => {
        if (!ctx.subredditName) throw new Error('Subreddit not found');
        return await getWords();
      }),

      add: t.procedure
        .input(z.object({ word: z.string().min(1).max(50) }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.subredditName) throw new Error('Subreddit not found');
          const success = await addWord(ctx.subredditName, input.word);
          if (!success) {
            throw new Error('Failed to add word or word already exists');
          }
          return { success: true };
        }),

      remove: t.procedure
        .input(z.object({ word: z.string().min(1).max(50) }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.subredditName) throw new Error('Subreddit not found');
          const success = await removeWord(input.word);
          if (!success) {
            throw new Error('Failed to remove word or word not found');
          }
          return { success: true };
        }),

      getBanned: t.procedure.query(async ({ ctx }) => {
        if (!ctx.subredditName) throw new Error('Subreddit not found');
        return await getBannedWords(ctx.subredditName);
      }),

      getCandidates: t.procedure.query(async ({ ctx }) => {
        if (!ctx.subredditName) throw new Error('Subreddit not found');
        return await generateSlate(ctx.subredditName, 3);
      }),
    }),

    // Post endpoints
    post: t.router({
      getDrawing: t.procedure
        .input(z.object({ postId: z.string() }))
        .query(async ({ input }) => {
          assertT3(input.postId);
          const postId = input.postId;
          return await getDrawing(postId);
        }),

      getDrawings: t.procedure
        .input(z.object({ postIds: z.array(z.string()) }))
        .query(async ({ input }) => {
          input.postIds.forEach(assertT3);
          const postIds = input.postIds as T3[];
          return await getDrawings(postIds);
        }),

      submitDrawing: t.procedure
        .input(
          z.object({
            word: z.string(),
            dictionary: z.string(),
            drawing: DrawingDataSchema,
          })
        )
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId || !ctx.username) {
            throw new Error('Must be logged in');
          }
          if (!ctx.subredditId) {
            throw new Error('Subreddit not found');
          }

          const post = await createDrawing({
            word: input.word,
            dictionary: input.dictionary,
            drawing: input.drawing,
            authorName: ctx.username,
            authorId: ctx.userId,
          });

          return {
            success: true,
            postId: post.id,
            navigateTo: `https://reddit.com/r/${ctx.subredditName}/comments/${post.id}`,
          };
        }),

      getAllowedWords: t.procedure.query(async ({ ctx }) => {
        if (!ctx.subredditName) throw new Error('Subreddit not found');
        return await getAllowedWords(ctx.subredditName);
      }),

      revealGuess: t.procedure
        .input(
          z.object({
            postId: z.string(),
            guess: z.string(),
          })
        )
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId) throw new Error('Must be logged in');

          // Check if user is admin or moderator
          const userIsAdmin = await isAdmin(ctx.userId);
          const userIsModerator = ctx.subredditName
            ? await isModerator(ctx.userId, ctx.subredditName)
            : false;

          if (!userIsAdmin && !userIsModerator) {
            // Silently ignore the request for non-privileged users
            return { success: false, revealed: false };
          }

          // Return the guess for privileged users
          return {
            success: true,
            revealed: true,
            guess: input.guess,
          };
        }),
    }),

    // Guess endpoints
    guess: t.router({
      submit: t.procedure
        .input(
          z.object({
            postId: z.string(),
            guess: z.string(),
          })
        )
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId) throw new Error('Must be logged in');
          assertT3(input.postId);
          const postId = input.postId;

          const result = await submitGuess({
            postId,
            userId: ctx.userId,
            guess: input.guess,
          });

          return result;
        }),

      getStats: t.procedure
        .input(z.object({ postId: z.string() }))
        .query(async ({ input }) => {
          assertT3(input.postId);
          const postId = input.postId;
          const result = await getGuesses(postId);
          return result;
        }),

      skip: t.procedure
        .input(z.object({ postId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId) throw new Error('Must be logged in to skip post');
          assertT3(input.postId);
          const postId = input.postId;
          await skipDrawing(postId, ctx.userId);
          return { success: true };
        }),
    }),

    // User endpoints
    user: t.router({
      getProfile: t.procedure
        .input(z.object({ postId: z.string() }).optional())
        .query(async ({ ctx }) => {
          if (!ctx.userId) return null;

          const score = await getScore(ctx.userId);
          const [rank, level] = await Promise.all([
            getRank(ctx.userId),
            getUserLevel(score), // Use cached score
          ]);

          return {
            username: ctx.username ?? '',
            userId: ctx.userId,
            score,
            level: level.rank,
            levelName: level.name,
            rank,
            solved: false, // TODO: implement based on postId
            skipped: false, // TODO: implement based on postId
            guessCount: 0, // TODO: implement
          };
        }),

      getDrawings: t.procedure
        .input(
          z.object({ limit: z.number().int().min(1).max(100).default(20) })
        )
        .query(async ({ ctx, input }) => {
          if (!ctx.userId) throw new Error('Must be logged in');
          return await getUserDrawingsWithData(ctx.userId, input.limit);
        }),

      getRank: t.procedure.query(async ({ ctx }) => {
        if (!ctx.userId) throw new Error('Must be logged in');

        const [score, rank] = await Promise.all([
          getScore(ctx.userId),
          getRank(ctx.userId),
        ]);

        return {
          rank,
          score,
          username: ctx.username ?? '',
        };
      }),

      isModerator: t.procedure.query(async ({ ctx }) => {
        if (!ctx.userId || !ctx.subredditName) {
          return false;
        }

        return await isModerator(ctx.userId, ctx.subredditName);
      }),

      isModeratorOrAdmin: t.procedure.query(async ({ ctx }) => {
        if (!ctx.userId) {
          return false;
        }

        // Check if user is admin first
        const userIsAdmin = await isAdmin(ctx.userId);
        if (userIsAdmin) {
          return true;
        }

        // Check if user is moderator
        if (!ctx.subredditName) {
          return false;
        }

        return await isModerator(ctx.userId, ctx.subredditName);
      }),
    }),

    // Leaderboard endpoints
    leaderboard: t.router({
      getTop: t.procedure
        .input(
          z.object({
            limit: z.number().int().min(1).max(100).default(10),
            cursor: z.number().int().default(0),
          })
        )
        .query(async ({ input }) => {
          const result = await getLeaderboard({
            limit: input.limit,
            cursor: input.cursor,
          });
          return result.entries;
        }),

      getUserRank: t.procedure.query(async ({ ctx }) => {
        if (!ctx.userId) {
          return { rank: -1, score: 0, username: '', userId: '' };
        }
        const [userRank, score] = await Promise.all([
          getRank(ctx.userId),
          getScore(ctx.userId),
        ]);
        return {
          rank: userRank,
          score,
          username: ctx.username ?? '',
          userId: ctx.userId,
        };
      }),
    }),

    // Slate endpoints
    slate: t.router({
      trackAction: t.procedure
        .input(
          z.object({
            slateId: z.string(),
            action: z.enum(['impression', 'click', 'publish', 'start']),
            word: z.string().optional(),
          })
        )
        .mutation(async ({ ctx, input }) => {
          if (!ctx.subredditName) {
            throw new Error('Subreddit not found');
          }

          trackSlateAction(
            ctx.subredditName,
            input.slateId,
            input.action,
            input.word,
            ctx.postId || undefined
          ).catch((error) => {
            console.error('Slate tracking error:', error);
            // Silently ignore errors - telemetry should never break the app
          });

          return { ok: true };
        }),
    }),

    // Telemetry endpoints
    telemetry: t.router({
      track: t.procedure
        .input(
          z.union([
            z.object({
              eventType: z.string(),
              metadata: z.record(z.union([z.string(), z.number()])),
            }),
            z.object({
              eventType: z.string(),
            }),
          ])
        )
        .mutation(async ({ ctx, input }) => {
          console.log('🔍 tRPC telemetry.track called:', {
            eventType: input.eventType,
            metadata: 'metadata' in input ? input.metadata : undefined,
            metadataType:
              'metadata' in input ? typeof input.metadata : 'undefined',
            postData: ctx.postData,
            postDataType: typeof ctx.postData,
          });

          try {
            // Fire-and-forget telemetry tracking with automatic post type detection
            const metadata = 'metadata' in input ? input.metadata : {};
            await trackEventFromContext(
              input.eventType as EventType,
              ctx.postData,
              metadata
            );
            console.log('🔍 tRPC telemetry.track success');
          } catch (error) {
            console.warn('🔍 tRPC telemetry.track error:', error);
            console.warn('🔍 tRPC telemetry.track error details:', {
              errorMessage:
                error instanceof Error ? error.message : String(error),
              errorStack: error instanceof Error ? error.stack : undefined,
              input,
              ctx: { postData: ctx.postData },
            });
            // Silently ignore errors - telemetry should never break the app
          }

          return { ok: true };
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
