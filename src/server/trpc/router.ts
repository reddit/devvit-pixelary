import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';

import type { T3, T1 } from '@devvit/shared-types/tid.js';
import { assertT3 } from '@devvit/shared-types/tid.js';
import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from '@server/core/redis';
import { getMyArtPage } from '@server/services/posts/user-art';
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
import {
  DrawingDataSchema,
  DrawingSubmitInputSchema,
  GuessSubmitInputSchema,
  GuessStatsInputSchema,
  PostDataInputSchema,
} from '@shared/schema/pixelary';
import type { DrawingData } from '@shared/schema/drawing';
import {
  trackEventFromContext,
  getEventStats,
  getEventStatsRange,
} from '@server/services/telemetry';
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
        if (!ctx.subredditName)
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Subreddit not found',
          });

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
        if (!ctx.subredditName)
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Subreddit not found',
          });

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
        if (!ctx.subredditName)
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Subreddit not found',
          });
        const result = await getWords(ctx.subredditName, 0, 10000);
        return result.words;
      }),

      add: t.procedure
        .input(z.object({ word: z.string().min(1).max(50) }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.subredditName)
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Subreddit not found',
            });
          const success = await addWord(input.word);
          if (!success) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Failed to add word or word already exists',
            });
          }
          return { success: true };
        }),

      remove: t.procedure
        .input(z.object({ word: z.string().min(1).max(50) }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.subredditName)
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Subreddit not found',
            });
          const success = await removeWord(input.word);
          if (!success) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Failed to remove word or word not found',
            });
          }
          return { success: true };
        }),

      getBanned: t.procedure.query(async ({ ctx }) => {
        if (!ctx.subredditName)
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Subreddit not found',
          });
        const result = await getBannedWords(0, 10000);
        return result.words;
      }),

      getCandidates: t.procedure.query(async ({ ctx }) => {
        if (!ctx.subredditName)
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Subreddit not found',
          });

        const result = await generateSlate();
        return result;
      }),

      getWordStats: t.procedure
        .input(
          z.object({
            limit: z.number().min(1).max(100).default(20),
          })
        )
        .query(async ({ ctx, input }) => {
          // Only admins can access word stats
          if (!ctx.userId) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Must be logged in',
            });
          }

          const userIsAdmin = await isAdmin(ctx.userId);
          if (!userIsAdmin) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Admin access required',
            });
          }

          if (!ctx.subredditName) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Subreddit not found',
            });
          }

          // Get top words by score (highest scores first)
          // Words are stored in global Redis, not subreddit-specific
          const wordsByScore = await redis.global.zRange(
            REDIS_KEYS.wordsAll(ctx.subredditName),
            0,
            input.limit - 1,
            { reverse: true, by: 'rank' }
          );

          // Get top words by uncertainty (highest uncertainty first)
          const wordsByUncertainty = await redis.global.zRange(
            REDIS_KEYS.wordsUncertainty(ctx.subredditName),
            0,
            input.limit - 1,
            { reverse: true, by: 'rank' }
          );

          return {
            byScore: wordsByScore.map((item) => ({
              word: item.member,
              score: item.score,
            })),
            byUncertainty: wordsByUncertainty.map((item) => ({
              word: item.member,
              uncertainty: item.score,
            })),
          };
        }),
    }),

    // Post endpoints
    post: t.router({
      getDrawing: t.procedure
        .input(PostDataInputSchema)
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

      // moved: collection.get

      submitDrawing: t.procedure
        .input(DrawingSubmitInputSchema)
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId || !ctx.username) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Must be logged in',
            });
          }
          if (!ctx.subredditId) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Subreddit not found',
            });
          }

          const post = await createDrawing({
            word: input.word,
            dictionary: input.dictionary,
            drawing: input.drawing,
            authorName: ctx.username,
            authorId: ctx.userId,
          });

          const navigateTo = `https://reddit.com/r/${ctx.subredditName}/comments/${post.id}`;

          // Set pending navigation flag for mobile navigation after expanded mode closes
          const navigationKey = REDIS_KEYS.pendingNavigation(ctx.userId);
          await redis.set(
            navigationKey as never,
            navigateTo as never,
            {
              ex: 60, // 60 second TTL
            } as never
          );

          return {
            success: true,
            postId: post.id,
            navigateTo,
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
          if (!ctx.userId)
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Must be logged in',
            });

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
        .input(PostDataInputSchema)
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Must be logged in',
            });
          }

          assertT3(input.postId);
          const firstView = await isAuthorFirstView(input.postId);

          return { firstView };
        }),
    }),

    // Collection endpoints
    collection: t.router({
      get: t.procedure
        .input(z.object({ collectionId: z.string() }))
        .query(async ({ input }) => {
          const { getCollectionData } = await import(
            '../services/posts/collection'
          );
          return await getCollectionData(input.collectionId);
        }),
    }),

    // Guess endpoints
    guess: t.router({
      submit: t.procedure
        .input(GuessSubmitInputSchema)
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId)
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Must be logged in',
            });
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
        .input(GuessStatsInputSchema)
        .query(async ({ input }) => {
          assertT3(input.postId);
          const postId = input.postId;
          const result = await getGuesses(postId);
          return result;
        }),

      skip: t.procedure
        .input(PostDataInputSchema)
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId)
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Must be logged in to skip post',
            });
          assertT3(input.postId);
          const postId = input.postId;
          await skipDrawing(postId, ctx.userId);
          return { success: true };
        }),
    }),

    // User endpoints
    user: t.router({
      colors: t.router({
        getRecent: t.procedure.query(async ({ ctx }) => {
          const { DEFAULT_MRU_COLORS } = await import('@client/constants');
          if (!ctx.userId) {
            // Anonymous users see the default MRU colors
            return [...DEFAULT_MRU_COLORS];
          }
          const { getRecentColors } = await import('../services/user/colors');
          return await getRecentColors(ctx.userId, DEFAULT_MRU_COLORS, 7);
        }),
        pushRecent: t.procedure
          .input(z.object({ color: z.string().regex(/^#[0-9A-Fa-f]{6}$/) }))
          .mutation(async ({ ctx, input }) => {
            if (!ctx.userId) {
              // No-op for anonymous users
              return { success: true } as const;
            }
            const { pushRecentColor } = await import('../services/user/colors');
            await pushRecentColor(ctx.userId, input.color as `#${string}`, 7);
            return { success: true } as const;
          }),
      }),
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
          if (!ctx.userId)
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Must be logged in',
            });
          return await getUserDrawingsWithData(ctx.userId, input.limit);
        }),

      getMyArtPage: t.procedure
        .input(
          z.object({
            limit: z.number().int().min(1).max(100).default(20),
            cursor: z.number().int().optional(),
          })
        )
        .query(async ({ ctx, input }) => {
          if (!ctx.userId)
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Must be logged in',
            });
          const result = await getMyArtPage({
            userId: ctx.userId,
            limit: input.limit,
            ...(input.cursor !== undefined && { cursor: input.cursor }),
          });
          return result;
        }),

      getPendingNavigation: t.procedure.mutation(async ({ ctx }) => {
        if (!ctx.userId) {
          return { url: null };
        }
        const navigationKey = REDIS_KEYS.pendingNavigation(ctx.userId);
        // Note: GET + DEL is not atomic, but this is acceptable because:
        // 1. Client-side ref guards prevent rapid successive calls from the same component
        // 2. navigateTo to the same URL is idempotent, so multiple navigations are harmless
        // 3. The race window is very small (microseconds)
        const url = await redis.get(navigationKey as never);
        if (url) {
          await redis.del(navigationKey as never);
          return { url: url as string };
        }
        return { url: null };
      }),

      getPendingTournamentSubmission: t.procedure.mutation(async ({ ctx }) => {
        if (!ctx.userId) {
          return { submitted: false };
        }
        const submissionKey = REDIS_KEYS.pendingTournamentSubmission(
          ctx.userId
        );
        // Note: GET + DEL is not atomic, but this is acceptable because:
        // 1. Client-side ref guards prevent rapid successive calls from the same component
        // 2. Showing toast multiple times is harmless
        // 3. The race window is very small (microseconds)
        const flag = await redis.get(submissionKey as never);
        if (flag) {
          await redis.del(submissionKey as never);
          return { submitted: true };
        }
        return { submitted: false };
      }),

      getRank: t.procedure.query(async ({ ctx }) => {
        if (!ctx.userId)
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Must be logged in',
          });

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

      isAdmin: t.procedure.query(async ({ ctx }) => {
        if (!ctx.userId) {
          return false;
        }

        return await isAdmin(ctx.userId);
      }),

      getUnclaimedLevelUp: t.procedure.query(async ({ ctx }) => {
        if (!ctx.userId) return null;
        return await getUnclaimedLevelUp(ctx.userId);
      }),

      claimLevelUp: t.procedure
        .input(z.object({ level: z.number().int() }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId)
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Must be logged in',
            });
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
            metadata: z
              .record(z.string(), z.union([z.string(), z.number()]))
              .optional(),
            postId: z.string().optional(),
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
            case 'slate_posted': {
              // Prefer explicit postId from input, fallback to context
              const postedPostId = input.postId ?? ctx.postId;
              if (!input.word || !postedPostId) {
                return { ok: true };
              }
              assertT3(postedPostId);
              await handleSlateEvent({
                slateId: input.slateId as SlateId,
                name: 'slate_posted',
                word: input.word,
                postId: postedPostId,
              });
              break;
            }
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
              metadata: z.record(z.string(), z.union([z.string(), z.number()])),
            }),
            z.object({
              eventType: z.string(),
            }),
          ])
        )
        .mutation(async ({ ctx, input }) => {
          try {
            // Fire-and-forget telemetry tracking with automatic post type detection
            const metadata: Record<string, string | number> =
              'metadata' in input ? input.metadata : {};
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

      getStats: t.procedure
        .input(
          z.object({
            date: z.string(),
            days: z.number().optional(),
          })
        )
        .query(async ({ ctx, input }) => {
          // Only admins can access telemetry stats
          if (!ctx.userId) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Must be logged in',
            });
          }

          const userIsAdmin = await isAdmin(ctx.userId);
          if (!userIsAdmin) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Admin access required',
            });
          }

          if (input.days && input.days > 1) {
            return await getEventStatsRange(input.date, input.days);
          }

          return await getEventStats(input.date);
        }),
    }),

    // Rewards endpoints
    rewards: t.router({
      getInventory: t.procedure.query(async ({ ctx }) => {
        if (!ctx.userId)
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Must be logged in',
          });
        const { getInventory } = await import(
          '../services/rewards/consumables'
        );
        return await getInventory(ctx.userId);
      }),

      getActiveEffects: t.procedure.query(async ({ ctx }) => {
        if (!ctx.userId)
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Must be logged in',
          });
        const { getActiveEffects } = await import(
          '../services/rewards/consumables'
        );
        return await getActiveEffects(ctx.userId);
      }),

      activateConsumable: t.procedure
        .input(
          z.object({
            itemId: z.union([
              z.literal('score_multiplier_2x'),
              z.literal('score_multiplier_3x'),
              z.literal('draw_time_boost_30s'),
            ]),
          })
        )
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId)
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Must be logged in',
            });
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
        if (!ctx.userId)
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Must be logged in',
          });
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
                  z.literal('score_multiplier_2x'),
                  z.literal('score_multiplier_3x'),
                  z.literal('draw_time_boost_30s'),
                ]),
                quantity: z.number().int().min(1),
              })
            ),
          })
        )
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId)
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Must be logged in',
            });
          const { isAdmin, isModerator } = await import('../core/redis');
          const userIsAdmin = await isAdmin(ctx.userId);
          const userIsModerator = ctx.subredditName
            ? await isModerator(ctx.userId, ctx.subredditName)
            : false;
          if (!userIsAdmin && !userIsModerator) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Not authorized',
            });
          }
          const { reddit } = await import('@devvit/web/server');
          const user = await reddit.getUserByUsername(input.username);
          if (!user)
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'User not found',
            });
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
        if (!ctx.subredditName)
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Subreddit not found',
          });

        // Get tournament info from current post context
        if (!ctx.postId || ctx.postData?.type !== 'tournament') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Not on a tournament post',
          });
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
          })
        )
        .mutation(async ({ ctx, input }) => {
          if (!ctx.userId)
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Must be logged in',
            });

          const { submitTournamentEntry } = await import(
            '../services/posts/tournament/post'
          );

          assertT3(input.postId);
          const commentId = await submitTournamentEntry(
            input.drawing,
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
          if (!ctx.userId)
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Must be logged in',
            });

          const winnerId = input.winnerCommentId as T1;
          const loserId = input.loserCommentId as T1;

          const { tournamentVote } = await import(
            '../services/posts/tournament/post'
          );
          await tournamentVote(input.postId as T3, winnerId, loserId);

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
        .query(async ({ input }) => {
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
            if (entry && commentId) {
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
