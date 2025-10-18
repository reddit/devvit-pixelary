import { redis, scheduler, realtime } from '@devvit/web/server';
import { incrementScore } from './progression';
import { titleCase } from '../../shared/utils/string';
import type { DrawingPostDataExtended } from '../../shared/schema/pixelary';
import { createPost } from '../core/post';
import type { DrawingData } from '../../shared/schema/drawing';
import {
  parseT2,
  parseT3,
  type T1,
  type T2,
  type T3,
} from '../../shared/types';
import {
  AUTHOR_REWARD_CORRECT_GUESS,
  AUTHOR_REWARD_SUBMIT,
  GUESSER_REWARD_SOLVE,
} from '../../shared/constants';
import { REDIS_KEYS } from './redis';

/**
 * Create a new drawing post
 * @param options - The options for creating the drawing post
 * @returns The created drawing post
 */
export const createDrawing = async (options: {
  word: string;
  dictionary: string;
  drawing: DrawingData;
  authorName: string;
  authorId: T2;
}) => {
  const { word, dictionary, drawing, authorName, authorId } = options;

  // Create Reddit post unit
  const post = await createPost(`What did u/${authorName} draw?`, {
    type: 'drawing',
    word,
    drawing,
    dictionary,
    authorId,
    authorName,
  });

  const postId = post.id;
  const currentDate = new Date();
  const currentTime = currentDate.getTime();

  // Run all operations in parallel
  await Promise.all([
    // Save post data and additional metadata to redis. Largely so we can fetch the drawing post later from other contexts.
    redis.hSet(REDIS_KEYS.drawing(postId), {
      type: 'drawing',
      postId,
      createdAt: post.createdAt.getTime().toString(),
      word,
      dictionary,
      drawing: JSON.stringify(drawing),
      authorId,
      authorName,
    }),

    // Award points for submission
    incrementScore(authorId, AUTHOR_REWARD_SUBMIT),

    // Add to list of drawings for this word
    redis.zAdd(REDIS_KEYS.drawingsByWord(word), {
      member: postId,
      score: currentTime,
    }),

    // Add to all drawings list
    redis.zAdd(REDIS_KEYS.allDrawings(), {
      member: postId,
      score: currentTime,
    }),

    // Add to list of drawings for this user
    redis.zAdd(REDIS_KEYS.drawingsByUser(authorId), {
      member: postId,
      score: currentTime,
    }),
  ]);

  // Schedule pinned comment job (non-blocking - don't fail if this fails)
  try {
    await scheduler.runJob({
      name: 'NEW_DRAWING_PINNED_COMMENT',
      data: {
        postId,
        authorName,
        word,
      },
      runAt: currentDate, // run immediately
    });
  } catch (error) {
    console.error(
      `Failed to schedule pinned comment job for post ${postId}:`,
      error
    );
    // Don't throw - the drawing post should still be created even if comment fails
  }

  return post;
};

/**
 * Get a drawing post by its ID
 * @param postId - The ID of the drawing post to get
 * @returns The drawing post data
 */

export async function getDrawing(
  postId: T3
): Promise<DrawingPostDataExtended | null> {
  const key = REDIS_KEYS.drawing(postId);

  const [data, stats] = await Promise.all([
    redis.hGetAll(key),
    getDrawingStats(postId),
  ]);

  const {
    type,
    word,
    dictionary,
    drawing,
    authorId,
    authorName,
    pinnedCommentId,
    lastCommentUpdate,
  } = data;

  const { playerCount, solvedPercentage } = stats;

  if (
    !type ||
    type !== 'drawing' ||
    !word ||
    !dictionary ||
    !drawing ||
    !authorId ||
    !authorName
  ) {
    return null;
  }

  return {
    type: 'drawing',
    postId,
    word,
    dictionary,
    drawing: JSON.parse(drawing),
    authorId,
    authorName,
    playerCount,
    solvedPercentage,
    pinnedCommentId,
    lastCommentUpdate: lastCommentUpdate
      ? parseInt(lastCommentUpdate)
      : undefined,
  };
}

/**
 * Get multiple drawing posts by their IDs
 * @param postIds - The IDs of the drawing posts to get
 * @returns The drawing posts data
 */

export async function getDrawings(
  postIds: T3[]
): Promise<DrawingPostDataExtended[]> {
  if (postIds.length === 0) return [];

  const drawings = await Promise.all(
    postIds.map(async (postId) => {
      return await getDrawing(postId);
    })
  );

  return drawings.filter(
    (drawing): drawing is DrawingPostDataExtended => drawing !== null
  );
}

/**
 * Skip a drawing post
 * @param postId - The ID of the drawing post to skip
 * @param userId - The ID of the user who is skipping the post
 */

export async function skipDrawing(postId: T3, userId: T2): Promise<void> {
  const key = REDIS_KEYS.userSkipped(postId);
  await redis.zAdd(key, {
    member: userId,
    score: Date.now(),
  });
}

/**
 * Get the number of players who have attempted to solve a drawing
 * @param postId - The ID of the drawing post to get the player count for
 * @returns The number of players who have solved and skipped the drawing
 */

export async function getPlayerCount(postId: T3): Promise<number> {
  const key = REDIS_KEYS.userAttempts(postId);
  return await redis.zCard(key);
}

/**
 * Get the solved percentage and player count for a drawing post
 * @param postId - The ID of the drawing post to get the solved percentage for
 * @returns The solved percentage and player count for the drawing post
 */

export async function getDrawingStats(postId: T3): Promise<{
  playerCount: number;
  solvedPercentage: number;
}> {
  const [playerCount, solvedCount] = await Promise.all([
    redis.zCard(REDIS_KEYS.userAttempts(postId)),
    redis.zCard(REDIS_KEYS.userSolved(postId)),
  ]);

  const result = {
    playerCount,
    solvedPercentage:
      playerCount === 0
        ? 0
        : Math.round((solvedCount / playerCount) * 100 * 10) / 10,
  };

  return result;
}

/**
 * Save the pinned comment ID for a drawing post
 * @param postId - The ID of the drawing post to save the pinned comment ID for
 * @param commentId - The ID of the pinned comment
 */

export async function savePinnedCommentId(
  postId: T3,
  commentId: T1
): Promise<void> {
  const key = REDIS_KEYS.drawing(postId);
  await redis.hSet(key, {
    pinnedCommentId: commentId,
  });
}

/**
 * Save the last comment update timestamp for a drawing post
 * @param postId - The ID of the drawing post to save the last comment update timestamp for
 * @param timestamp - The timestamp of the last comment update
 */

export async function saveLastCommentUpdate(
  postId: T3,
  updatedAt: number
): Promise<void> {
  const key = REDIS_KEYS.drawing(postId);
  await redis.hSet(key, {
    lastCommentUpdate: updatedAt.toString(),
  });
}

/**
 * Get the next scheduled job ID for a drawing post
 * @param postId - The ID of the drawing post to get the scheduled job ID for
 * @returns The scheduled job ID, or null if none is scheduled
 */
export async function getNextScheduledJobId(
  postId: T3
): Promise<string | null> {
  const key = REDIS_KEYS.drawing(postId);
  const result = await redis.hGet(key, 'nextScheduledJobId');
  return result || null;
}

/**
 * Save the next scheduled job ID for a drawing post
 * @param postId - The ID of the drawing post to save the scheduled job ID for
 * @param jobId - The job ID of the scheduled update
 */
export async function saveNextScheduledJobId(
  postId: T3,
  jobId: string
): Promise<void> {
  const key = REDIS_KEYS.drawing(postId);
  await redis.hSet(key, {
    nextScheduledJobId: jobId,
  });
}

/**
 * Clear the next scheduled job ID for a drawing post
 * @param postId - The ID of the drawing post to clear the scheduled job ID for
 */
export async function clearNextScheduledJobId(postId: T3): Promise<void> {
  const key = REDIS_KEYS.drawing(postId);
  await redis.hDel(key, ['nextScheduledJobId']);
}

/**
 * Schedule a comment update job and save its ID
 * @param postId - The ID of the drawing post to schedule an update for
 * @param runAt - When to run the update job
 * @returns The job ID of the scheduled update
 */
export async function scheduleCommentUpdate(
  postId: T3,
  runAt: Date
): Promise<string> {
  const jobId = await scheduler.runJob({
    name: 'UPDATE_DRAWING_PINNED_COMMENT',
    data: { postId },
    runAt,
  });

  await saveNextScheduledJobId(postId, jobId);
  return jobId;
}

/**
 * Get drawing post IDs for a specific user
 * @param userId - The user ID to get drawings for
 * @param limit - Maximum number of drawings to return (default: 20)
 * @returns Array of drawing post IDs
 */
export async function getUserDrawings(
  userId: T2,
  limit: number = 20
): Promise<T3[]> {
  const drawingIds = await redis.zRange(
    REDIS_KEYS.drawingsByUser(userId),
    0,
    limit - 1,
    { reverse: true, by: 'rank' }
  );

  return drawingIds.map((entry) => parseT3(entry.member));
}

/**
 * Check if a user has completed a drawing. Completed means they have solved or skipped the drawing.
 * @param postId - The post ID of the drawing to check
 * @param userId - The user ID to check
 * @returns `true` if the user has completed the drawing, `false` otherwise
 */
export async function hasCompletedDrawing(
  postId: T3,
  userId: T2
): Promise<boolean> {
  const [solved, skipped] = await Promise.all([
    redis.zScore(REDIS_KEYS.userSolved(postId), userId),
    redis.zScore(REDIS_KEYS.userSkipped(postId), userId),
  ]);

  return solved !== null || skipped !== null;
}

/**
 * Submit a guess for a drawing post
 * @param postId - The ID of the drawing post to submit the guess for
 * @param username - The username of the user who is submitting the guess
 * @param guess - The guess that the user is submitting
 * @param createComment - Whether to create a comment for the guess
 * @param context - The context of the request
 * @returns The result of the guess
 */

export async function submitGuess(options: {
  postId: T3;
  userId: T2;
  guess: string;
}): Promise<{
  correct: boolean;
  points: number;
}> {
  const { postId, userId, guess } = options;
  const empty = { correct: false, points: 0 };

  // Check if user already solved/skipped this post and get the word
  const [solved, skipped, word, authorId] = await Promise.all([
    redis.zScore(REDIS_KEYS.userSolved(postId), userId),
    redis.zScore(REDIS_KEYS.userSkipped(postId), userId),
    redis.hGet(REDIS_KEYS.drawing(postId), 'word'),
    redis.hGet(REDIS_KEYS.drawing(postId), 'authorId'),
  ]);

  // Check if user exists in the sets (explicit check for both null and undefined)
  const isInSolvedSet = solved !== null && solved !== undefined;
  const isInSkippedSet = skipped !== null && skipped !== undefined;

  // Clean up inconsistent data - user shouldn't be in both solved and skipped
  if (isInSolvedSet && isInSkippedSet) {
    // Remove from skipped set (solved takes precedence)
    await redis.zRem(REDIS_KEYS.userSkipped(postId), [userId]);
  }

  // Don't allow guesses if user has already solved (but allow if only skipped)
  if (!word || !authorId || isInSolvedSet) {
    return empty;
  }

  // Increment counters and store the guess
  await Promise.all([
    // Always increment user attempts (zIncrBy will add if not exists, increment if exists)
    redis.zIncrBy(REDIS_KEYS.userAttempts(postId), userId, 1),
    redis.zIncrBy(REDIS_KEYS.drawingsByWord(word), postId, 1),
    redis.zIncrBy(
      REDIS_KEYS.drawingGuesses(postId),
      titleCase(guess.trim()),
      1
    ),
  ]);

  // Get updated stats after all Redis operations complete
  const updatedStats = await getGuesses(postId);

  // Check if guess is correct (case-insensitive)
  const isCorrect = guess.toLowerCase().trim() === word.toLowerCase().trim();
  const channelName = `post-${postId}`;

  // Handle comment update cooldown logic for ALL guesses (not just correct ones)
  const now = Date.now();
  const ONE_MINUTE = 60 * 1000;

  const [lastUpdate, nextJobId] = await Promise.all([
    redis.hGet(REDIS_KEYS.drawing(postId), 'lastCommentUpdate'),
    redis.hGet(REDIS_KEYS.drawing(postId), 'nextScheduledJobId'),
  ]);

  const lastUpdateTime = lastUpdate ? parseInt(lastUpdate) : 0;
  const timeSinceLastUpdate = now - lastUpdateTime;

  if (timeSinceLastUpdate >= ONE_MINUTE) {
    // Cooldown expired - update immediately
    // Cancel any pending job
    if (nextJobId) {
      try {
        await scheduler.cancelJob(nextJobId);
        await clearNextScheduledJobId(postId);
      } catch (error) {
        console.error(
          `[COMMENT_UPDATE] Failed to cancel job ${nextJobId} for post ${postId}:`,
          error
        );
      }
    }

    // Schedule immediate update
    try {
      await scheduleCommentUpdate(postId, new Date(now));
    } catch (error) {
      console.error(
        `[COMMENT_UPDATE] Failed to schedule immediate update for post ${postId}:`,
        error
      );
    }
  } else if (!nextJobId) {
    // Within cooldown, no job scheduled - schedule one
    const nextUpdateTime = lastUpdateTime + ONE_MINUTE;
    try {
      await scheduleCommentUpdate(postId, new Date(nextUpdateTime));
    } catch (error) {
      console.error(
        `[COMMENT_UPDATE] Failed to schedule future update for post ${postId}:`,
        error
      );
    }
  }
  // else: Within cooldown AND job already scheduled - do nothing

  if (!isCorrect) {
    // Broadcast guess event to all clients watching this post
    await realtime.send(channelName, {
      type: 'guess_submitted',
      postId,
      correct: false,
      timestamp: Date.now(),
      stats: updatedStats,
    });

    return {
      correct: false,
      points: 0,
    };
  }

  // Handle correct guess - mark as solved and award points
  await Promise.all([
    // Mark as solved
    redis.zAdd(REDIS_KEYS.userSolved(postId), {
      member: userId,
      score: Date.now(),
    }),

    // Award points
    incrementScore(userId, GUESSER_REWARD_SOLVE),

    // Award author points
    incrementScore(parseT2(authorId), AUTHOR_REWARD_CORRECT_GUESS),
  ]);

  // Get updated stats after all Redis operations complete
  const finalStats = await getGuesses(postId);

  // Send realtime message with fresh stats
  await realtime.send(channelName, {
    type: 'guess_submitted',
    postId,
    correct: true,
    timestamp: Date.now(),
    stats: finalStats,
  });

  return {
    correct: true,
    points: GUESSER_REWARD_SOLVE,
  };
}

/**
 * Get the guesses for a drawing post
 * @param postId - The ID of the drawing post to get the guesses for
 * @param limit - The number of guesses to get
 * @returns The guesses for the drawing post
 */

export async function getGuesses(
  postId: T3,
  limit: number = 10
): Promise<{
  guesses: Record<string, number>;
  wordCount: number;
  guessCount: number;
  playerCount: number;
  solvedCount: number;
}> {
  const [guesses, stats, solvedCount] = await Promise.all([
    redis
      .zRange(REDIS_KEYS.drawingGuesses(postId), 0, limit - 1, {
        reverse: true,
        by: 'rank',
      })
      .then((guesses) => {
        const result = guesses.reduce(
          (acc, guess) => {
            acc[guess.member] = guess.score;
            return acc;
          },
          {} as Record<string, number>
        );

        return result;
      }),
    getDrawingStats(postId),
    redis.zCard(REDIS_KEYS.userSolved(postId)),
  ]);

  // Calculate total guess count from the guesses object
  const guessCount = Object.values(guesses).reduce(
    (sum, count) => sum + count,
    0
  );
  const wordCount = Object.keys(guesses).length;

  const result = {
    guesses,
    wordCount,
    guessCount,
    playerCount: stats.playerCount,
    solvedCount,
  };

  return result;
}

export type WordGuessEntry = {
  word: string;
  count: number;
  rank: number;
};

/**
 * Get the comment data for a drawing post
 * @param postId - The ID of the drawing post to get the comment data for
 * @returns The comment data for the drawing post
 */

export async function getDrawingCommentData(postId: T3): Promise<{
  solves: number;
  solvedPercentage: number;
  skips: number;
  skipPercentage: number;
  wordCount: number;
  guessCount: number;
  playerCount: number;
  guesses: { word: string; count: number }[];
}> {
  const [playerCount, solvedCount, skippedCount, wordCount, guesses] =
    await Promise.all([
      redis.zCard(REDIS_KEYS.userAttempts(postId)),
      redis.zCard(REDIS_KEYS.userSolved(postId)),
      redis.zCard(REDIS_KEYS.userSkipped(postId)),
      redis.zCard(REDIS_KEYS.drawingGuesses(postId)),
      redis.zRange(REDIS_KEYS.drawingGuesses(postId), 0, -1, {
        reverse: true,
        by: 'rank',
      }),
    ]);

  const solvedPercentage =
    playerCount === 0
      ? 0
      : Math.round((solvedCount / playerCount) * 100 * 10) / 10;

  const skipPercentage =
    playerCount === 0
      ? 0
      : Math.round((skippedCount / playerCount) * 100 * 10) / 10;

  const guessesParsed = guesses.map((guess) => ({
    word: guess.member,
    count: guess.score,
  }));

  // Calculate total guess count from individual guesses
  const guessCount = guessesParsed.reduce((sum, guess) => sum + guess.count, 0);

  return {
    solves: solvedCount,
    solvedPercentage,
    skips: skippedCount,
    skipPercentage,
    wordCount,
    guessCount,
    playerCount,
    guesses: guessesParsed,
  };
}

type DrawingCommentStats = {
  playerCount: number;
  guessCount: number;
  wordCount: number;
  skips: number;
  skipPercentage: number;
  solves: number;
  solvedPercentage: number;
};

type CommentSection = {
  content: string;
  condition?: (stats: DrawingCommentStats) => boolean;
};

/**
 * Generate comment text for drawing posts using modular sections
 * @param stats - Optional stats data for conditional sections
 * @returns The formatted comment text
 */
export function generateDrawingCommentText(
  stats?: DrawingCommentStats
): string {
  const sections: CommentSection[] = [
    {
      content: `Pixelary is a community drawing game. Submit your guess in the post above!`,
    },
    {
      content: generateDifficultySection(stats),
      condition: (stats) => stats.guessCount >= 100,
    },
    {
      content: generateLiveStatsSection(stats),
      condition: () => !!stats,
    },
    {
      content: `Comment commands:
- \`!words\` - See dictionary
- \`!add <word>\` - Add word to dictionary
- \`!show <word>\` - Check guess stats
- \`!help\` - All commands`,
    },
    {
      content: `Good luck and thanks for playing!`,
    },
  ];

  return sections
    .filter(
      (section) => !section.condition || (stats && section.condition(stats))
    )
    .map((section) => section.content)
    .join('\n\n');
}

function generateDifficultySection(
  stats: DrawingCommentStats | undefined
): string {
  if (!stats) return '';

  const difficultyScore =
    stats.playerCount > 0
      ? Math.round((stats.guessCount / stats.playerCount) * 10) / 10
      : 0;

  const difficultyLevel =
    difficultyScore < 2
      ? '🟢 Easy'
      : difficultyScore < 4
        ? '🟡 Medium'
        : difficultyScore < 6
          ? '🟠 Hard'
          : '🔴 Expert';

  return `Difficulty: ${difficultyLevel} (${difficultyScore}/10)`;
}

function generateLiveStatsSection(
  stats: DrawingCommentStats | undefined
): string {
  if (!stats) return '';

  const avgGuessesPerPlayer =
    stats.playerCount > 0
      ? Math.round((stats.guessCount / stats.playerCount) * 10) / 10
      : 0;

  return `Live stats:
- ${stats.playerCount} unique players guessed
- ${stats.guessCount} total guesses (avg ${avgGuessesPerPlayer} per player)
- ${stats.wordCount} unique words guessed
- ${stats.skips} skips (${stats.skipPercentage}% skip rate)
- ${stats.solves} solves (${stats.solvedPercentage}% solved rate)`;
}
