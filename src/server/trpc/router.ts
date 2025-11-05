import { initTRPC } from '@trpc/server';
import type { Context } from './context';

import type { T3, T1 } from '@devvit/shared-types/tid.js';
import { assertT3 } from '@devvit/shared-types/tid.js';
import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from '@server/core/redis';
import {
  getWords,
  addWord,
  removeWord,
  getBannedWords,
} from '@server/services/words/dictionary';
import {
  generateSlate,
  handleSlateEvent,
  getCurrentTimestamp,
  type SlateId,
} from '@server/services/words/slate';
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
} from '@server/services/posts/drawing';
import {
  getLeaderboard,
  getScore,
  getRank,
  getUserLevel,
  getLevelProgressPercentage,
  getUnclaimedLevelUp,
  claimLevelUp,
} from '@server/services/progression';
import { isAdmin, isModerator } from '@server/core/redis';
import { DrawingDataSchema } from '@shared/schema/pixelary';
import type { DrawingData } from '@shared/schema/drawing';
import { trackEventFromContext } from '@server/services/telemetry';
import type { TelemetryEventType } from '@shared/types';
import { z, ZodError } from 'zod';

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === 'BAD_REQUEST' && error.cause instanceof ZodError
            ? z.treeifyError(error.cause)
            : null,
      },
    };
  },
});

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
        const { initDictionary } = await import(
          '@server/services/words/dictionary'
        );
        const { initFlairTemplates } = await import('@server/core/flair');
        const { initSlateBandit } = await import(
          '@server/services/words/slate'
        );

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

      getCollection: t.procedure
        .input(z.object({ collectionId: z.string() }))
        .query(async ({ input }) => {
          const { getCollectionData } = await import(
            '../services/posts/collection'
          );
          return await getCollectionData(input.collectionId);
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
          const firstView = await isAuthorFirstView(input.postId);

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

      getLevel: t.procedure.query(async ({ ctx }) => {
        if (!ctx.userId) return { level: 1 };
        const score = await getScore(ctx.userId);
        const level = getUserLevel(score);
        return { level: level.rank };
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

      getUnclaimedLevelUp: t.procedure.query(async ({ ctx }) => {
        if (!ctx.userId) return null;
        return await getUnclaimedLevelUp(ctx.userId);
      }),

      claimLevelUp: t.procedure
        .input(z.object({ level: z.number().int() }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId) throw new Error('Must be logged in');
          await claimLevelUp(ctx.userId, input.level);
          return { success: true };
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
          // In webview/local contexts, subredditName may be unavailable.
          // Treat tracking as a no-op instead of throwing to avoid noisy errors.
          if (!ctx.subredditName) {
            return { ok: true } as const;
          }

          // Map action names to slate event types
          const timestamp = getCurrentTimestamp();

          switch (input.action) {
            case 'slate_served':
              await handleSlateEvent({
                slateId: input.slateId as SlateId,
                name: 'slate_served',
                timestamp,
              });
              break;
            case 'slate_picked':
              if (!input.word) {
                return { ok: true };
              }
              await handleSlateEvent({
                slateId: input.slateId as SlateId,
                name: 'slate_picked',
                timestamp,
                word: input.word,
                position:
                  typeof input.metadata?.position === 'number'
                    ? input.metadata.position
                    : 0,
              });
              break;
            case 'slate_posted':
              if (!input.word || !ctx.postId) {
                return { ok: true };
              }
              await handleSlateEvent({
                slateId: input.slateId as SlateId,
                name: 'slate_posted',
                word: input.word,
                postId: ctx.postId,
              });
              break;
            default:
              break;
          }
          // All other events should be handled by telemetry.ts instead

          return { ok: true } as const;
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
              input.eventType as TelemetryEventType,
              ctx.postData,
              metadata
            );
          } catch (error) {
            // Silently ignore errors - telemetry should never break the app
          }

          return { ok: true };
        }),
    }),

    // Rewards endpoints
    rewards: t.router({
      getInventory: t.procedure.query(async ({ ctx }) => {
        if (!ctx.userId) throw new Error('Must be logged in');
        const { getInventory } = await import(
          '../services/rewards/consumables'
        );
        return await getInventory(ctx.userId);
      }),

      getActiveEffects: t.procedure.query(async ({ ctx }) => {
        if (!ctx.userId) throw new Error('Must be logged in');
        const { getActiveEffects } = await import(
          '../services/rewards/consumables'
        );
        return await getActiveEffects(ctx.userId);
      }),

      activateConsumable: t.procedure
        .input(
          z.object({
            itemId: z.union([
              z.literal('score_multiplier_2x_4h'),
              z.literal('score_multiplier_3x_30m'),
              z.literal('draw_time_boost_30s_2h'),
            ]),
          })
        )
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId) throw new Error('Must be logged in');
          const { activateConsumable } = await import(
            '../services/rewards/consumables'
          );
          const result = await activateConsumable(ctx.userId, input.itemId);
          if (!result) {
            return { success: false } as const;
          }
          return { success: true, ...result } as const;
        }),

      getEffectiveBonuses: t.procedure.query(async ({ ctx }) => {
        if (!ctx.userId) throw new Error('Must be logged in');
        const { getEffectiveBonuses } = await import('../services/rewards');
        return await getEffectiveBonuses(ctx.userId);
      }),

      dispenseItems: t.procedure
        .input(
          z.object({
            username: z.string(),
            items: z.array(
              z.object({
                itemId: z.union([
                  z.literal('score_multiplier_2x_4h'),
                  z.literal('score_multiplier_3x_30m'),
                  z.literal('draw_time_boost_30s_2h'),
                ]),
                quantity: z.number().int().min(1),
              })
            ),
          })
        )
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId) throw new Error('Must be logged in');
          const { isAdmin, isModerator } = await import('../core/redis');
          const userIsAdmin = await isAdmin(ctx.userId);
          const userIsModerator = ctx.subredditName
            ? await isModerator(ctx.userId, ctx.subredditName)
            : false;
          if (!userIsAdmin && !userIsModerator) {
            throw new Error('Not authorized');
          }
          const { reddit } = await import('@devvit/web/server');
          const user = await reddit.getUserByUsername(input.username);
          if (!user) throw new Error('User not found');
          const { grantItems } = await import(
            '../services/rewards/consumables'
          );
          await grantItems(user.id as never, input.items as never);
          return { success: true } as const;
        }),
    }),

    // Tournament endpoints
    tournament: t.router({
      getTournament: t.procedure.query(async ({ ctx }) => {
        if (!ctx.subredditName) throw new Error('Subreddit not found');

        // Get tournament info from current post context
        if (!ctx.postId || ctx.postData?.type !== 'tournament') {
          throw new Error('Not on a tournament post');
        }

        const tournamentPostData = ctx.postData as {
          type: 'tournament';
          word: string;
          dictionary: string;
        };

        return {
          word: tournamentPostData.word,
          postId: ctx.postId,
        };
      }),

      submitDrawing: t.procedure
        .input(
          z.object({
            postId: z.string(),
            drawing: DrawingDataSchema,
            imageData: z.string(),
          })
        )
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId) throw new Error('Must be logged in');

          const { submitTournamentEntry } = await import(
            '../services/posts/tournament/post'
          );

          assertT3(input.postId);
          const commentId = await submitTournamentEntry(
            input.drawing,
            input.imageData,
            input.postId
          );

          return { success: true, commentId };
        }),

      getSubmissions: t.procedure
        .input(z.object({ postId: z.string() }))
        .query(async ({ input }) => {
          assertT3(input.postId);
          const { getTournamentEntries } = await import(
            '../services/posts/tournament/post'
          );
          return await getTournamentEntries(input.postId);
        }),

      getRandomPair: t.procedure
        .input(z.object({ postId: z.string() }))
        .query(async ({ input }) => {
          assertT3(input.postId);
          const { getRandomPair } = await import(
            '../services/posts/tournament/pairs'
          );
          return await getRandomPair(input.postId);
        }),

      getDrawingPairs: t.procedure
        .input(
          z.object({
            postId: z.string(),
            count: z.number().int().min(1).max(20).default(5),
          })
        )
        .query(async ({ input }) => {
          assertT3(input.postId);
          const { getDrawingPairs } = await import(
            '../services/posts/tournament/pairs'
          );
          return await getDrawingPairs(input.postId, input.count);
        }),

      submitVote: t.procedure
        .input(
          z.object({
            postId: z.string(),
            winnerCommentId: z.string(),
            loserCommentId: z.string(),
          })
        )
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId) throw new Error('Must be logged in');

          const winnerId = input.winnerCommentId as T1;
          const loserId = input.loserCommentId as T1;

          const { tournamentVote } = await import(
            '../services/posts/tournament/post'
          );
          // Context is used inside the function
          await tournamentVote(winnerId, loserId);

          return { success: true };
        }),

      getStats: t.procedure
        .input(z.object({ postId: z.string() }))
        .query(async ({ input }) => {
          assertT3(input.postId);
          const { getTournament } = await import(
            '../services/posts/tournament/post'
          );
          return await getTournament(input.postId);
        }),

      getCommentDrawing: t.procedure
        .input(z.object({ commentId: z.string() }))
        .query(async ({ input }) => {
          const { getTournamentEntry } = await import(
            '../services/posts/tournament/post'
          );
          return await getTournamentEntry(input.commentId as T1);
        }),

      getSubmissionsWithDrawings: t.procedure
        .input(z.object({ postId: z.string() }))
        .query(async ({ ctx, input }) => {
          if (!ctx.userId) throw new Error('Must be logged in');

          assertT3(input.postId);
          const { getTournamentEntry } = await import(
            '../services/posts/tournament/post'
          );
          const { redis } = await import('@devvit/web/server');
          const { REDIS_KEYS } = await import('../core/redis');
          const { getUsername } = await import('../core/user');

          // Get all submissions ordered by Elo rating (highest first)
          const queryKey = REDIS_KEYS.tournamentEntries(input.postId);

          const rankedSubmissions = await redis.zRange(queryKey, 0, -1, {
            reverse: true,
            by: 'rank',
          });

          if (rankedSubmissions.length === 0) {
            return [];
          }

          // Collect all comment IDs and fetch entries in parallel
          const commentIds = rankedSubmissions.map((item) => item.member as T1);
          const entryPromises = commentIds.map((id) => getTournamentEntry(id));
          const entryList = await Promise.all(entryPromises);

          // Build a map of commentId -> entry (filtering undefined)
          const entryMap = new Map<
            T1,
            NonNullable<Awaited<ReturnType<typeof getTournamentEntry>>>
          >();
          const userIds: string[] = [];
          entryList.forEach((entry, idx) => {
            const commentId = commentIds[idx];
            if (entry) {
              entryMap.set(commentId, entry);
              userIds.push(entry.userId);
            }
          });

          // Resolve usernames with de-duplication
          const uniqueUserIds = Array.from(new Set(userIds));
          const usernameResults = await Promise.all(
            uniqueUserIds.map((uid) => getUsername(uid as never))
          );
          const usernameMap = new Map<string, string>();
          uniqueUserIds.forEach((uid, i) => {
            usernameMap.set(uid, usernameResults[i] ?? '');
          });

          // Assemble results in the same rank order, skipping missing entries
          const results = rankedSubmissions
            .map((item) => {
              const commentId = item.member as T1;
              const data = entryMap.get(commentId);
              if (!data) return null;
              return {
                commentId,
                drawing: data.drawing,
                userId: data.userId,
                username: usernameMap.get(data.userId) ?? '',
                postId: data.postId,
                score: item.score,
                rating: item.score,
                votes: data.votes,
                views: data.views,
              };
            })
            .filter(Boolean) as Array<{
            commentId: T1;
            drawing: DrawingData;
            userId: string;
            username: string;
            postId: string;
            score: number;
            rating: number;
            votes: number;
            views: number;
          }>;

          return results;
        }),

      incrementViews: t.procedure
        .input(z.object({ commentId: z.string() }))
        .mutation(async ({ input }) => {
          const { incrementEntryViews } = await import(
            '../services/posts/tournament/post'
          );
          await incrementEntryViews(input.commentId as T1);
          return { success: true };
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
