import { redis } from '@devvit/web/server';
import { RedisKeyFactory } from './redis-factory';
import { getDrawingPosts } from './drawing-post';
import type { CollectionData } from '../../shared/schema/pixelary';

/**
 * Collection post service for Pixelary
 * Handles weekly leaderboard posts and collection management
 */

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
      createdAt: Date.now().toString(),
    });

    return true;
  } catch (error) {
    console.error(`Error storing collection post ${postId}:`, error);
    return false;
  }
}

export async function getPostDataFromSubredditPosts(
  posts: Array<{ id: string; score: number; author?: string }>,
  limit: number
): Promise<CollectionData[]> {
  if (posts.length === 0) return [];

  try {
    // Get drawing posts from the top posts
    const postIds = posts.slice(0, limit).map((post) => post.id);
    const drawingPosts = await getDrawingPosts(postIds);

    // Map to collection data format
    return drawingPosts.map((post) => ({
      postId: post.postId,
      data: post.data,
      authorUsername: '', // Would need to fetch from post data or pass in
    }));
  } catch (error) {
    console.error('Error getting post data from subreddit posts:', error);
    return [];
  }
}

export async function createWeeklyCollection(
  subredditName: string,
  timeframe: 'week' | 'month' | 'all' = 'week',
  limit: number = 20,
  context?: {
    reddit?: {
      getTopPosts: (params: {
        subredditName: string;
        timeframe: string;
        limit: number;
        pageSize: number;
      }) => Promise<Array<{ id: string; score: number }>>;
      submitPost: (params: {
        title: string;
        subredditName: string;
        preview: string;
      }) => Promise<{ id: string }>;
      submitComment: (params: {
        id: string;
        text: string;
      }) => Promise<{ id: string }>;
    };
  }
): Promise<{ success: boolean; postId?: string; drawings?: CollectionData[] }> {
  try {
    if (!context?.reddit) {
      return { success: false };
    }

    // Get top posts from subreddit
    const topPosts = await context.reddit.getTopPosts({
      subredditName,
      timeframe,
      limit: limit * 2, // Get more to filter for drawing posts
      pageSize: limit * 2,
    });

    // Filter for drawing posts and get their data
    const drawingPosts = await getPostDataFromSubredditPosts(
      topPosts.map((post: { id: string; score: number }) => ({
        id: post.id,
        score: post.score,
      })),
      limit
    );

    if (drawingPosts.length === 0) {
      return { success: false };
    }

    // Create collection post
    const post = await context.reddit.submitPost({
      title: `Top drawings from the last ${timeframe}`,
      subredditName,
      preview: `<div>Loading collection...</div>`, // Placeholder preview
    });

    // Store collection data
    await storeCollectionPost(post.id, drawingPosts, timeframe);

    // Create comment with featured artists
    let commentText = `Featured artwork by:`;
    drawingPosts.forEach((drawing) => {
      commentText = `${commentText}\n* u/${drawing.authorUsername}`;
    });

    await context.reddit.submitComment({
      id: post.id,
      text: commentText,
    });

    // Note: distinguish method may not be available in current Reddit API

    return {
      success: true,
      postId: post.id,
      drawings: drawingPosts,
    };
  } catch (error) {
    console.error(
      `Error creating weekly collection for ${subredditName}:`,
      error
    );
    return { success: false };
  }
}

export async function getCollectionStats(postId: string): Promise<{
  totalDrawings: number;
  uniqueArtists: number;
  timeframe: string;
  createdAt: number;
}> {
  const key = RedisKeyFactory.postDataKey(postId);

  try {
    const postData = await redis.hGetAll(key);

    if (postData.postType !== 'collection') {
      return {
        totalDrawings: 0,
        uniqueArtists: 0,
        timeframe: 'unknown',
        createdAt: 0,
      };
    }

    const drawings: CollectionData[] = postData.data
      ? JSON.parse(postData.data)
      : [];
    const uniqueArtists = new Set(drawings.map((d) => d.authorUsername)).size;

    return {
      totalDrawings: drawings.length,
      uniqueArtists,
      timeframe: postData.timeframe ?? 'unknown',
      createdAt: parseInt(postData.createdAt ?? '0'),
    };
  } catch (error) {
    console.error(`Error fetching collection stats for ${postId}:`, error);
    return {
      totalDrawings: 0,
      uniqueArtists: 0,
      timeframe: 'unknown',
      createdAt: 0,
    };
  }
}

export async function getTopDrawingsByWord(
  word: string,
  limit: number = 10
): Promise<CollectionData[]> {
  const key = RedisKeyFactory.wordDrawingsKey(word);

  try {
    const drawings = await redis.zRange(key, 0, limit - 1, {
      reverse: true,
      by: 'rank',
    });

    const postIds = drawings.map((d) => d.member as string);
    const drawingPosts = await getDrawingPosts(postIds);

    return drawingPosts.map((post) => ({
      postId: post.postId,
      data: post.data,
      authorUsername: '', // Would need to fetch from post data
    }));
  } catch (error) {
    console.error(`Error fetching top drawings for word ${word}:`, error);
    return [];
  }
}

export async function getRecentCollections(
  _subredditName: string,
  _limit: number = 5
): Promise<
  Array<{
    postId: string;
    timeframe: string;
    createdAt: number;
    totalDrawings: number;
  }>
> {
  // This would require tracking collection posts
  // For now, return empty array as this wasn't in the original implementation
  return [];
}

export async function updateCollectionPreview(
  postId: string,
  drawings: CollectionData[],
  _context?: { reddit?: unknown }
): Promise<boolean> {
  // This would update the post preview with the actual collection
  // For now, just return true as preview updates are handled by the client
  console.log(
    `Collection preview update requested for post ${postId} with ${drawings.length} drawings`
  );
  return true;
}
