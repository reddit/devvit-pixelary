import { initTRPC } from '@trpc/server';
import type { Context } from './context';
import { z } from 'zod';
import type { T3 } from '@devvit/shared-types/tid.js';
import { assertT3 } from '@devvit/shared-types/tid.js';
import {
  getAllWords,
  addWord,
  removeWord,
  getAllBannedWords,
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
        const words = await getAllWords();
        const isInitialized = words.length > 0;

        return {
          initialized: isInitialized,
          wordCount: words.length,
          subreddit: ctx.subredditName,
        };
      }),
    }),

    // Dictionary endpoints
    dictionary: t.router({
      get: t.procedure.query(async ({ ctx }) => {
        if (!ctx.subredditName) throw new Error('Subreddit not found');
        return await getAllWords();
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
        return await getAllBannedWords();
      }),

      getCandidates: t.procedure.query(async ({ ctx }) => {
        console.log('🔍 [DEBUG] getCandidates: Starting endpoint');
        if (!ctx.subredditName) throw new Error('Subreddit not found');
        console.log(
          '🔍 [DEBUG] getCandidates: Subreddit found:',
          ctx.subredditName
        );

        try {
          console.log('🔍 [DEBUG] getCandidates: Calling generateSlate()');
          const result = await generateSlate();
          console.log('🔍 [DEBUG] getCandidates: generateSlate() succeeded:', {
            slateId: result.slateId,
            wordsCount: result.words.length,
            words: result.words,
          });
          return result;
        } catch (error) {
          console.error(
            '🔍 [DEBUG] getCandidates: generateSlate() failed:',
            error
          );
          throw error;
        }
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
        return await getAllWords(ctx.subredditName);
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
            if (!input.word) return { ok: true };
            await handleSlateEvent({
              slateId: input.slateId as SlateId,
              name: 'slate_picked',
              timestamp,
              word: input.word,
              position: (input.metadata?.position as number) ?? 0,
            });
          } else if (input.action === 'slate_posted') {
            if (!input.word || !ctx.postId) return { ok: true };
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
          console.log(`📊 Event: ${input.eventType}`);

          try {
            // Fire-and-forget telemetry tracking with automatic post type detection
            const metadata = 'metadata' in input ? input.metadata : {};
            await trackEventFromContext(
              input.eventType as EventType,
              ctx.postData,
              metadata
            );
          } catch (error) {
            console.warn('Telemetry tracking failed:', error);
            // Silently ignore errors - telemetry should never break the app
          }

          return { ok: true };
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
