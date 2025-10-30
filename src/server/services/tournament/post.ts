import type { T2, T3, T1 } from '@devvit/shared-types/tid.js';
import {
  reddit,
  redis,
  media,
  context,
  scheduler,
  cache,
} from '@devvit/web/server';
import type { MediaAsset } from '@devvit/web/server';
import { createPost, setPostFlair } from '../../core';
import { REDIS_KEYS, acquireLock, releaseLock, isRateLimited } from '../redis';
import { getRandomWords } from '../words/dictionary';
import type { DrawingData, TournamentPostData } from '../../../shared/schema';
import {
  TOURNAMENT_REWARD_VOTE,
  TOURNAMENT_REWARD_WINNER,
  TOURNAMENT_REWARD_TOP_10,
  TOURNAMENT_ELO_INITIAL_RATING,
} from '../../../shared/constants';
import { calculateEloChange } from './elo';
import { incrementScore } from '../progression';
import { normalizeWord } from '../../../shared/utils/string';

export type TournamentDrawing = {
  commentId: T1;
  drawing: DrawingData;
  userId: T2;
  postId: T3;
  votes: number;
  views: number;
  mediaUrl: string;
  mediaId: string;
};

/**
 * Create a new tournament post
 * @param word - Optional word for the tournament. If not provided, a random word will be selected.
 * @returns The created post ID
 */
export async function createTournament(word?: string): Promise<T3> {
  // Use provided word or get a random one
  let tournamentWord = word ? normalizeWord(word) : undefined;
  if (!tournamentWord || tournamentWord.trim() === '') {
    const words = await getRandomWords(1);
    tournamentWord = words[0]!;
  }

  const postData: TournamentPostData = {
    type: 'tournament',
    word: tournamentWord,
  };

  const tournamentIndex = await redis.incrBy(
    REDIS_KEYS.tournamentsCounter(),
    1
  );

  const post = await createPost(
    `Drawing Tournament #${tournamentIndex}: ${tournamentWord}`,
    postData
  );
  if (!post) {
    throw new Error('Failed to create tournament post');
  }

  // Apply tournament flair
  await setPostFlair(post.id, context.subredditName, 'tournament');

  await Promise.all([
    // Store tournament post data
    redis.hSet(REDIS_KEYS.tournament(post.id), {
      ...postData,
      createdAt: post.createdAt.getTime().toString(),
      votes: '0',
    }),

    // Store tournament post in all tournaments list
    redis.zAdd(REDIS_KEYS.tournaments(), {
      member: post.id,
      score: post.createdAt.getTime(),
    }),
  ]);

  // Schedule pinned comment creation
  try {
    await scheduler.runJob({
      name: 'CREATE_TOURNAMENT_POST_COMMENT',
      data: { postId: post.id },
      runAt: new Date(), // Run immediately
    });
  } catch (error) {
    console.error(
      'Failed to schedule tournament pinned comment creation:',
      error
    );
    // Don't throw - post was created successfully, comment can be created manually
  }

  return post.id;
}

/**
 * Get details about a tournament post
 */
export async function getTournament(postId: T3): Promise<{
  word: string;
  type: string;
  submissionCount: number;
  voteCount: number;
  playerCount: number;
}> {
  return await cache(
    async () => {
      const [data, submissionCount, playerCount] = await Promise.all([
        redis.hGetAll(REDIS_KEYS.tournament(postId)),
        redis.zCard(REDIS_KEYS.tournamentEntries(postId)),
        redis.zCard(REDIS_KEYS.tournamentPlayers(postId)),
      ]);

      return {
        word: data.word || '',
        type: data.type || '',
        submissionCount,
        voteCount: parseInt(data.votes || '0'),
        playerCount,
      };
    },
    {
      key: `tournament:stats:${postId}`,
      ttl: 10, // short TTL; UI also refetches on demand
    }
  );
}

/**
 * Get the Elo rating for a drawing
 */
export async function getEntryRating(
  postId: T3,
  commentId: T1
): Promise<number> {
  const rating = await redis.zScore(
    REDIS_KEYS.tournamentEntries(postId),
    commentId
  );
  return rating ?? TOURNAMENT_ELO_INITIAL_RATING;
}

/**
 * Get all active entries for a tournament post
 * @param postId - The tournament post ID
 * @returns Array of submission comment IDs that still exist
 */
export async function getTournamentEntries(postId: T3): Promise<T1[]> {
  // Get all comment IDs from sorted set
  const commentIds = await redis.zRange(
    REDIS_KEYS.tournamentEntries(postId),
    0,
    -1
  );

  return commentIds.map((item) => item.member as T1);
}

/**
 * Submit a drawing submission as a comment to a tournament post
 * @param drawing - The drawing data
 * @param imageData - Base64 encoded image data
 * @param tournamentPostId - The tournament post ID (optional, falls back to context.postId)
 * @returns The `commentId` of the submitted entry
 */
export async function submitTournamentEntry(
  drawing: DrawingData,
  imageData: string,
  tournamentPostId?: T3
): Promise<T1> {
  const postId = tournamentPostId || context.postId!;
  // Rate limit submissions per-user (2 per 10s)
  if (await isRateLimited(REDIS_KEYS.rateSubmit(context.userId!), 2, 10)) {
    throw new Error('Too many submissions, slow down');
  }
  // Upload drawing image to Reddit's media service
  let response: MediaAsset;
  try {
    response = await media.upload({
      url: imageData,
      type: 'image',
    });
  } catch (mediaError) {
    const mediaErrorMessage =
      mediaError instanceof Error ? mediaError.message : String(mediaError);
    throw new Error(`Failed to upload image: ${mediaErrorMessage}`);
  }

  // Submit comment
  const comment = await reddit.submitComment({
    text: `[My submission](${response.mediaUrl})`,
    id: postId,
    runAs: 'USER',
  });
  if (!comment) {
    throw new Error('Failed to submit comment');
  }

  const entryKey = REDIS_KEYS.tournamentEntry(comment.id);
  const entryData = {
    postId: postId,
    userId: context.userId!,
    commentId: comment.id,
    drawing: JSON.stringify(drawing),
    mediaUrl: response.mediaUrl,
    mediaId: response.mediaId,
    votes: '0',
    views: '0',
  };

  const sortedSetKey = REDIS_KEYS.tournamentEntries(postId);

  await Promise.all([
    // Add entry to tournament entries sorted set
    redis.zAdd(sortedSetKey, {
      member: comment.id,
      score: TOURNAMENT_ELO_INITIAL_RATING,
    }),
    // Store entry data in tournament entry hash
    redis.hSet(entryKey, entryData),
    // Add user to tournament players set
    redis.zIncrBy(REDIS_KEYS.tournamentPlayers(postId), context.userId!, 1),
  ]);

  return comment.id;
}

/**
 * Record a tournament vote between two drawing entries
 * @param winnerId - The commentId of the winning drawing entry
 * @param loserId - The commentId of the losing drawing entry
 */
export async function tournamentVote(winnerId: T1, loserId: T1): Promise<void> {
  // Get postId and userId from context
  const { postId, userId } = context;
  if (!postId || !userId) {
    throw new Error('Must be in a tournament post and logged in');
  }

  // Per-user rate limiting (3 ops/sec)
  if (await isRateLimited(REDIS_KEYS.rateVote(userId), 3, 1)) {
    return;
  }

  // First batch of operations
  const [winnerRating, loserRating, _score, _playerCount, _votes] =
    await Promise.all([
      // Get current rating for winner and loser
      getEntryRating(postId, winnerId),
      getEntryRating(postId, loserId),
      // Award points for voting
      incrementScore(userId, TOURNAMENT_REWARD_VOTE),
      // Update player count
      redis.zIncrBy(REDIS_KEYS.tournamentPlayers(postId), userId, 1),
      // Update vote count
      redis.hIncrBy(REDIS_KEYS.tournament(postId), 'votes', 1),
      redis.hIncrBy(REDIS_KEYS.tournamentEntry(winnerId), 'votes', 1),
    ]);

  // Calculate and apply Elo rating changes atomically using a short-lived lock
  const eloLockKey = REDIS_KEYS.tournamentEloLock(postId);
  const gotLock = await acquireLock(eloLockKey, 2);
  try {
    if (gotLock) {
      // Re-read ratings inside lock for latest values
      const [latestWinner, latestLoser] = await Promise.all([
        getEntryRating(postId, winnerId),
        getEntryRating(postId, loserId),
      ]);
      const { winnerChange, loserChange } = calculateEloChange(
        latestWinner,
        latestLoser
      );
      await Promise.all([
        redis.zAdd(REDIS_KEYS.tournamentEntries(postId), {
          member: winnerId,
          score: latestWinner + winnerChange,
        }),
        redis.zAdd(REDIS_KEYS.tournamentEntries(postId), {
          member: loserId,
          score: latestLoser + loserChange,
        }),
      ]);
    } else {
      // Fallback (best effort) without lock
      const { winnerChange, loserChange } = calculateEloChange(
        winnerRating,
        loserRating
      );
      await Promise.all([
        redis.zAdd(REDIS_KEYS.tournamentEntries(postId), {
          member: winnerId,
          score: winnerRating + winnerChange,
        }),
        redis.zAdd(REDIS_KEYS.tournamentEntries(postId), {
          member: loserId,
          score: loserRating + loserChange,
        }),
      ]);
    }
  } finally {
    if (gotLock) {
      await releaseLock(eloLockKey);
    }
  }
}

/**
 * Get a random pair of submissions for voting
 * @param postId - The tournament post ID
 * @returns Array of two random submission comment IDs
 */
// moved to services/tournament/pairs

/**
 * Get N pairs of drawing submissions with full drawing data
 * @param postId - The tournament post ID
 * @param count - Number of pairs to return
 * @returns Array of pairs as tuples `[left, right]`
 */
// moved to services/tournament/pairs

/**
 * Get drawing data from a comment ID
 * @param commentId - The comment ID
 * @returns The drawing data and metadata
 */
export async function getTournamentEntry(
  commentId: T1
): Promise<TournamentDrawing | undefined> {
  const key = REDIS_KEYS.tournamentEntry(commentId);
  const data = await redis.hGetAll(key);

  if (
    !data.drawing ||
    !data.userId ||
    !data.postId ||
    !data.mediaUrl ||
    !data.mediaId
  ) {
    console.error('Tournament entry missing required fields:', data);
    return undefined;
  }

  return {
    commentId,
    drawing: JSON.parse(data.drawing),
    userId: data.userId as T2,
    postId: data.postId as T3,
    votes: parseInt(data.votes || '0'),
    views: parseInt(data.views || '0'),
    mediaUrl: data.mediaUrl,
    mediaId: data.mediaId,
  };
}

/**
 * Award tournament placement rewards
 * @param postId - The tournament post ID
 */
export async function awardTournamentRewards(postId: T3): Promise<void> {
  const entryCount = await redis.zCard(REDIS_KEYS.tournamentEntries(postId));
  if (entryCount === 0) return;
  const top20Cutoff = Math.floor(entryCount / 5);

  const entries = await redis.zRange(
    REDIS_KEYS.tournamentEntries(postId),
    0,
    top20Cutoff - 1,
    {
      by: 'score',
      reverse: true,
    }
  );

  const entryData = await Promise.all(
    entries.map(async (entry) => {
      const entryData = await getTournamentEntry(entry.member as T1);
      return entryData;
    })
  );

  const rewardPromises: Promise<unknown>[] = [];
  for (let i = 0; i < top20Cutoff; i++) {
    const score = entries[i];
    const data = entryData[i];
    if (!score || !data) continue;
    const userId = data.userId;
    const reward =
      i === 0 ? TOURNAMENT_REWARD_WINNER : TOURNAMENT_REWARD_TOP_10;
    rewardPromises.push(incrementScore(userId, reward));
  }
  await Promise.all(rewardPromises);
}

/**
 * Increment views for a tournament entry
 */
export async function incrementEntryViews(commentId: T1): Promise<void> {
  await redis.hIncrBy(REDIS_KEYS.tournamentEntry(commentId), 'views', 1);
}

/**
 * Remove a tournament entry from the tournament
 */
export async function removeTournamentEntry(
  postId: T3,
  commentId: T1
): Promise<void> {
  await Promise.all([
    redis.zRem(REDIS_KEYS.tournamentEntries(postId), [commentId]),
    redis.del(REDIS_KEYS.tournamentEntry(commentId)),
  ]);
}

/**
 * Utility function to calculate Elo rating change for winner and loser
 */
// calculateEloChange moved to services/tournament/elo

// moved to services/tournament/comments
