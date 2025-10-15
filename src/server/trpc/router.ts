import { initTRPC } from '@trpc/server';
import type { Context } from './context';
import { z } from 'zod';
import {
  getConfig,
  getDrawing,
  getStats,
  saveDrawing,
  submitScore,
  clearDrawing,
  isRateLimited,
  redis,
} from '../services/redis';
import { WORDS } from '../../shared/words';
import {
  addHistoryEntry,
  clearCurrentGame,
  getCurrentGame,
  getHistory,
  incrementCompletions,
  setCurrentGame,
} from '../services/redis';
import { cacheConfig } from '../services/redis';
import { reddit } from '@devvit/web/server';
import { PostTypeSchema } from '../../shared/schema';
// Pixelary service imports
import {
  getDictionary,
  addWordToDictionary,
  removeWordFromDictionary,
  getBannedWords,
  getWordCandidatesForSubreddit,
  getFeaturedCommunity,
  setFeaturedCommunity,
  getReportedWords,
  getWordMetadata,
  clearWordReports,
  addBannedWord,
  removeBannedWord,
} from '../services/dictionary';
import { getLeaderboard, getUserRank } from '../services/leaderboard';
import { getUserProfile, getUserDrawings } from '../services/user';
import {
  getDrawingPost,
  getDrawingPosts,
  submitDrawing,
  getCollectionPost,
  updateDrawingPostPreview,
} from '../services/drawing-post';
import { submitGuess, getGuessStats } from '../services/guess';
import { createWeeklyCollection } from '../services/collection-post';
import { skipPost } from '../services/drawing-post';
import { createDrawingPost } from '../core/post';

const t = initTRPC.context<Context>().create();

export const appRouter = t.router({
  system: t.router({
    ping: t.procedure.query(() => ({ ok: true }) as const),
  }),
  session: t.router({
    init: t.procedure.query(async ({ ctx }) => {
      return {
        postId: ctx.postId,
        username: ctx.username ?? null,
        userId: ctx.userId ?? null,
        config: (await getConfig(ctx.postId ?? null)) ?? { timerSec: 60 },
        stats: await getStats(ctx.postId),
      };
    }),
  }),
  config: t.router({
    update: t.procedure
      .input(
        z.object({
          mode: z.string().optional(),
          timerSec: z.number().int().min(10).max(600).optional(),
          admins: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Moderator gate: allow moderators or listed admins
        const username = (ctx as Context).username;
        const currentConfig =
          (await getConfig((ctx as Context).postId ?? null)) ?? {};
        const admins = (currentConfig as { admins?: string[] }).admins;
        if (admins && username && !admins.includes(username)) {
          return { ok: false as const, error: 'forbidden' as const };
        }
        const current =
          (await getConfig((ctx as Context).postId ?? null)) ?? {};
        const next = { ...current, ...input } as {
          seed?: string;
          mode?: string;
          createdAt?: number;
          timerSec?: number;
          admins?: string[];
        };
        const postId = (ctx as Context).postId;
        if (postId) {
          const post = await reddit.getPostById(postId);
          await post.setPostData({
            seed: next.seed ?? '',
            mode: next.mode ?? 'single-player',
            createdAt: next.createdAt ?? Date.now(),
            timerSec: next.timerSec ?? 60,
            admins: Array.isArray(next.admins) ? next.admins : [],
          });
        }
        await cacheConfig((ctx as Context).postId ?? null, next);
        return { ok: true as const, config: next };
      }),
  }),
  drawing: t.router({
    upsert: t.procedure
      .input(
        z.object({
          rev: z.number().int().nonnegative(),
          delta: z.unknown().optional(),
        })
      )
      .mutation(async ({ ctx, input }) =>
        (await isRateLimited(ctx as Context, 'drawing', 20, 10))
          ? { ok: false as const, error: 'rate_limited' as const }
          : saveDrawing(
              ctx as Context,
              input as { rev: number; delta?: unknown }
            )
      ),
    get: t.procedure
      .input(z.object({ username: z.string().optional() }).optional())
      .query(async ({ ctx, input }) =>
        getDrawing(
          ctx as Context,
          (input as { username?: string } | undefined)?.username ??
            (ctx as Context).username
        )
      ),
    clear: t.procedure.mutation(async ({ ctx }) =>
      clearDrawing(ctx as Context)
    ),
  }),
  progress: t.router({
    submit: t.procedure
      .input(z.object({ score: z.number().int() }))
      .mutation(async ({ ctx, input }) =>
        submitScore(ctx as Context, (input as { score: number }).score)
      ),
  }),
  stats: t.router({
    get: t.procedure.query(async ({ ctx }) =>
      getStats((ctx as Context).postId)
    ),
  }),
  game: t.router({
    start: t.procedure
      .input(
        z
          .object({
            durationSec: z.number().int().min(10).max(600).default(60),
          })
          .optional()
      )
      .mutation(async ({ ctx, input }) => {
        const idx = Math.floor(Math.random() * WORDS.length);
        const word = WORDS[idx] ?? 'tree';
        const now = Math.floor(Date.now() / 1000);
        const endsAt = now + (input?.durationSec ?? 60);
        await setCurrentGame(ctx as Context, {
          prompt: word,
          endsAt,
          startedAt: now,
        });
        const config = await getConfig((ctx as Context).postId ?? null);
        return { prompt: word, endsAt, config } as const;
      }),
    status: t.procedure.query(async ({ ctx }) => {
      const state = await getCurrentGame(ctx as Context);
      return state
        ? { active: true as const, ...state }
        : { active: false as const };
    }),
    finish: t.procedure
      .input(z.object({ score: z.number().int().min(0).max(10000) }))
      .mutation(async ({ ctx, input }) => {
        if (await isRateLimited(ctx as Context, 'finish', 10, 60)) {
          return { ok: false as const, error: 'rate_limited' as const };
        }
        await submitScore(ctx as Context, input.score);
        await incrementCompletions((ctx as Context).postId);
        const state = await getCurrentGame(ctx as Context);
        await clearCurrentGame(ctx as Context);
        if (state) {
          await addHistoryEntry(ctx as Context, {
            prompt: state.prompt,
            score: input.score,
            finishedAt: Math.floor(Date.now() / 1000),
          });
        }
        return { ok: true as const };
      }),
  }),
  history: t.router({
    get: t.procedure
      .input(z.object({ limit: z.number().int().default(10) }))
      .query(async ({ ctx, input }) => getHistory(ctx as Context, input.limit)),
  }),
  // Pixelary-specific endpoints
  app: t.router({
    // Dictionary endpoints
    dictionary: t.router({
      get: t.procedure.query(async ({ ctx }) => {
        if (!ctx.subredditName) {
          throw new Error('Subreddit not found');
        }
        const dictionary = await getDictionary(ctx.subredditName);
        return dictionary;
      }),

      add: t.procedure
        .input(z.object({ word: z.string().min(1).max(50) }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.subredditName) {
            throw new Error('Subreddit not found');
          }
          const success = await addWordToDictionary(
            ctx.subredditName,
            input.word
          );
          if (!success) {
            throw new Error('Failed to add word or word already exists');
          }
          return { success: true };
        }),

      remove: t.procedure
        .input(z.object({ word: z.string().min(1).max(50) }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.subredditName) {
            throw new Error('Subreddit not found');
          }
          const success = await removeWordFromDictionary(
            ctx.subredditName,
            input.word
          );
          if (!success) {
            throw new Error('Failed to remove word or word not found');
          }
          return { success: true };
        }),

      getCandidates: t.procedure.query(async ({ ctx }) => {
        if (!ctx.subredditName) {
          throw new Error('Subreddit not found');
        }
        return await getWordCandidatesForSubreddit(ctx.subredditName);
      }),

      getReportedWords: t.procedure
        .input(
          z.object({ limit: z.number().int().min(1).max(100).default(50) })
        )
        .query(async ({ ctx, input }) => {
          if (!ctx.subredditName) {
            throw new Error('Subreddit not found');
          }
          return await getReportedWords(ctx.subredditName, input.limit);
        }),

      getWordMetadata: t.procedure
        .input(z.object({ word: z.string().min(1).max(50) }))
        .query(async ({ ctx, input }) => {
          if (!ctx.subredditName) {
            throw new Error('Subreddit not found');
          }
          return await getWordMetadata(ctx.subredditName, input.word);
        }),

      clearReports: t.procedure
        .input(z.object({ word: z.string().min(1).max(50) }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.subredditName) {
            throw new Error('Subreddit not found');
          }
          const success = await clearWordReports(ctx.subredditName, input.word);
          if (!success) {
            throw new Error('Failed to clear reports');
          }
          return { success: true };
        }),

      denyWord: t.procedure
        .input(z.object({ word: z.string().min(1).max(50) }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.subredditName) {
            throw new Error('Subreddit not found');
          }
          const success = await addBannedWord(ctx.subredditName, input.word);
          if (!success) {
            throw new Error('Failed to deny word or word already banned');
          }
          return { success: true };
        }),

      approveWord: t.procedure
        .input(z.object({ word: z.string().min(1).max(50) }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.subredditName) {
            throw new Error('Subreddit not found');
          }
          const success = await removeBannedWord(ctx.subredditName, input.word);
          if (!success) {
            throw new Error('Failed to approve word or word not banned');
          }
          return { success: true };
        }),

      getBanned: t.procedure.query(async ({ ctx }) => {
        if (!ctx.subredditName) {
          throw new Error('Subreddit not found');
        }
        return await getBannedWords(ctx.subredditName);
      }),

      featured: t.router({
        get: t.procedure.query(async () => {
          return await getFeaturedCommunity();
        }),

        set: t.procedure
          .input(z.object({ subredditName: z.string() }))
          .mutation(async ({ ctx, input }) => {
            // Only allow r/Pixelary moderators to set featured community
            if (ctx.subredditName !== 'Pixelary') {
              throw new Error(
                'Only r/Pixelary moderators can set featured community'
              );
            }
            const success = await setFeaturedCommunity(input.subredditName);
            if (!success) {
              throw new Error('Failed to set featured community');
            }
            return { success: true };
          }),
      }),
    }),

    // Post endpoints
    post: t.router({
      getDrawing: t.procedure
        .input(z.object({ postId: z.string() }))
        .query(async ({ input }) => {
          return await getDrawingPost(input.postId);
        }),

      getDrawings: t.procedure
        .input(z.object({ postIds: z.array(z.string()) }))
        .query(async ({ input }) => {
          return await getDrawingPosts(input.postIds);
        }),

      submitDrawing: t.procedure
        .input(
          z.object({
            word: z.string(),
            dictionaryName: z.string(),
            data: z.object({
              data: z.string(),
              colors: z.array(z.string()),
              bg: z.number().int().min(0),
              size: z.number().int().min(1).max(64),
            }),
          })
        )
        .mutation(async ({ ctx, input }) => {
          if (!ctx.username) {
            throw new Error('Must be logged in to submit drawing');
          }
          if (!ctx.subredditName) {
            throw new Error('Subreddit not found');
          }

          try {
            // Use the createDrawingPost function that has proper authentication context
            const post = await createDrawingPost(
              input.word,
              input.dictionaryName,
              input.data,
              {
                subredditName: ctx.subredditName,
                username: ctx.username,
                userId: ctx.userId,
                reddit: ctx.reddit,
                scheduler: ctx.scheduler,
              }
            );

            return {
              success: true,
              postId: post.id,
              navigateTo: `https://reddit.com/r/${ctx.subredditName}/comments/${post.id}`,
            };
          } catch (error) {
            console.error('Error in submitDrawing mutation:', error);
            throw new Error(
              `Failed to submit drawing: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }),

      getCollection: t.procedure
        .input(z.object({ postId: z.string() }))
        .query(async ({ input }) => {
          return await getCollectionPost(input.postId);
        }),

      createCollection: t.procedure
        .input(
          z.object({
            timeframe: z.enum(['week', 'month', 'all']).default('week'),
            limit: z.number().int().min(1).max(50).default(20),
          })
        )
        .mutation(async ({ ctx, input }) => {
          if (!ctx.subredditName) {
            throw new Error('Subreddit not found');
          }

          const result = await createWeeklyCollection(
            ctx.subredditName,
            input.timeframe,
            input.limit,
            ctx as unknown
          );

          if (!result.success) {
            throw new Error('Failed to create collection');
          }

          return result;
        }),

      updatePreview: t.procedure
        .input(
          z.object({
            postId: z.string(),
            drawing: z.object({
              data: z.string(),
              colors: z.array(z.string()),
              bg: z.number().int(),
              size: z.number().int(),
            }),
            playerCount: z.number().int(),
            dictionaryName: z.string(),
          })
        )
        .mutation(async ({ input }) => {
          const success = await updateDrawingPostPreview(
            input.postId,
            input.drawing as {
              data: string;
              colors: string[];
              bg: number;
              size: number;
            },
            input.playerCount,
            input.dictionaryName
          );

          if (!success) {
            throw new Error('Failed to update preview');
          }

          return { success: true };
        }),
    }),

    // Guess endpoints
    guess: t.router({
      submit: t.procedure
        .input(
          z.object({
            postId: z.string(),
            guess: z.string(),
            createComment: z.boolean().default(false),
          })
        )
        .mutation(async ({ ctx, input }) => {
          if (!ctx.username) {
            throw new Error('Must be logged in to submit guess');
          }

          return await submitGuess(
            input.postId,
            ctx.username,
            input.guess,
            input.createComment,
            ctx as unknown
          );
        }),

      getStats: t.procedure
        .input(z.object({ postId: z.string() }))
        .query(async ({ ctx, input }) => {
          return await getGuessStats(input.postId, ctx as unknown);
        }),

      skip: t.procedure
        .input(z.object({ postId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.username) {
            throw new Error('Must be logged in to skip post');
          }

          const success = await skipPost(input.postId, ctx.username);
          if (!success) {
            throw new Error('Failed to skip post');
          }

          return { success: true };
        }),
    }),

    // User endpoints
    user: t.router({
      getProfile: t.procedure
        .input(z.object({ postId: z.string() }).optional())
        .query(async ({ ctx, input }) => {
          if (!ctx.userId) {
            return null;
          }
          return await getUserProfile(ctx.userId, input?.postId);
        }),

      getDrawings: t.procedure
        .input(
          z.object({ limit: z.number().int().min(1).max(100).default(20) })
        )
        .query(async ({ ctx, input }) => {
          if (!ctx.userId) {
            return [];
          }
          return await getUserDrawings(ctx.userId, input.limit);
        }),

      getRank: t.procedure.query(async ({ ctx }) => {
        if (!ctx.userId) {
          return { rank: -1, score: 0, username: '', userId: '' };
        }
        const userRank = await getUserRank(ctx.userId);
        return {
          rank: userRank,
          score: 0, // You may need to get this from another source
          username: ctx.username ?? '',
          userId: ctx.userId,
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
          await redis.set(cacheKey, isModerator.toString(), { ex: 300 });

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
          z.object({ limit: z.number().int().min(1).max(100).default(10) })
        )
        .query(async ({ input }) => {
          return await getLeaderboard(input.limit);
        }),

      getUserRank: t.procedure.query(async ({ ctx }) => {
        if (!ctx.userId) {
          return { rank: -1, score: 0, username: '', userId: '' };
        }
        const userRank = await getUserRank(ctx.userId);
        return {
          rank: userRank,
          score: 0, // You may need to get this from another source
          username: ctx.username ?? '',
          userId: ctx.userId,
        };
      }),
    }),

    // Metrics endpoints
    metrics: t.router({
      logWordSelection: t.procedure
        .input(
          z.object({
            postId: z.string(),
            options: z.array(
              z.object({
                word: z.string(),
                dictionaryName: z.string(),
              })
            ),
            word: z.string().optional(),
            type: z.enum(['refresh', 'manual', 'auto']),
          })
        )
        .mutation(async ({ input }) => {
          // This would log word selection events for analytics
          console.log('Word selection event:', input);
          return { success: true };
        }),

      getRecentSelections: t.procedure
        .input(
          z.object({ limit: z.number().int().min(1).max(100).default(10) })
        )
        .query(async () => {
          // This would return recent word selection events
          return [];
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
