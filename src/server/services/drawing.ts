import { redis, scheduler, realtime } from '@devvit/web/server';
import { incrementScore } from './progression';
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
  return {
    playerCount,
    solvedPercentage:
      playerCount === 0
        ? 0
        : Math.round((solvedCount / playerCount) * 100 * 10) / 10,
  };
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

  // Check if user already solved this post and get the word
  const [alreadySolved, word, authorId] = await Promise.all([
    hasCompletedDrawing(postId, userId),
    redis.hGet(REDIS_KEYS.drawing(postId), 'word'),
    redis.hGet(REDIS_KEYS.drawing(postId), 'authorId'),
  ]);
  if (!word || !authorId || alreadySolved) return empty;

  // Increment counters
  const [updatedStats, _userAttempts, _wordAttempts] = await Promise.all([
    getGuesses(postId),
    redis.zIncrBy(REDIS_KEYS.userAttempts(postId), userId, 1),
    redis.zIncrBy(REDIS_KEYS.drawingsByWord(word), postId, 1),
  ]);

  // Check if guess is correct (case-insensitive)
  const isCorrect = guess.toLowerCase().trim() === word.toLowerCase().trim();
  const channelName = `post-${postId}`;

  if (!isCorrect) {
    // Broadcast guess event to all clients watching this post
    // Get updated stats to include in the message
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

  // Schedule smart comment update
  const now = Date.now();
  const THIRTY_SECONDS = 30 * 1000;

  await Promise.all([
    // Mark as solved
    await redis.zAdd(REDIS_KEYS.userSolved(postId), {
      member: userId,
      score: Date.now(),
    }),

    // Get updated stats to include in the message
    await realtime.send(channelName, {
      type: 'guess_submitted',
      postId,
      correct: true,
      timestamp: Date.now(),
      stats: updatedStats,
    }),

    // Award points
    await incrementScore(userId, GUESSER_REWARD_SOLVE),

    // Award author points
    await incrementScore(parseT2(authorId), AUTHOR_REWARD_CORRECT_GUESS),

    // Schedule debounced update (30s)
    await scheduler.runJob({
      name: 'UPDATE_DRAWING_PINNED_COMMENT',
      data: { postId },
      runAt: new Date(now + THIRTY_SECONDS),
    }),
  ]);

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
  guesses: WordGuessEntry[];
  playerCount: number;
  solvedPercentage: number;
}> {
  const [guesses, stats] = await Promise.all([
    redis
      .zRange(REDIS_KEYS.drawingGuesses(postId), 0, limit - 1, {
        reverse: true,
        by: 'rank',
      })
      .then((guesses) =>
        guesses.map((guess, index) => ({
          word: guess.member,
          count: guess.score,
          rank: index + 1,
        }))
      ),
    getDrawingStats(postId),
  ]);

  return {
    guesses,
    playerCount: stats.playerCount,
    solvedPercentage: stats.solvedPercentage,
  };
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
  const [
    playerCount,
    solvedCount,
    skippedCount,
    wordCount,
    guessCount,
    guesses,
  ] = await Promise.all([
    redis.zCard(REDIS_KEYS.userAttempts(postId)),
    redis.zCard(REDIS_KEYS.userSolved(postId)),
    redis.zCard(REDIS_KEYS.userSkipped(postId)),
    redis.zCard(REDIS_KEYS.drawingGuesses(postId)),
    redis.hGet(REDIS_KEYS.drawing(postId), 'guessCount'),
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

  return {
    solves: solvedCount,
    solvedPercentage,
    skips: skippedCount,
    skipPercentage,
    wordCount,
    guessCount: guessCount ? parseInt(guessCount) : 0,
    playerCount,
    guesses: guessesParsed,
  };
}
