import { initTRPC } from '@trpc/server';
import type { Context } from './context';
import { z } from 'zod';
import type { T3 } from '@devvit/shared-types/tid.js';
import { assertT3 } from '@devvit/shared-types/tid.js';
import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from '../services/redis';
import {
  getWords,
  addWord,
  removeWord,
  getBannedWords,
} from '../services/dictionary';
import {
  generateSlate,
  handleSlateEvent,
  getCurrentTimestamp,
  type SlateId,
} from '../services/slate';
import {
  createDrawing,
  submitGuess,
  skipDrawing,
  getDrawing,
  getDrawings,
  getGuesses,
  getUserDrawingsWithData,
  getUserDrawingStatus,
  isAuthorFirstView,
} from '../services/drawing';
import {
  getLeaderboard,
  getScore,
  getRank,
  getUserLevel,
  getLevelProgressPercentage,
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
    // System endpoints
    system: t.router({
      initialize: t.procedure.mutation(async ({ ctx }) => {
        if (!ctx.subredditName) throw new Error('Subreddit not found');

        // Import initialization functions
        const { initDictionary } = await import('../services/dictionary');
        const { initFlairTemplates } = await import('../core/flair');
        const { initSlateBandit } = await import('../services/slate');

        // Run initialization
        await initDictionary();
        await initFlairTemplates();
        await initSlateBandit();

        return { success: true, message: 'Pixelary initialized successfully' };
      }),

      status: t.procedure.query(async ({ ctx }) => {
        if (!ctx.subredditName) throw new Error('Subreddit not found');

        // Check if dictionary is initialized
        const wordsResult = await getWords(ctx.subredditName, 0, 1);
        const isInitialized = wordsResult.total > 0;

        return {
          initialized: isInitialized,
          wordCount: wordsResult.total,
          subreddit: ctx.subredditName,
        };
      }),
    }),

    // Dictionary endpoints
    dictionary: t.router({
      get: t.procedure.query(async ({ ctx }) => {
        if (!ctx.subredditName) throw new Error('Subreddit not found');
        const result = await getWords(ctx.subredditName, 0, 10000);
        return result.words;
      }),

      add: t.procedure
        .input(z.object({ word: z.string().min(1).max(50) }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.subredditName) throw new Error('Subreddit not found');
          const success = await addWord(input.word);
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
        const result = await getBannedWords(0, 10000);
        return result.words;
      }),

      getCandidates: t.procedure.query(async ({ ctx }) => {
        if (!ctx.subredditName) throw new Error('Subreddit not found');

        const result = await generateSlate();
        return result;
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
            imageData: z.string().optional(),
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
            ...(input.imageData && { imageData: input.imageData }),
          });

          return {
            success: true,
            postId: post.id,
            navigateTo: `https://reddit.com/r/${ctx.subredditName}/comments/${post.id}`,
          };
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

          // Get all guesses for this post to find the original word
          const { obfuscateString } = await import('../../shared/utils/string');

          // Get the raw guesses (before obfuscation)
          const rawGuesses = await redis.zRange(
            REDIS_KEYS.drawingGuesses(input.postId as T3),
            0,
            -1,
            { reverse: true, by: 'rank' }
          );

          // Find the original word that matches the obfuscated input
          let originalWord = input.guess;
          for (const guess of rawGuesses) {
            if (obfuscateString(guess.member) === input.guess) {
              originalWord = guess.member;
              break;
            }
          }

          // Return the original word for privileged users
          return {
            success: true,
            revealed: true,
            guess: originalWord,
          };
        }),

      isAuthorFirstView: t.procedure
        .input(z.object({ postId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId) {
            throw new Error('Must be logged in');
          }

          assertT3(input.postId);
          const firstView = await isAuthorFirstView(input.postId as T3);

          return { firstView };
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
        .query(async ({ ctx, input }) => {
          if (!ctx.userId) return null;

          const score = await getScore(ctx.userId);
          const [rank, level] = await Promise.all([
            getRank(ctx.userId),
            getUserLevel(score), // Use cached score
          ]);

          // Get drawing-specific status if postId is provided
          let drawingStatus = { solved: false, skipped: false, guessCount: 0 };
          if (input?.postId) {
            try {
              assertT3(input.postId);
              drawingStatus = await getUserDrawingStatus(
                input.postId,
                ctx.userId
              );
            } catch (error) {
              // If post doesn't exist or other error, use defaults
              console.warn('Failed to get drawing status:', error);
            }
          }

          return {
            username: ctx.username ?? '',
            userId: ctx.userId,
            score,
            level: level.rank,
            levelName: level.name,
            levelProgressPercentage: getLevelProgressPercentage(score),
            rank,
            solved: drawingStatus.solved,
            skipped: drawingStatus.skipped,
            guessCount: drawingStatus.guessCount,
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
            action: z.enum([
              'slate_served',
              'slate_picked',
              'slate_posted',
            ] as const),
            word: z.string().optional(),
            metadata: z.record(z.union([z.string(), z.number()])).optional(),
          })
        )
        .mutation(async ({ ctx, input }) => {
          if (!ctx.subredditName) {
            throw new Error('Subreddit not found');
          }

          // Map action names to slate event types
          const timestamp = getCurrentTimestamp();

          if (input.action === 'slate_served') {
            await handleSlateEvent({
              slateId: input.slateId as SlateId,
              name: 'slate_served',
              timestamp,
            });
          } else if (input.action === 'slate_picked') {
            if (!input.word) {
              return { ok: true };
            }
            await handleSlateEvent({
              slateId: input.slateId as SlateId,
              name: 'slate_picked',
              timestamp,
              word: input.word,
              position: (input.metadata?.position as number) ?? 0,
            });
          } else if (input.action === 'slate_posted') {
            if (!input.word || !ctx.postId) {
              return { ok: true };
            }
            await handleSlateEvent({
              slateId: input.slateId as SlateId,
              name: 'slate_posted',
              word: input.word,
              postId: ctx.postId,
            });
          }
          // All other events should be handled by telemetry.ts instead

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
          try {
            // Fire-and-forget telemetry tracking with automatic post type detection
            const metadata = 'metadata' in input ? input.metadata : {};
            await trackEventFromContext(
              input.eventType as EventType,
              ctx.postData,
              metadata
            );
          } catch (error) {
            // Silently ignore errors - telemetry should never break the app
          }

          return { ok: true };
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
