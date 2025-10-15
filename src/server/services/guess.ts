import { redis } from '@devvit/web/server';
import { RedisKeyFactory } from './redis-factory';
import { awardCorrectGuess, awardAuthorForSolve } from './leaderboard';
import {
  markPostSolved,
  incrementUserGuessCount,
  hasUserSolvedPost,
} from './user';
import { getDrawingPost } from './drawing-post';
import { trackWordGuess, trackWordSolve } from './dictionary';
import type { GuessResult, PostGuesses } from '../../shared/schema/pixelary';

/**
 * Guess handling service for Pixelary
 * Processes guesses, checks correctness, and manages scoring
 */

export async function submitGuess(
  postId: string,
  username: string,
  guess: string,
  createComment: boolean,
  context?: {
    scheduler?: {
      runJob: (params: {
        name: string;
        data: unknown;
        runAt?: Date;
      }) => Promise<void>;
    };
    reddit?: {
      submitComment: (params: {
        id: string;
        text: string;
      }) => Promise<{ id: string }>;
    };
    realtime?: { send: (channel: string, message: unknown) => Promise<void> };
  }
): Promise<GuessResult> {
  try {
    // Check if user already solved this post
    const alreadySolved = await hasUserSolvedPost(username, postId);
    if (alreadySolved) {
      return {
        correct: false,
        points: 0,
        isFirstSolve: false,
        totalSolves: 0,
      };
    }

    // Get post data to check the word
    const postData = await getDrawingPost(postId);
    if (!postData) {
      return {
        correct: false,
        points: 0,
        isFirstSolve: false,
        totalSolves: 0,
      };
    }

    // Increment guess count
    await incrementUserGuessCount(username, postId);

    // Track word guess stat
    await trackWordGuess(
      postData.dictionaryName.replace('r/', ''),
      postData.word
    );

    // Check if guess is correct (case-insensitive)
    const isCorrect =
      guess.toLowerCase().trim() === postData.word.toLowerCase().trim();

    if (!isCorrect) {
      // Record incorrect guess
      await recordGuess(postId, guess);

      // Broadcast guess event to all clients watching this post
      if (context?.realtime) {
        try {
          const channelName = `post-${postId}-guesses`;
          // Get updated stats to include in the message
          const updatedStats = await getGuessStats(postId, { postData });
          await context.realtime.send(channelName, {
            type: 'guess_submitted',
            postId,
            correct: false,
            timestamp: Date.now(),
            stats: updatedStats,
          });
        } catch (error) {
          console.error(`Error broadcasting guess event for ${postId}:`, error);
        }
      } else {
        console.log('No realtime context available for broadcasting');
      }

      return {
        correct: false,
        points: 0,
        isFirstSolve: false,
        totalSolves: await getSolveCount(postId),
      };
    }

    // Correct guess - check if first solve
    const solveCount = await getSolveCount(postId);
    const isFirstSolve = solveCount === 0;

    // Mark as solved
    await markPostSolved(username, postId);

    // Track word solve stat
    await trackWordSolve(
      postData.dictionaryName.replace('r/', ''),
      postData.word
    );

    // Broadcast guess event to all clients watching this post
    if (context?.realtime) {
      try {
        const channelName = `post-${postId}-guesses`;
        // Get updated stats to include in the message
        const updatedStats = await getGuessStats(postId, { postData });
        await context.realtime.send(channelName, {
          type: 'guess_submitted',
          postId,
          correct: true,
          isFirstSolve,
          timestamp: Date.now(),
          stats: updatedStats,
        });
      } catch (error) {
        console.error(`Error broadcasting guess event for ${postId}:`, error);
      }
    } else {
      console.log('No realtime context available for broadcasting');
    }

    // Award points
    const guesserPoints = await awardCorrectGuess(
      username,
      isFirstSolve,
      context
    );

    // Award author points
    await awardAuthorForSolve(postData.authorUsername, context);

    // Create comment if requested and context available
    if (createComment && context?.reddit) {
      await createGuessComment(
        postId,
        username,
        guess,
        isFirstSolve,
        context.reddit
      );
    }

    // Schedule first solve comment job if first solve
    if (isFirstSolve && context?.scheduler) {
      await context.scheduler.runJob({
        name: 'FIRST_SOLVE_COMMENT',
        data: {
          postId,
          solverUsername: username,
          word: postData.word,
          authorUsername: postData.authorUsername,
        },
        runAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes delay
      });
    }

    // Schedule smart comment update
    if (context?.scheduler) {
      const now = Date.now();
      const lastUpdate = postData.lastCommentUpdate || 0;
      const timeSinceUpdate = now - lastUpdate;
      const FIVE_MINUTES = 5 * 60 * 1000;
      const THIRTY_SECONDS = 30 * 1000;

      // Immediate update on first solve
      if (isFirstSolve) {
        await context.scheduler.runJob({
          name: 'UPDATE_DRAWING_PINNED_COMMENT',
          data: { postId },
          runAt: new Date(now + 1000), // 1 second (effectively immediate)
        });
      }
      // Forced update if >5min since last update (prevents staleness)
      else if (timeSinceUpdate > FIVE_MINUTES) {
        await context.scheduler.runJob({
          name: 'UPDATE_DRAWING_PINNED_COMMENT',
          data: { postId },
          runAt: new Date(now + 1000),
        });
      }
      // Otherwise debounced update (30s)
      else {
        await context.scheduler.runJob({
          name: 'UPDATE_DRAWING_PINNED_COMMENT',
          data: { postId },
          runAt: new Date(now + THIRTY_SECONDS),
        });
      }
    }

    return {
      correct: true,
      points: guesserPoints,
      isFirstSolve,
      totalSolves: solveCount + 1,
    };
  } catch (error) {
    console.error(`Error submitting guess for ${username}:`, error);
    return {
      correct: false,
      points: 0,
      isFirstSolve: false,
      totalSolves: 0,
    };
  }
}

export async function getGuessStats(
  postId: string,
  context?: { postData?: { authorUsername?: string } }
): Promise<
  PostGuesses & {
    authorUsername?: string | null;
    topGuesses: Array<{ word: string; count: number; percentage: string }>;
    solves: number;
    skips: number;
  }
> {
  const guessesKey = RedisKeyFactory.postGuessesKey(postId);
  const solvedKey = RedisKeyFactory.postSolvedKey(postId);
  const skippedKey = RedisKeyFactory.postSkippedKey(postId);

  try {
    const [guesses, solveCount, skipCount, playerCount] = await Promise.all([
      redis.zRange(guessesKey, 0, -1, { reverse: true, by: 'rank' }),
      redis.zCard(solvedKey),
      redis.zCard(skippedKey),
      redis.zCard(RedisKeyFactory.postUserGuessCounterKey(postId)),
    ]);

    // Get post data from context
    const postData = context?.postData || {};

    // Convert guesses to object
    const guessesObj: Record<string, number> = {};
    let totalGuesses = 0;

    for (const guess of guesses) {
      const word = guess.member as string;
      const count = guess.score;
      guessesObj[word] = count;
      totalGuesses += count;
    }

    // Get top 50 guesses with percentages
    const topGuesses = guesses.slice(0, 50).map((guess) => {
      const word = guess.member as string;
      const count = guess.score;
      const percentage =
        totalGuesses > 0 ? ((count / totalGuesses) * 100).toFixed(1) : '0.0';

      return {
        word,
        count,
        percentage,
      };
    });

    // Get author username directly from post data
    const authorUsername = postData.authorUsername || null;

    return {
      guesses: guessesObj,
      wordCount: Object.keys(guessesObj).length,
      guessCount: totalGuesses,
      playerCount: playerCount,
      authorUsername,
      topGuesses,
      solves: solveCount,
      skips: skipCount,
    };
  } catch (error) {
    console.error(`Error fetching guess stats for ${postId}:`, error);
    return {
      guesses: {},
      wordCount: 0,
      guessCount: 0,
      playerCount: 0,
      authorUsername: null,
      topGuesses: [],
      solves: 0,
      skips: 0,
    };
  }
}

export async function recordGuess(
  postId: string,
  guess: string
): Promise<void> {
  const key = RedisKeyFactory.postGuessesKey(postId);
  const normalizedGuess = guess.toLowerCase().trim();

  try {
    await redis.zIncrBy(key, normalizedGuess, 1);
  } catch (error) {
    console.error(`Error recording guess for ${postId}:`, error);
  }
}

export async function getSolveCount(postId: string): Promise<number> {
  const key = RedisKeyFactory.postSolvedKey(postId);

  try {
    return await redis.zCard(key);
  } catch (error) {
    console.error(`Error fetching solve count for ${postId}:`, error);
    return 0;
  }
}

export async function saveGuessComment(
  postId: string,
  guess: string,
  commentId: string
): Promise<boolean> {
  const key = RedisKeyFactory.guessCommentsKey(postId);
  const normalizedGuess = guess.toLowerCase().trim();

  try {
    // Get existing comments for this guess
    const existingComments = await redis.hGet(key, normalizedGuess);
    let comments: string[] = [];

    if (existingComments) {
      try {
        comments = JSON.parse(existingComments);
      } catch {
        comments = [existingComments];
      }
    }

    // Add new comment ID
    comments.push(commentId);

    // Save back
    await redis.hSet(key, { [normalizedGuess]: JSON.stringify(comments) });
    return true;
  } catch (error) {
    console.error(`Error saving guess comment for ${postId}:`, error);
    return false;
  }
}

export async function getGuessComments(
  postId: string
): Promise<Record<string, string[]>> {
  const key = RedisKeyFactory.guessCommentsKey(postId);

  try {
    const comments = await redis.hGetAll(key);
    const result: Record<string, string[]> = {};

    for (const [guess, commentIds] of Object.entries(comments)) {
      try {
        result[guess] = JSON.parse(commentIds);
      } catch {
        result[guess] = [commentIds];
      }
    }

    return result;
  } catch (error) {
    console.error(`Error fetching guess comments for ${postId}:`, error);
    return {};
  }
}

export async function removeGuessComment(
  postId: string,
  commentId: string
): Promise<boolean> {
  const key = RedisKeyFactory.guessCommentsKey(postId);

  try {
    const comments = await redis.hGetAll(key);

    for (const [guess, commentIds] of Object.entries(comments)) {
      try {
        const ids = JSON.parse(commentIds);
        const filteredIds = ids.filter((id: string) => id !== commentId);

        if (filteredIds.length === 0) {
          await redis.hDel(key, [guess]);
        } else {
          await redis.hSet(key, { [guess]: JSON.stringify(filteredIds) });
        }
      } catch {
        // If parsing fails, remove the entire entry
        await redis.hDel(key, [guess]);
      }
    }

    return true;
  } catch (error) {
    console.error(`Error removing guess comment for ${postId}:`, error);
    return false;
  }
}

async function createGuessComment(
  postId: string,
  username: string,
  guess: string,
  isFirstSolve: boolean,
  reddit: {
    submitComment: (params: {
      id: string;
      text: string;
    }) => Promise<{ id: string }>;
  }
): Promise<void> {
  try {
    const commentText = isFirstSolve
      ? `🎉 First solve! Great job u/${username}!`
      : `✅ Correct! Nice work u/${username}!`;

    const comment = await reddit.submitComment({
      id: postId,
      text: commentText,
    });

    // Save comment ID for tracking
    await saveGuessComment(postId, guess, comment.id);
  } catch (error) {
    console.error(`Error creating guess comment for ${postId}:`, error);
  }
}

export async function getTopGuesses(
  postId: string,
  limit: number = 10
): Promise<Array<{ word: string; count: number }>> {
  const key = RedisKeyFactory.postGuessesKey(postId);

  try {
    const guesses = await redis.zRange(key, 0, limit - 1, {
      reverse: true,
      by: 'rank',
    });

    return guesses.map((guess) => ({
      word: guess.member as string,
      count: guess.score,
    }));
  } catch (error) {
    console.error(`Error fetching top guesses for ${postId}:`, error);
    return [];
  }
}

export async function getUserGuessHistory(
  _username: string,
  _limit: number = 20
): Promise<
  Array<{
    postId: string;
    guess: string;
    correct: boolean;
    timestamp: number;
  }>
> {
  // This would require storing user guess history
  // For now, return empty array as this wasn't in the original implementation
  return [];
}
