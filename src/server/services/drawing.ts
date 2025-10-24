import {
  redis,
  scheduler,
  realtime,
  context,
  reddit,
  cache,
} from '@devvit/web/server';
import { incrementScore } from './progression';
import { titleCase } from '../../shared/utils/string';
import type { DrawingPostDataExtended } from '../../shared/schema/pixelary';
import { createPost } from '../core/post';
import { setPostFlair } from '../core/flair';
import type { DrawingData } from '../../shared/schema/drawing';
import type { T1, T2, T3 } from '@devvit/shared-types/tid.js';
import { isT2, isT3 } from '@devvit/shared-types/tid.js';
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
  const postData = {
    type: 'drawing' as const,
    word,
    drawing,
    dictionary,
    authorId,
    authorName,
  };

  const post = await createPost(`What did u/${authorName} draw?`, postData);

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
    redis.zAdd(REDIS_KEYS.wordDrawings(word), {
      member: postId,
      score: currentTime,
    }),

    // Add to all drawings list
    redis.zAdd(REDIS_KEYS.allDrawings(), {
      member: postId,
      score: currentTime,
    }),

    // Add to list of drawings for this user
    redis.zAdd(REDIS_KEYS.userDrawings(authorId), {
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
    // Don't throw - the drawing post should still be created even if comment fails
  }

  // Set "Unranked" flair on new post (non-blocking)
  try {
    await setPostFlair(postId, context.subredditName, 'unranked');
  } catch (error) {
    // Don't throw - flair setting should not block post creation
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
  const key = REDIS_KEYS.drawingSkips(postId);
  await redis.zAdd(key, {
    member: userId,
    score: Date.now(),
  });
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
  return await cache(
    async () => {
      const [playerCount, solvedCount] = await Promise.all([
        redis.zCard(REDIS_KEYS.drawingAttempts(postId)),
        redis.zCard(REDIS_KEYS.drawingSolves(postId)),
      ]);

      return {
        playerCount,
        solvedPercentage:
          playerCount === 0
            ? 0
            : Math.round((solvedCount / playerCount) * 100 * 10) / 10,
      };
    },
    {
      key: `drawing:stats:${postId}`,
      ttl: 5, // 5 seconds - realtime updates handle live data
    }
  );
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

/**
 * Get the pinned comment ID for any post type (drawing or pinned)
 * @param postId - The ID of the post to get the pinned comment ID for
 * @returns The pinned comment ID if it exists, null otherwise
 */
export async function getPinnedCommentId(postId: T3): Promise<T1 | null> {
  // First check if it's a drawing post
  const drawingData = await getDrawing(postId);
  if (drawingData?.pinnedCommentId) {
    return drawingData.pinnedCommentId as T1;
  }

  // If not a drawing post, check if it's a pinned post
  const { getPinnedPostCommentId } = await import('./pinned-post');
  return await getPinnedPostCommentId(postId);
}

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
    REDIS_KEYS.userDrawings(userId),
    0,
    limit - 1,
    { reverse: true, by: 'rank' }
  );

  return drawingIds.map((entry) => entry.member).filter(isT3);
}

export async function getUserDrawingsWithData(
  userId: T2,
  limit: number = 20
): Promise<DrawingPostDataExtended[]> {
  // Get drawing IDs
  const drawingIds = await redis.zRange(
    REDIS_KEYS.userDrawings(userId),
    0,
    limit - 1,
    { reverse: true, by: 'rank' }
  );

  const postIds = drawingIds.map((entry) => entry.member).filter(isT3);

  if (postIds.length === 0) return [];

  // Fetch all drawing data in parallel for maximum performance
  const drawingPromises = postIds.map(async (postId) => {
    const drawingData = await redis.hGetAll(REDIS_KEYS.drawing(postId));
    return { postId, drawingData };
  });

  const results = await Promise.all(drawingPromises);

  // Process results and filter out nulls
  const drawings: DrawingPostDataExtended[] = [];
  const validDrawings = results.filter(
    ({ drawingData }) => drawingData.type === 'drawing' && drawingData.drawing
  );

  // Batch all stats calls
  const statsPromises = validDrawings.map(({ postId }) =>
    getDrawingStats(postId)
  );
  const allStats = await Promise.all(statsPromises);

  // Combine data
  validDrawings.forEach(({ postId, drawingData }, index) => {
    const stats = allStats[index]!;
    drawings.push({
      postId,
      type: 'drawing',
      word: drawingData.word || '',
      dictionary: drawingData.dictionary || '',
      drawing: JSON.parse(drawingData.drawing || '{}'),
      authorId: drawingData.authorId as T2,
      authorName: drawingData.authorName || '',
      playerCount: stats.playerCount,
      solvedPercentage: stats.solvedPercentage,
    });
  });

  return drawings;
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
    redis.zScore(REDIS_KEYS.drawingSolves(postId), userId),
    redis.zScore(REDIS_KEYS.drawingSkips(postId), userId),
  ]);

  return solved !== null || skipped !== null;
}

/**
 * Get user's completion status for a specific drawing
 * @param postId - The post ID of the drawing to check
 * @param userId - The user ID to check
 * @returns Object with solved, skipped, and guessCount status
 */
export async function getUserDrawingStatus(
  postId: T3,
  userId: T2
): Promise<{
  solved: boolean;
  skipped: boolean;
  guessCount: number;
}> {
  const [solved, skipped, guessCount] = await Promise.all([
    redis.zScore(REDIS_KEYS.drawingSolves(postId), userId),
    redis.zScore(REDIS_KEYS.drawingSkips(postId), userId),
    redis.zScore(REDIS_KEYS.drawingAttempts(postId), userId),
  ]);

  return {
    solved: solved !== null,
    skipped: skipped !== null,
    guessCount: guessCount ?? 0,
  };
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
    redis.zScore(REDIS_KEYS.drawingSolves(postId), userId),
    redis.zScore(REDIS_KEYS.drawingSkips(postId), userId),
    redis.hGet(REDIS_KEYS.drawing(postId), 'word'),
    redis.hGet(REDIS_KEYS.drawing(postId), 'authorId'),
  ]);

  // Check if user exists in the sets
  const isInSolvedSet = solved != null;
  const isInSkippedSet = skipped != null;

  // Clean up inconsistent data - user shouldn't be in both solved and skipped
  if (isInSolvedSet && isInSkippedSet) {
    // Remove from skipped set (solved takes precedence)
    await redis.zRem(REDIS_KEYS.drawingSkips(postId), [userId]);
  }

  // Don't allow guesses if user has already solved (but allow if only skipped)
  if (!word || !authorId || !isT2(authorId) || isInSolvedSet) {
    return empty;
  }

  // Increment counters and store the guess
  await Promise.all([
    // Always increment user attempts (zIncrBy will add if not exists, increment if exists)
    redis.zIncrBy(REDIS_KEYS.drawingAttempts(postId), userId, 1),
    redis.zIncrBy(REDIS_KEYS.wordDrawings(word), postId, 1),
    redis.zIncrBy(
      REDIS_KEYS.drawingGuesses(postId),
      titleCase(guess.trim()),
      1
    ),
  ]);

  // Check if guess is correct (case-insensitive)
  const isCorrect = guess.toLowerCase().trim() === word.toLowerCase().trim();
  const channelName = `post-${postId}`;

  // Handle comment update cooldown logic for ALL guesses (not just correct ones)
  // NOTE: This logic has a potential race condition where concurrent guesses could
  // schedule multiple updates. Consider using Redis locks or atomic operations
  // for production at scale.
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
        // Silently ignore job cancellation errors
      }
    }

    // Schedule immediate update
    try {
      await scheduleCommentUpdate(postId, new Date(now));
    } catch (error) {
      // Silently ignore scheduling errors
    }
  } else if (!nextJobId) {
    // Within cooldown, no job scheduled - schedule one
    const nextUpdateTime = lastUpdateTime + ONE_MINUTE;
    try {
      await scheduleCommentUpdate(postId, new Date(nextUpdateTime));
    } catch (error) {
      // Silently ignore scheduling errors
    }
  }
  // else: Within cooldown AND job already scheduled - do nothing

  if (!isCorrect) {
    // Get updated stats for incorrect guess
    const updatedStats = await getGuesses(postId);

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
    redis.zAdd(REDIS_KEYS.drawingSolves(postId), {
      member: userId,
      score: Date.now(),
    }),

    // Award points
    incrementScore(userId, GUESSER_REWARD_SOLVE),

    // Award author points
    incrementScore(authorId, AUTHOR_REWARD_CORRECT_GUESS),
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
    redis.zCard(REDIS_KEYS.drawingSolves(postId)),
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
      redis.zCard(REDIS_KEYS.drawingAttempts(postId)),
      redis.zCard(REDIS_KEYS.drawingSolves(postId)),
      redis.zCard(REDIS_KEYS.drawingSkips(postId)),
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
 * Create a pinned comment for a drawing post
 * @param postId - The ID of the drawing post to create a comment for
 * @returns The created comment ID
 */
export async function createDrawingPostComment(postId: T3): Promise<T1> {
  const commentText = generateDrawingCommentText();

  const comment = await reddit.submitComment({
    text: commentText,
    id: postId,
  });

  // Pin the comment and save ID
  await comment.distinguish(true);
  await savePinnedCommentId(postId, comment.id);
  await saveLastCommentUpdate(postId, Date.now());

  return comment.id;
}

/**
 * Update a pinned comment for a drawing post with live stats
 * @param postId - The ID of the drawing post to update the comment for
 * @returns Promise that resolves when the comment is updated
 */
export async function updateDrawingPostComment(postId: T3): Promise<void> {
  // Get post data and stats
  const postData = await getDrawing(postId);
  if (!postData) {
    throw new Error(`Post data not found for ${postId}`);
  }

  const stats = await getDrawingCommentData(postId);
  const commentText = generateDrawingCommentText(stats);

  // Update the comment
  const comment = await reddit.getCommentById(
    postData.pinnedCommentId as `t1_${string}`
  );
  await comment.edit({ text: commentText });

  // Update timestamp
  await saveLastCommentUpdate(postId, Date.now());

  // Clear the scheduled job ID since we've executed the update
  await clearNextScheduledJobId(postId);
}

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
