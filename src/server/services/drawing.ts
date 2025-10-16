import { redis, scheduler, realtime } from '@devvit/web/server';
import { incrementScore } from './progression';
import type { DrawingPostDataExtended } from '../../shared/schema/pixelary';
import { createPost } from '../core/post';
import type { DrawingData } from '../../shared/schema/drawing';
import { PIXELARY_CONFIG } from '../../shared/constants';
import { parseT2, type T1, type T2, type T3 } from '../../shared/types/TID';

/*
 * Redis keys
 */

// Hash map with drawing data
const drawingKey = (postId: T3) => `drawing:${postId}`;

// Sorted set tracking the number of guesses for each user for a drawing
const attemptsForDrawingKey = (postId: T3) => `drawing-attempts:${postId}`;

// Sorted set tracking all users who have skipped a drawing
const skipsForDrawingKey = (postId: T3) => `drawing-skips:${postId}`;

// Sorted set tracking all users who have solved a drawing
const solvesForDrawingKey = (postId: T3) => `drawing-solved:${postId}`;

// Sorted set tracking all drawings
const drawingsKey = 'drawings';

// Sorted set tracking all drawings by user
const drawingsByUserKey = (userId: T2) => `drawings-by-user:${userId}`;

// Sorted set tracking all drawings for a word
const drawingsForWordKey = (word: string) => `drawings-for-word:${word}`;

// Sorted set tracking all guesses for a drawing
const guessesForDrawingKey = (postId: T3) => `drawing-guesses:${postId}`;

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
    await redis.hSet(drawingKey(postId), {
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
    await incrementScore(
      authorId,
      PIXELARY_CONFIG.rewards.authorRewardForSubmit
    ),

    // Schedule pinned comment job
    await scheduler.runJob({
      name: 'NEW_DRAWING_PINNED_COMMENT',
      data: {
        postId,
        authorName,
        word,
      },
      runAt: currentDate, // run immediately
    }),

    // Add to list of drawings for this word
    await redis.zAdd(drawingsForWordKey(word), {
      member: postId,
      score: currentTime,
    }),

    // Add to all drawings list
    await redis.zAdd(drawingsKey, {
      member: postId,
      score: currentTime,
    }),

    // Add to list of drawings for this user
    await redis.zAdd(drawingsByUserKey(authorId), {
      member: postId,
      score: currentTime,
    }),
  ]);

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
  const key = drawingKey(postId);

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
  const key = skipsForDrawingKey(postId);
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
  const key = attemptsForDrawingKey(postId);
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
    redis.zCard(attemptsForDrawingKey(postId)),
    redis.zCard(solvesForDrawingKey(postId)),
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
  const key = drawingKey(postId);
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
  const key = drawingKey(postId);
  await redis.hSet(key, {
    lastCommentUpdate: updatedAt.toString(),
  });
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
    redis.zScore(solvesForDrawingKey(postId), userId),
    redis.zScore(skipsForDrawingKey(postId), userId),
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
    redis.hGet(drawingKey(postId), 'word'),
    redis.hGet(drawingKey(postId), 'authorId'),
  ]);
  if (!word || !authorId || alreadySolved) return empty;

  // Increment counters
  const [updatedStats, _userAttempts, _wordAttempts] = await Promise.all([
    getGuesses(postId),
    redis.zIncrBy(attemptsForDrawingKey(postId), userId, 1),
    redis.zIncrBy(drawingsForWordKey(word), postId, 1),
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
    await redis.zAdd(solvesForDrawingKey(postId), {
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
    await incrementScore(userId, PIXELARY_CONFIG.rewards.guesserRewardForSolve),

    // Award author points
    await incrementScore(
      parseT2(authorId),
      PIXELARY_CONFIG.rewards.authorRewardForCorrectGuess
    ),

    // Schedule debounced update (30s)
    await scheduler.runJob({
      name: 'UPDATE_DRAWING_PINNED_COMMENT',
      data: { postId },
      runAt: new Date(now + THIRTY_SECONDS),
    }),
  ]);

  return {
    correct: true,
    points: PIXELARY_CONFIG.rewards.guesserRewardForSolve,
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
      .zRange(guessesForDrawingKey(postId), 0, limit - 1, {
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
