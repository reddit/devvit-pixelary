import { reddit, redis } from '@devvit/web/server';
import type { T1, T3 } from '@devvit/shared-types/tid.js';
import { REDIS_KEYS } from '@server/core/redis';

/**
 * Saves the ID of the pinned comment for a post.
 * @param postId - The ID of the post.
 * @param commentId - The ID of the comment.
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

/**
 * Gets the ID of the pinned comment for a post.
 * @param postId - The ID of the post.
 * @returns The ID of the pinned comment.
 */

export async function getPinnedCommentId(postId: T3): Promise<T1 | null> {
  const key = REDIS_KEYS.comment(postId);
  const pinned = (await redis.hGet(key, 'pinnedCommentId')) as T1 | null;
  return pinned ?? null;
}

/**
 * Creates a pinned comment for a post.
 * @param postId - The ID of the post.
 * @param text - The text of the comment.
 */

export async function createPinnedComment(
  postId: T3,
  text: string
): Promise<T1> {
  const comment = await reddit.submitComment({
    text,
    id: postId,
    runAs: 'APP',
  });
  await comment.distinguish(true);
  await savePinnedCommentId(postId, comment.id);
  return comment.id;
}

/**
 * Updates the pinned comment for a post.
 * @param postId - The ID of the post.
 * @param text - The text of the comment.
 */

export async function updatePinnedComment(
  postId: T3,
  text: string
): Promise<void> {
  const pinnedCommentId = await getPinnedCommentId(postId);
  if (!pinnedCommentId) {
    throw new Error(`No pinned comment found for post ${postId}`);
  }

  const comment = await reddit.getCommentById(pinnedCommentId);
  await comment.edit({ text });
}

/**
 * Replies to the pinned comment for a post.
 * @param postId - The ID of the post.
 * @param text - The text of the reply.
 */

export async function replyToPinnedComment(
  postId: T3,
  text: string
): Promise<void> {
  const pinnedCommentId = await getPinnedCommentId(postId);
  if (!pinnedCommentId) {
    console.error(`No pinned comment found for post ${postId}`);
    return;
  } // best-effort: skip if none
  await reddit.submitComment({
    text,
    id: pinnedCommentId,
    runAs: 'APP',
  });
}
