import { redis } from '@devvit/web/server';
import { RedisKeyFactory } from './redis-factory';
import { awardDrawingSubmission } from './leaderboard';
import { addUserDrawing } from './user';
import { trackWordSubmission } from './dictionary';
import type {
  DrawingPostDataExtended,
  CollectionData,
} from '../../shared/schema/pixelary';

/**
 * Drawing post service for Pixelary
 * Handles drawing post creation, data storage, and retrieval
 */

export async function getDrawingPost(
  postId: string
): Promise<DrawingPostDataExtended | null> {
  const key = RedisKeyFactory.postDataKey(postId);

  try {
    const [postData, solvedCount, skippedCount] = await Promise.all([
      redis.hGetAll(key),
      redis.zCard(RedisKeyFactory.postSolvedKey(postId)),
      redis.zCard(RedisKeyFactory.postSkippedKey(postId)),
    ]);

    if (Object.keys(postData).length === 0) {
      return null;
    }

    return {
      type: 'drawing',
      postId,
      word: postData.word ?? '',
      dictionaryName: postData.dictionaryName ?? 'main',
      data: postData.data ? JSON.parse(postData.data) : [],
      authorUserId: postData.authorUserId ?? '',
      authorUsername: postData.authorUsername ?? '',
      date: parseInt(postData.date ?? '0'),
      solves: solvedCount,
      skips: skippedCount,
      seed: postData.seed,
      mode: postData.mode,
      createdAt: postData.createdAt ? parseInt(postData.createdAt) : undefined,
      timerSec: postData.timerSec ? parseInt(postData.timerSec) : undefined,
      admins: postData.admins ? JSON.parse(postData.admins) : undefined,
      pinnedCommentId: postData.pinnedCommentId,
      lastCommentUpdate: postData.lastCommentUpdate
        ? parseInt(postData.lastCommentUpdate)
        : undefined,
    };
  } catch (error) {
    console.error(`Error fetching drawing post ${postId}:`, error);
    return null;
  }
}

export async function getDrawingPosts(postIds: string[]): Promise<
  Array<{
    postId: string;
    data: { data: string; colors: string[]; bg: number; size: number };
  }>
> {
  if (postIds.length === 0) return [];

  try {
    const keys = postIds.map((id) => RedisKeyFactory.postDataKey(id));
    const results = await Promise.all(
      keys.map(async (key, index) => {
        const data = await redis.hGet(key, 'data');
        return {
          postId: postIds[index]!,
          data: data ? JSON.parse(data) : null,
        };
      })
    );

    return results.filter((result) => result.data !== null);
  } catch (error) {
    console.error('Error fetching drawing posts:', error);
    return [];
  }
}

export async function submitDrawing(
  data: {
    postId: string;
    word: string;
    dictionaryName: string;
    data: { data: string; colors: string[]; bg: number; size: number };
    authorUserId: string;
    authorUsername: string;
    subreddit: string;
  },
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
  }
): Promise<boolean> {
  const key = RedisKeyFactory.postDataKey(data.postId);

  try {
    // Save post data
    await redis.hSet(key, {
      postId: data.postId,
      word: data.word,
      dictionaryName: data.dictionaryName,
      data: JSON.stringify(data.data),
      authorUserId: data.authorUserId,
      authorUsername: data.authorUsername,
      date: Date.now().toString(),
      postType: 'drawing',
    });

    // Get username from data
    const username = data.authorUsername;

    if (username) {
      // Add to user's drawings
      await addUserDrawing(username, data.postId);

      // Award points for submission
      await awardDrawingSubmission(username, context);

      // Track word submission stats
      await trackWordSubmission(data.subreddit, data.word);

      // Schedule jobs if context available
      if (context?.scheduler) {
        console.log(
          `Scheduling NEW_DRAWING_PINNED_COMMENT job for post ${data.postId}`
        );
        // Schedule pinned comment job
        await context.scheduler.runJob({
          name: 'NEW_DRAWING_PINNED_COMMENT',
          data: {
            postId: data.postId,
            authorUsername: username,
            word: data.word,
          },
          runAt: new Date(Date.now() + 1000), // 1 second delay
        });
        console.log(
          `Successfully scheduled NEW_DRAWING_PINNED_COMMENT job for post ${data.postId}`
        );
      } else {
        console.log(`No scheduler context available for post ${data.postId}`);
      }
    }

    // Add to word drawings
    await redis.zAdd(RedisKeyFactory.wordDrawingsKey(data.word), {
      member: data.postId,
      score: Date.now(),
    });

    return true;
  } catch (error) {
    console.error(`Error submitting drawing for ${data.authorUserId}:`, error);
    return false;
  }
}

export async function updateDrawingPostPreview(
  postId: string,
  _drawing: { data: string; colors: string[]; bg: number; size: number },
  _playerCount: number,
  _dictionaryName: string
): Promise<boolean> {
  // This would need to be called from a context that has Reddit API access
  // For now, we'll just return true as the preview update is handled by the client
  console.log(`Preview update requested for post ${postId}`);
  return true;
}

export async function skipPost(
  postId: string,
  username: string
): Promise<boolean> {
  const key = RedisKeyFactory.postSkippedKey(postId);

  try {
    await redis.zAdd(key, {
      member: username,
      score: Date.now(),
    });
    return true;
  } catch (error) {
    console.error(`Error skipping post for ${username}:`, error);
    return false;
  }
}

export async function getPostPlayerCount(postId: string): Promise<number> {
  const solvedKey = RedisKeyFactory.postSolvedKey(postId);
  const skippedKey = RedisKeyFactory.postSkippedKey(postId);

  try {
    const [solvedCount, skippedCount] = await Promise.all([
      redis.zCard(solvedKey),
      redis.zCard(skippedKey),
    ]);

    return solvedCount + skippedCount;
  } catch (error) {
    console.error(`Error fetching player count for post ${postId}:`, error);
    return 0;
  }
}

export async function getPostStats(postId: string): Promise<{
  solves: number;
  skips: number;
  totalGuesses: number;
  uniqueGuessers: number;
}> {
  const [solvedKey, skippedKey, guessesKey, guessCounterKey] = [
    RedisKeyFactory.postSolvedKey(postId),
    RedisKeyFactory.postSkippedKey(postId),
    RedisKeyFactory.postGuessesKey(postId),
    RedisKeyFactory.postUserGuessCounterKey(postId),
  ];

  try {
    const [solves, skips, totalGuesses, uniqueGuessers] = await Promise.all([
      redis.zCard(solvedKey),
      redis.zCard(skippedKey),
      redis.zCard(guessesKey),
      redis.zCard(guessCounterKey),
    ]);

    return {
      solves,
      skips,
      totalGuesses,
      uniqueGuessers,
    };
  } catch (error) {
    console.error(`Error fetching post stats for ${postId}:`, error);
    return {
      solves: 0,
      skips: 0,
      totalGuesses: 0,
      uniqueGuessers: 0,
    };
  }
}

export async function getCollectionPost(postId: string): Promise<{
  postId: string;
  type: 'collection';
  data: CollectionData[];
  timeframe: string;
} | null> {
  const key = RedisKeyFactory.postDataKey(postId);

  try {
    const postData = await redis.hGetAll(key);

    if (
      Object.keys(postData).length === 0 ||
      postData.postType !== 'collection'
    ) {
      return null;
    }

    return {
      postId,
      type: 'collection',
      data: postData.data ? JSON.parse(postData.data) : [],
      timeframe: postData.timeframe ?? 'week',
    };
  } catch (error) {
    console.error(`Error fetching collection post ${postId}:`, error);
    return null;
  }
}

export async function storeCollectionPost(
  postId: string,
  drawings: CollectionData[],
  timeframe: string
): Promise<boolean> {
  const key = RedisKeyFactory.postDataKey(postId);

  try {
    await redis.hSet(key, {
      postId,
      data: JSON.stringify(drawings),
      timeframe,
      postType: 'collection',
    });

    return true;
  } catch (error) {
    console.error(`Error storing collection post ${postId}:`, error);
    return false;
  }
}

export async function getPostDataFromSubredditPosts(
  posts: Array<{ id: string; score: number }>,
  limit: number
): Promise<CollectionData[]> {
  if (posts.length === 0) return [];

  try {
    // Get drawing posts from the top posts
    const postIds = posts.slice(0, limit).map((post) => post.id);
    const drawingPosts = await getDrawingPosts(postIds);

    return drawingPosts.map((post) => ({
      postId: post.postId,
      data: post.data,
      authorUsername: '', // Would need to fetch from post data
    }));
  } catch (error) {
    console.error('Error getting post data from subreddit posts:', error);
    return [];
  }
}

export async function getPinnedPost(postId: string): Promise<{
  postId: string;
  type: 'pinned';
  pinnedAt: number;
  pinnedBy: string;
  message?: string;
} | null> {
  const key = RedisKeyFactory.postDataKey(postId);

  try {
    const postData = await redis.hGetAll(key);

    if (Object.keys(postData).length === 0 || postData.postType !== 'pinned') {
      return null;
    }

    const result: {
      postId: string;
      type: 'pinned';
      pinnedAt: number;
      pinnedBy: string;
      message?: string;
    } = {
      postId,
      type: 'pinned',
      pinnedAt: parseInt(postData.pinnedAt ?? '0'),
      pinnedBy: postData.pinnedBy ?? '',
    };

    if (postData.message) {
      result.message = postData.message;
    }

    return result;
  } catch (error) {
    console.error(`Error fetching pinned post ${postId}:`, error);
    return null;
  }
}

export async function savePinnedCommentId(
  postId: string,
  commentId: string
): Promise<void> {
  const key = RedisKeyFactory.postDataKey(postId);

  try {
    await redis.hSet(key, { pinnedCommentId: commentId });
  } catch (error) {
    console.error(`Error saving pinned comment ID for ${postId}:`, error);
  }
}

export async function saveLastCommentUpdate(
  postId: string,
  timestamp: number
): Promise<void> {
  const key = RedisKeyFactory.postDataKey(postId);

  try {
    await redis.hSet(key, { lastCommentUpdate: timestamp.toString() });
  } catch (error) {
    console.error(`Error saving last comment update for ${postId}:`, error);
  }
}
