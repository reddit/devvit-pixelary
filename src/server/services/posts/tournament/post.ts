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
import { createPost, setPostFlair } from '@server/core';
import {
  REDIS_KEYS,
  acquireLock,
  releaseLock,
  isRateLimited,
} from '@server/core/redis';
import { getRandomWords } from '@server/services/words/dictionary';
import type { DrawingData, TournamentPostData } from '@shared/schema';
import {
  TOURNAMENT_REWARD_VOTE,
  TOURNAMENT_ELO_INITIAL_RATING,
  TOURNAMENT_PAYOUT_SNAPSHOT_COUNT,
  TOURNAMENT_PAYOUT_INTERVAL_HOURS,
} from '@shared/constants';
import { calculateEloChange } from './elo';
import { incrementScore } from '@server/services/progression';
import { normalizeWord } from '@shared/utils/string';

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
 * Creates a tournament post.
 * @param word - The word for the tournament.
 * @returns The ID of the post.
 */

export async function createTournament(word?: string): Promise<T3> {
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
  if (!post) throw new Error('Failed to create tournament post');
  await setPostFlair(post.id, context.subredditName, 'tournament');
  await Promise.all([
    redis.hSet(REDIS_KEYS.tournament(post.id), {
      ...postData,
      createdAt: post.createdAt.getTime().toString(),
      votes: '0',
    }),
    redis.zAdd(REDIS_KEYS.tournaments(), {
      member: post.id,
      score: post.createdAt.getTime(),
    }),
  ]);
  try {
    await scheduler.runJob({
      name: 'CREATE_TOURNAMENT_POST_COMMENT',
      data: { postId: post.id, word: tournamentWord },
      runAt: new Date(),
    });
  } catch (error) {
    console.error(
      'Failed to schedule tournament pinned comment creation:',
      error
    );
  }
  // Schedule payout snapshots (daily)
  try {
    const ops: Promise<unknown>[] = [];
    const hoursToMs = (h: number) => h * 60 * 60 * 1000;
    for (let day = 1; day <= TOURNAMENT_PAYOUT_SNAPSHOT_COUNT; day++) {
      const runAt = new Date(
        post.createdAt.getTime() +
          day * hoursToMs(TOURNAMENT_PAYOUT_INTERVAL_HOURS)
      );
      ops.push(
        scheduler.runJob({
          name: 'TOURNAMENT_PAYOUT_SNAPSHOT',
          data: { postId: post.id, dayIndex: day },
          runAt,
        })
      );
    }
    await Promise.all(ops);
  } catch (error) {
    console.error('Failed to schedule tournament payouts:', error);
  }
  return post.id;
}

/**
 * Gets the tournament data for a post.
 * @param postId - The ID of the post.
 * @returns The tournament data.
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
    { key: `tournament:stats:${postId}`, ttl: 10 }
  );
}

/**
 * Gets the rating for a tournament entry.
 * @param postId - The ID of the post.
 * @param commentId - The ID of the comment.
 * @returns The rating.
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
 * Gets the tournament entries for a post.
 * @param postId - The ID of the post.
 * @returns The tournament entries.
 */

export async function getTournamentEntries(postId: T3): Promise<T1[]> {
  const commentIds = await redis.zRange(
    REDIS_KEYS.tournamentEntries(postId),
    0,
    -1
  );
  return commentIds.map((item) => item.member as T1);
}

/**
 * Submits a tournament entry.
 * @param drawing - The drawing data.
 * @param imageData - The image data.
 * @param postId - The ID of the post.
 * @returns The ID of the comment.
 */

export async function submitTournamentEntry(
  drawing: DrawingData,
  imageData: string,
  tournamentPostId?: T3
): Promise<T1> {
  const postId = tournamentPostId || context.postId!;
  if (await isRateLimited(REDIS_KEYS.rateSubmit(context.userId!), 2, 10)) {
    throw new Error('Too many submissions, slow down');
  }
  let response: MediaAsset;
  try {
    response = await media.upload({ url: imageData, type: 'image' });
  } catch (mediaError) {
    const mediaErrorMessage =
      mediaError instanceof Error ? mediaError.message : String(mediaError);
    throw new Error(`Failed to upload image: ${mediaErrorMessage}`);
  }
  const comment = await reddit.submitComment({
    text: `[My submission](${response.mediaUrl})`,
    id: postId,
    runAs: 'USER',
  });
  if (!comment) throw new Error('Failed to submit comment');
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
    redis.zAdd(sortedSetKey, {
      member: comment.id,
      score: TOURNAMENT_ELO_INITIAL_RATING,
    }),
    redis.hSet(entryKey, entryData),
    redis.zIncrBy(REDIS_KEYS.tournamentPlayers(postId), context.userId!, 1),
  ]);
  return comment.id;
}

/**
 * Votes for a tournament entry.
 * @param winnerId - The ID of the winner.
 * @param loserId - The ID of the loser.
 */

export async function tournamentVote(winnerId: T1, loserId: T1): Promise<void> {
  const { postId, userId } = context;
  if (!postId || !userId)
    throw new Error('Must be in a tournament post and logged in');
  if (await isRateLimited(REDIS_KEYS.rateVote(userId), 3, 1)) return;
  const [winnerRating, loserRating, _score, _playerCount, _votes] =
    await Promise.all([
      getEntryRating(postId, winnerId),
      getEntryRating(postId, loserId),
      incrementScore(userId, TOURNAMENT_REWARD_VOTE),
      redis.zIncrBy(REDIS_KEYS.tournamentPlayers(postId), userId, 1),
      redis.hIncrBy(REDIS_KEYS.tournament(postId), 'votes', 1),
      redis.hIncrBy(REDIS_KEYS.tournamentEntry(winnerId), 'votes', 1),
    ]);
  const eloLockKey = REDIS_KEYS.tournamentEloLock(postId);
  const gotLock = await acquireLock(eloLockKey, 2);
  try {
    if (gotLock) {
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
 * Gets a tournament entry.
 * @param commentId - The ID of the comment.
 * @returns The tournament entry.
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
 * Removes a tournament entry.
 * @param postId - The ID of the post.
 * @param commentId - The ID of the comment.
 */

export async function removeTournamentEntry(
  postId: T3,
  commentId: T1
): Promise<void> {
  const entry = await getTournamentEntry(commentId);
  await Promise.all([
    redis.zRem(REDIS_KEYS.tournamentEntries(postId), [commentId]),
    redis.del(REDIS_KEYS.tournamentEntry(commentId)),
  ]);
  if (entry) {
    try {
      await redis.zIncrBy(
        REDIS_KEYS.tournamentPlayers(postId),
        entry.userId,
        -1
      );
    } catch {
      // best-effort decrement
    }
  }
}
