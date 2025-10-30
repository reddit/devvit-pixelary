import { reddit, redis } from '@devvit/web/server';
import type { T1, T3 } from '@devvit/shared-types/tid.js';
import { REDIS_KEYS } from '@server/core/redis';

/**
 * Unified helpers for managing pinned comments across post types.
 * Uses REDIS_KEYS.comment(postId) as the canonical storage, with
 * legacy fallbacks for compatibility (drawing/tournament keys).
 */

export async function savePinnedCommentId(
  postId: T3,
  commentId: T1
): Promise<void> {
  const key = REDIS_KEYS.comment(postId);
  await redis.hSet(key, {
    pinnedCommentId: commentId,
  });
}

export async function getPinnedCommentId(postId: T3): Promise<T1 | null> {
  // Try unified location first
  const unifiedKey = REDIS_KEYS.comment(postId);
  const unified = (await redis.hGet(
    unifiedKey,
    'pinnedCommentId'
  )) as T1 | null;
  if (unified) return unified;

  // Legacy fallbacks (for compatibility with existing data)
  const legacyDrawing = (await redis.hGet(
    REDIS_KEYS.drawing(postId),
    'pinnedCommentId'
  )) as T1 | null;
  if (legacyDrawing) return legacyDrawing;

  const legacyTournament = (await redis.hGet(
    REDIS_KEYS.tournament(postId),
    'pinnedCommentId'
  )) as T1 | null;
  if (legacyTournament) return legacyTournament;

  return null;
}

export async function createPinnedComment(
  postId: T3,
  text: string
): Promise<T1> {
  const comment = await reddit.submitComment({
    text,
    id: postId,
  });
  await comment.distinguish(true);
  await savePinnedCommentId(postId, comment.id);
  return comment.id;
}

export async function updatePinnedComment(
  postId: T3,
  text: string
): Promise<void> {
  const pinnedCommentId = await getPinnedCommentId(postId);
  if (!pinnedCommentId) {
    throw new Error(`No pinned comment found for post ${postId}`);
  }

  const comment = await reddit.getCommentById(
    pinnedCommentId as `t1_${string}`
  );
  await comment.edit({ text });
}
