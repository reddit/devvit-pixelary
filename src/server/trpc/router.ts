import { initTRPC } from '@trpc/server';
import type { Context } from './context';
import { z } from 'zod';
import { parseT3 } from '../../shared/types/TID';
import {
  getWords,
  addWord,
  removeWord,
  getBannedWords,
} from '../services/dictionary';
import {
  createDrawing,
  submitGuess,
  skipDrawing,
  getDrawing,
  getDrawings,
  getGuesses,
} from '../services/drawing';
import {
  getLeaderboard,
  getScore,
  getRank,
  getUserLevel,
} from '../services/progression';
import { DrawingDataSchema } from '../../shared/schema/pixelary';
import { reddit, redis } from '@devvit/web/server';

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
        if (!ctx.subredditId) throw new Error('Subreddit not found');
        return await getWords(ctx.subredditId);
      }),

      add: t.procedure
        .input(z.object({ word: z.string().min(1).max(50) }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.subredditId) throw new Error('Subreddit not found');
          const success = await addWord(ctx.subredditId, input.word);
          if (!success) {
            throw new Error('Failed to add word or word already exists');
          }
          return { success: true };
        }),

      remove: t.procedure
        .input(z.object({ word: z.string().min(1).max(50) }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.subredditId) throw new Error('Subreddit not found');
          const success = await removeWord(ctx.subredditId, input.word);
          if (!success) {
            throw new Error('Failed to remove word or word not found');
          }
          return { success: true };
        }),

      getBanned: t.procedure.query(async ({ ctx }) => {
        if (!ctx.subredditId) throw new Error('Subreddit not found');
        return await getBannedWords(ctx.subredditId);
      }),
    }),

    // Post endpoints
    post: t.router({
      getDrawing: t.procedure
        .input(z.object({ postId: z.string() }))
        .query(async ({ input }) => {
          const postId = parseT3(input.postId);
          return await getDrawing(postId);
        }),

      getDrawings: t.procedure
        .input(z.object({ postIds: z.array(z.string()) }))
        .query(async ({ input }) => {
          const postIds = input.postIds.map((id) => parseT3(id));
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
          if (!ctx.userId || !ctx.username)
            throw new Error('Must be logged in');
          if (!ctx.subredditId) throw new Error('Subreddit not found');

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
          const postId = parseT3(input.postId);

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
          const postId = parseT3(input.postId);
          return await getGuesses(postId);
        }),

      skip: t.procedure
        .input(z.object({ postId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId) throw new Error('Must be logged in to skip post');
          const postId = parseT3(input.postId);
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

          const [score, rank, level] = await Promise.all([
            getScore(ctx.userId),
            getRank(ctx.userId),
            getUserLevel(await getScore(ctx.userId)),
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

      isModerator: t.procedure.query(async ({ ctx }) => {
        if (!ctx.username || !ctx.subredditName) {
          return false;
        }

        const cacheKey = `mod:${ctx.username}:${ctx.subredditName}`;

        // Check cache first
        const cached = await redis.get(cacheKey);
        if (cached !== null) {
          return cached === 'true';
        }

        // Check with Reddit API
        try {
          const moderators = await reddit.getModerators({
            subredditName: ctx.subredditName,
          });
          const moderatorList = await moderators.all();
          const isModerator = moderatorList.some(
            (mod: { username: string }) => mod.username === ctx.username
          );

          // Cache result for 5 minutes
          await redis.set(cacheKey, isModerator.toString());
          await redis.expire(cacheKey, 300);

          return isModerator;
        } catch (error) {
          console.error('Failed to check moderator permission:', error);
          return false;
        }
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
          return await getLeaderboard({
            limit: input.limit,
            cursor: input.cursor,
          });
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
  }),
});

export type AppRouter = typeof appRouter;
