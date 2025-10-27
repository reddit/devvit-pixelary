import type { T2, T3, T1 } from '@devvit/shared-types/tid.js';
import { reddit, redis, media, context } from '@devvit/web/server';
import type { MediaAsset } from '@devvit/web/server';
import { createPost } from '../core/post';
import { REDIS_KEYS } from './redis';
import { getRandomWords } from './dictionary';
import type { DrawingData } from '../../shared/schema';
import {
  TOURNAMENT_REWARD_VOTE,
  TOURNAMENT_REWARD_TOP_50,
  TOURNAMENT_REWARD_TOP_25,
} from '../../shared/constants';
import { incrementScore } from './progression';

// Elo rating constants
const ELO_K_FACTOR = 32;
const ELO_INITIAL_RATING = 1200;

/**
 * Calculate Elo rating change for winner and loser
 */
function calculateEloChange(
  winnerRating: number,
  loserRating: number
): { winnerChange: number; loserChange: number } {
  const expectedWinner =
    1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 - expectedWinner;

  return {
    winnerChange: Math.round(ELO_K_FACTOR * (1 - expectedWinner)),
    loserChange: Math.round(ELO_K_FACTOR * (0 - expectedLoser)),
  };
}

/**
 * Get Elo rating for a drawing
 */
async function getDrawingRating(postId: T3, commentId: T1): Promise<number> {
  const rating = await redis.zScore(
    REDIS_KEYS.tournamentRatings(postId),
    commentId
  );
  return rating ?? ELO_INITIAL_RATING;
}

/**
 * Get or generate the tournament word for a specific date
 * @param date - The date in YYYY-MM-DD format
 * @returns The word for that date
 */
export async function getTournamentWord(date: string): Promise<string> {
  const word = await redis.hGet(REDIS_KEYS.tournamentWord(date), 'word');
  if (word) {
    return word;
  }

  // Generate a random word if none exists
  const words = await getRandomWords(1);
  const selectedWord = words[0]!;

  await redis.hSet(REDIS_KEYS.tournamentWord(date), { word: selectedWord });
  await redis.expire(REDIS_KEYS.tournamentWord(date), 7 * 24 * 60 * 60); // 7 days TTL

  return selectedWord;
}

/**
 * Create a new tournament post
 * @param word - The word for the tournament
 * @param date - The date in YYYY-MM-DD format
 * @returns The created post
 */
export async function createTournamentPost(
  word: string,
  date: string
): Promise<T3> {
  const postData = {
    type: 'tournament' as const,
    word,
    date,
    dictionary: `r/${context.subredditName}`,
  };

  const post = await createPost(
    `Daily Tournament - ${word}`,
    postData,
    undefined
  );

  // Store mapping from date to post ID
  await redis.hSet(REDIS_KEYS.tournamentPost(date), { postId: post.id });
  await redis.expire(REDIS_KEYS.tournamentPost(date), 7 * 24 * 60 * 60);

  return post.id;
}

/**
 * Get tournament post ID for a specific date
 * @param date - The date in YYYY-MM-DD format
 * @returns The post ID or undefined if not found
 */
export async function getTournamentPostId(
  date: string
): Promise<string | undefined> {
  const data = await redis.hGet(REDIS_KEYS.tournamentPost(date), 'postId');
  return data;
}

/**
 * Get all tournament submissions for a post, filtering out deleted comments
 * @param postId - The tournament post ID
 * @returns Array of submission comment IDs that still exist
 */
export async function getTournamentSubmissions(postId: T3): Promise<T1[]> {
  // Get all comment IDs from sorted set
  const commentIds = await redis.zRange(
    REDIS_KEYS.tournamentSubmissions(postId),
    0,
    -1
  );

  // Validate each comment still exists
  const existingComments: T1[] = [];
  for (const item of commentIds) {
    const commentId = item.member as T1;
    try {
      await reddit.getCommentById(commentId);
      existingComments.push(commentId);
    } catch {
      // Comment was deleted, remove from Redis
      await redis.zRem(REDIS_KEYS.tournamentSubmissions(postId), [commentId]);
      await redis.del(REDIS_KEYS.tournamentCommentData(commentId));
    }
  }

  return existingComments;
}

/**
 * Validate if a comment exists (hasn't been deleted)
 * @param commentId - The comment ID to validate
 * @returns True if comment exists, false otherwise
 */
export async function validateCommentExists(commentId: T1): Promise<boolean> {
  try {
    await reddit.getCommentById(commentId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Submit a drawing as a comment to a tournament post
 * @param postId - The tournament post ID
 * @param userId - The user ID submitting the drawing
 * @param drawing - The drawing data
 * @param imageData - Base64 encoded image data
 * @returns The created comment ID
 */
export async function submitTournamentDrawing(
  postId: T3,
  userId: T2,
  drawing: DrawingData,
  imageData: string
): Promise<T1> {
  console.log(
    'submitTournamentDrawing called with postId:',
    postId,
    'userId:',
    userId
  );
  try {
    let response: MediaAsset;
    try {
      response = await media.upload({
        url: imageData,
        type: 'image',
      });
      console.log('Media uploaded successfully');
    } catch (mediaError) {
      console.error('Media upload failed:', mediaError);
      const mediaErrorMessage =
        mediaError instanceof Error ? mediaError.message : String(mediaError);
      throw new Error(`Failed to upload image: ${mediaErrorMessage}`);
    }

    let comment;
    try {
      comment = await reddit.submitComment({
        text: `[My submission](${response.mediaUrl})`,
        id: postId,
        runAs: 'USER',
      });
      console.log('Comment submitted successfully:', comment.id);
    } catch (commentError) {
      console.error('Comment submission failed:', commentError);
      const commentErrorMessage =
        commentError instanceof Error
          ? commentError.message
          : String(commentError);
      throw new Error(`Failed to submit comment: ${commentErrorMessage}`);
    }

    const promises: Promise<unknown>[] = [];

    // Store comment ID in sorted set
    const submissionsKey = REDIS_KEYS.tournamentSubmissions(postId);
    const ratingsKey = REDIS_KEYS.tournamentRatings(postId);
    console.log('Storing to Redis keys:', {
      submissionsKey,
      ratingsKey,
      commentId: comment.id,
    });

    promises.push(
      redis.zAdd(submissionsKey, {
        member: comment.id,
        score: Date.now(),
      })
    );

    // Initialize Elo rating
    promises.push(
      redis.zAdd(ratingsKey, {
        member: comment.id,
        score: ELO_INITIAL_RATING,
      })
    );

    // Store comment data
    promises.push(
      redis.hSet(REDIS_KEYS.tournamentCommentData(comment.id), {
        postId,
        userId,
        drawing: JSON.stringify(drawing),
      })
    );

    // Store user's submission for this post
    promises.push(
      redis.hSet(REDIS_KEYS.tournamentUserSubmission(postId, userId), {
        commentId: comment.id,
      })
    );

    await Promise.all(promises);
    console.log('All data stored to Redis successfully');

    return comment.id;
  } catch (error) {
    console.error('Failed to submit tournament drawing:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to submit tournament drawing: ${errorMessage}`);
  }
}

/**
 * Record a vote between two drawings
 * @param postId - The tournament post ID
 * @param userId - The user casting the vote
 * @param winnerCommentId - The comment ID of the winning drawing
 * @param loserCommentId - The comment ID of the losing drawing
 */
export async function recordVote(
  postId: T3,
  userId: T2,
  winnerCommentId: T1,
  loserCommentId: T1
): Promise<void> {
  // Award points for voting
  await incrementScore(userId, TOURNAMENT_REWARD_VOTE);

  // Increment vote count for winner
  await redis.zIncrBy(
    REDIS_KEYS.tournamentSubmissions(postId),
    winnerCommentId,
    1
  );

  // Update Elo ratings
  const [winnerRating, loserRating] = await Promise.all([
    getDrawingRating(postId, winnerCommentId),
    getDrawingRating(postId, loserCommentId),
  ]);

  const { winnerChange, loserChange } = calculateEloChange(
    winnerRating,
    loserRating
  );

  await Promise.all([
    redis.zAdd(REDIS_KEYS.tournamentRatings(postId), {
      member: winnerCommentId,
      score: winnerRating + winnerChange,
    }),
    redis.zAdd(REDIS_KEYS.tournamentRatings(postId), {
      member: loserCommentId,
      score: loserRating + loserChange,
    }),
  ]);
}

/**
 * Get tournament statistics
 * @param postId - The tournament post ID
 * @returns Statistics object
 */
export async function getTournamentStats(postId: T3): Promise<{
  submissionCount: number;
  voteCount: number;
  playerCount: number;
}> {
  const submissions = await redis.zCard(
    REDIS_KEYS.tournamentSubmissions(postId)
  );

  // Calculate total vote count (each vote increments the score)
  const items = await redis.zRange(
    REDIS_KEYS.tournamentSubmissions(postId),
    0,
    -1
  );

  const voteCount = items.reduce((sum, item) => {
    // Score is number of votes
    return sum + (item.score > 0 ? item.score : 0);
  }, 0);

  // Count unique players by checking user IDs in comment data
  const userIds = new Set<T2>();
  for (const item of items) {
    const commentId = item.member as T1;
    const data = await redis.hGetAll(
      REDIS_KEYS.tournamentCommentData(commentId)
    );
    if (data.userId) {
      userIds.add(data.userId as T2);
    }
  }

  return {
    submissionCount: submissions,
    voteCount,
    playerCount: userIds.size,
  };
}

/**
 * Get a random pair of submissions for voting
 * @param postId - The tournament post ID
 * @returns Array of two random submission comment IDs
 */
export async function getRandomPair(postId: T3): Promise<[T1, T1]> {
  const submissions = await getTournamentSubmissions(postId);

  if (submissions.length < 2) {
    throw new Error('Not enough submissions for voting');
  }

  // Select two random submissions
  const shuffled = [...submissions].sort(() => Math.random() - 0.5);
  const first = shuffled[0];
  const second = shuffled[1];

  if (!first || !second) {
    throw new Error('Failed to select random submissions');
  }

  return [first, second];
}

/**
 * Check if user has already submitted to this tournament
 * @param postId - The tournament post ID
 * @param userId - The user ID to check
 * @returns Comment ID if submitted, undefined otherwise
 */
export async function getUserSubmission(
  postId: T3,
  userId: T2
): Promise<T1 | undefined> {
  const data = await redis.hGet(
    REDIS_KEYS.tournamentUserSubmission(postId, userId),
    'commentId'
  );
  return data as T1 | undefined;
}

/**
 * Get drawing data from a comment ID
 * @param commentId - The comment ID
 * @returns The drawing data and metadata
 */
export async function getCommentDrawing(commentId: T1): Promise<
  | {
      drawing: DrawingData;
      userId: T2;
      postId: T3;
    }
  | undefined
> {
  const key = REDIS_KEYS.tournamentCommentData(commentId);
  console.log('getCommentDrawing: Fetching from key:', key);
  const data = await redis.hGetAll(key);
  console.log('getCommentDrawing: Raw data from Redis:', data);

  if (!data.drawing || !data.userId || !data.postId) {
    console.log('getCommentDrawing: Missing required fields');
    return undefined;
  }

  try {
    const parsedDrawing = JSON.parse(data.drawing) as DrawingData;
    console.log('getCommentDrawing: Parsed drawing:', {
      hasColors: !!parsedDrawing.colors,
      hasData: !!parsedDrawing.data,
      size: parsedDrawing.size,
    });
    return {
      drawing: parsedDrawing,
      userId: data.userId as T2,
      postId: data.postId as T3,
    };
  } catch (error) {
    console.error('getCommentDrawing: Failed to parse drawing:', error);
    return undefined;
  }
}

/**
 * Get Elo rating for a comment
 * @param postId - The tournament post ID
 * @param commentId - The comment ID
 * @returns The Elo rating
 */
export async function getCommentRating(
  postId: T3,
  commentId: T1
): Promise<number> {
  return await getDrawingRating(postId, commentId);
}

/**
 * Award tournament placement rewards
 * @param postId - The tournament post ID
 */
export async function awardTournamentRewards(postId: T3): Promise<void> {
  const submissions = await getTournamentSubmissions(postId);

  if (submissions.length === 0) return;

  // Get scores for each submission
  const scores = await redis.zRange(
    REDIS_KEYS.tournamentSubmissions(postId),
    0,
    -1
  );

  if (scores.length === 0) return;

  const sortedByScore = scores.sort((a, b) => b.score - a.score);
  const totalParticipants = sortedByScore.length;

  // Top 50% get base reward
  const top50Cutoff = Math.floor(totalParticipants / 2);
  const top25Cutoff = Math.floor(totalParticipants / 4);

  for (let i = 0; i < sortedByScore.length; i++) {
    const item = sortedByScore[i];
    if (!item) continue;

    const commentId = item.member as T1;
    const commentData = await getCommentDrawing(commentId);

    if (!commentData) continue;

    const userId = commentData.userId;
    let reward = 0;

    if (i < top50Cutoff) {
      reward = TOURNAMENT_REWARD_TOP_50;

      if (i < top25Cutoff) {
        reward += TOURNAMENT_REWARD_TOP_25; // Additional 100 for top 25%
      }
    }

    if (reward > 0) {
      await incrementScore(userId, reward);
    }
  }
}
