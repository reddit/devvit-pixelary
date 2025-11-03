import { redis, reddit, context } from '@devvit/web/server';
import { REDIS_KEYS } from '@server/core/redis';
import { createPost } from '@server/core/post';
import type { DrawingData } from '@shared/schema/drawing';
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

export async function fetchTopDrawingPosts(
  subredditName: string,
  days: number,
  limit: number
): Promise<CollectionDrawing[]> {
  try {
    const now = Date.now();
    const cutoffTime = now - days * 24 * 60 * 60 * 1000;
    const allPostIds = await redis.zRange(REDIS_KEYS.allDrawings(), 0, -1);
    const postIds: T3[] = [];
    for (const item of allPostIds) {
      if (item.score >= cutoffTime) {
        if (typeof item.member === 'string' && item.member.startsWith('t3_')) {
          postIds.push(item.member as T3);
        }
      }
    }
    if (postIds.length === 0) return [];
    const fetchPromises = postIds.map(async (postId) => {
      try {
        const drawingData = await redis.hGetAll(REDIS_KEYS.drawing(postId));
        const post = await reddit.getPostById(postId);
        if (!drawingData.drawing || !post) return null;
        return {
          postId,
          drawing: JSON.parse(drawingData.drawing) as DrawingData,
          word: drawingData.word ?? '',
          authorName: drawingData.authorName ?? '',
          score: post.score ?? 0,
        };
      } catch (error) {
        return null;
      }
    });
    const results = await Promise.all(fetchPromises);
    const validDrawings = results.filter(
      (r): r is CollectionDrawing => r !== null
    );
    validDrawings.sort((a, b) => b.score - a.score);
    return validDrawings.slice(0, limit);
  } catch (error) {
    return [];
  }
}

export async function createCollectionPost(
  postTitle: string,
  label: string,
  drawings: CollectionDrawing[]
): Promise<{ id: T3 }> {
  const collectionId = `collection_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const collectionData: CollectionData = {
    label,
    createdAt: Date.now(),
    drawings,
  };
  await redis.set(
    REDIS_KEYS.collection(collectionId),
    JSON.stringify(collectionData)
  );
  const postData = { type: 'collection' as const, collectionId, label };
  const post = await createPost(postTitle, postData);
  return post;
}

export async function getCollectionData(
  collectionId: string
): Promise<CollectionData | null> {
  const data = await redis.get(REDIS_KEYS.collection(collectionId));
  if (!data) return null;
  return JSON.parse(data) as CollectionData;
}
