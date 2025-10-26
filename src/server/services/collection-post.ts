import { redis, reddit, context } from '@devvit/web/server';
import { REDIS_KEYS } from './redis';
import { createPost } from '../core/post';
import type { DrawingData } from '../../shared/schema/drawing';
import type { T2, T3 } from '@devvit/shared-types/tid.js';

export type CollectionDrawing = {
  postId: T3;
  drawing: DrawingData;
  word: string;
  authorName: string;
  score: number;
};

export type CollectionData = {
  label: string;
  createdAt: number;
  drawings: CollectionDrawing[];
};

/**
 * Fetch top drawing posts from Redis within a specified timeframe
 * @param subredditName - The subreddit name
 * @param days - Number of days to look back
 * @param limit - Maximum number of drawings to return
 * @returns Array of drawing objects sorted by Reddit score
 */
export async function fetchTopDrawingPosts(
  subredditName: string,
  days: number,
  limit: number
): Promise<CollectionDrawing[]> {
  try {
    const now = Date.now();
    const cutoffTime = now - days * 24 * 60 * 60 * 1000;

    // Get all drawing post IDs from the sorted set
    const allPostIds = await redis.zRange(REDIS_KEYS.allDrawings(), 0, -1);
    const postIds: T3[] = [];

    // Filter by timestamp and validate postIds
    for (const item of allPostIds) {
      if (item.score >= cutoffTime) {
        // Validate it's a T3
        if (typeof item.member === 'string' && item.member.startsWith('t3_')) {
          postIds.push(item.member as T3);
        }
      }
    }

    console.log(
      `Found ${postIds.length} drawing posts in the last ${days} days`
    );

    if (postIds.length === 0) {
      return [];
    }

    // Fetch drawing data from Redis and Reddit post scores
    const fetchPromises = postIds.map(async (postId) => {
      try {
        const drawingData = await redis.hGetAll(REDIS_KEYS.drawing(postId));
        const post = await reddit.getPostById(postId);

        if (!drawingData.drawing || !post) {
          return null;
        }

        return {
          postId,
          drawing: JSON.parse(drawingData.drawing) as DrawingData,
          word: drawingData.word || '',
          authorName: drawingData.authorName || '',
          score: post.score || 0,
        };
      } catch (error) {
        console.error(`Error fetching data for post ${postId}:`, error);
        return null;
      }
    });

    const results = await Promise.all(fetchPromises);
    const validDrawings = results.filter(
      (r): r is CollectionDrawing => r !== null
    );

    // Sort by score descending and limit
    validDrawings.sort((a, b) => b.score - a.score);
    return validDrawings.slice(0, limit);
  } catch (error) {
    console.error('Error fetching top drawing posts:', error);
    return [];
  }
}

/**
 * Create a collection post with the provided drawings
 * @param postTitle - Title for the Reddit post
 * @param label - Label text shown above drawings (can be multiline)
 * @param drawings - Array of drawing objects to include
 * @returns The created collection post
 */
export async function createCollectionPost(
  postTitle: string,
  label: string,
  drawings: CollectionDrawing[]
): Promise<{ id: T3 }> {
  try {
    // Generate unique collection ID
    const collectionId = `collection_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`;

    // Store collection data in Redis
    const collectionData: CollectionData = {
      label,
      createdAt: Date.now(),
      drawings,
    };

    await redis.set(
      REDIS_KEYS.collection(collectionId),
      JSON.stringify(collectionData)
    );

    // Create the Reddit post with minimal postData
    const postData = {
      type: 'collection' as const,
      collectionId,
      label,
    };

    const post = await createPost(postTitle, postData);

    console.log(
      `Created collection post ${post.id} with ${drawings.length} drawings`
    );

    return post;
  } catch (error) {
    console.error('Error creating collection post:', error);
    throw error;
  }
}

/**
 * Get collection data from Redis
 * @param collectionId - The collection ID
 * @returns Collection data or null if not found
 */
export async function getCollectionData(
  collectionId: string
): Promise<CollectionData | null> {
  try {
    const data = await redis.get(REDIS_KEYS.collection(collectionId));
    if (!data) {
      return null;
    }
    return JSON.parse(data) as CollectionData;
  } catch (error) {
    console.error('Error getting collection data:', error);
    return null;
  }
}
