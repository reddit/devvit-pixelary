import { redis, scheduler, reddit } from '@devvit/web/server';
import { REDIS_KEYS } from './redis';
import { createPost } from '../core/post';
import { getLeaderboard } from './progression';
import type { T1, T3 } from '@devvit/shared-types/tid.js';

/**
 * Pinned Post Service
 *
 * Manages pinned post creation, comment storage and text generation.
 * Pinned posts have static content that doesn't change between deploys.
 */

/**
 * Create a new pinned post with the given title
 * @param title - The title for the pinned post
 * @returns The created post ID
 */
export async function createPinnedPost(title: string): Promise<T3> {
  // Create a new post unit
  const post = await createPost(title, {
    type: 'pinned',
  });

  // Pin the new post
  await post.sticky(1);

  // Schedule pinned comment creation
  await scheduler.runJob({
    name: 'CREATE_PINNED_POST_COMMENT',
    data: { postId: post.id },
    runAt: new Date(), // Run immediately
  });

  return post.id;
}

/**
 * Save the pinned comment ID for a pinned post
 * @param postId - The ID of the pinned post to save the pinned comment ID for
 * @param commentId - The ID of the pinned comment
 */
export async function savePinnedPostCommentId(
  postId: T3,
  commentId: T1
): Promise<void> {
  const key = REDIS_KEYS.pinnedPost(postId);
  await redis.hSet(key, {
    pinnedCommentId: commentId,
  });
}

/**
 * Get the pinned comment ID for a pinned post
 * @param postId - The ID of the pinned post to get the pinned comment ID for
 * @returns The pinned comment ID if it exists, null otherwise
 */
export async function getPinnedPostCommentId(postId: T3): Promise<T1 | null> {
  const key = REDIS_KEYS.pinnedPost(postId);
  const commentId = await redis.hGet(key, 'pinnedCommentId');
  return commentId as T1 | null;
}

/**
 * Generate the dynamic comment text for pinned posts with leaderboard data
 * @returns The comment text for pinned posts with current leaderboard
 */
export async function generatePinnedPostCommentText(): Promise<string> {
  try {
    // Get top 5 players from leaderboard
    const leaderboard = await getLeaderboard({ limit: 5 });

    let leaderboardText = '';
    if (leaderboard.entries.length > 0) {
      leaderboardText = '\n\n**🏆 Top Players:**\n';
      leaderboard.entries.forEach((player, index) => {
        const medal =
          index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
        leaderboardText += `${medal} **${player.username}** - ${player.score} points\n`;
      });
    }

    return `Pixelary is a community drawing and guessing game.

Players draw words in 16x16 pixel grids. Other players guess what others have drawn.

Earn points and climb the leaderboard!${leaderboardText}

May the best artist win!`;
  } catch (error) {
    console.error('Error generating pinned post comment text:', error);
    // Fallback to static text if leaderboard fails
    return `Pixelary is a community drawing and guessing game.

Players draw words in 16x16 pixel grids. Other players guess what others have drawn.

Earn points and climb the leaderboard!

May the best artist win!`;
  }
}

/**
 * Create a pinned comment for a pinned post
 * @param postId - The ID of the pinned post to create a comment for
 * @returns The created comment ID
 */
export async function createPinnedPostComment(postId: T3): Promise<T1> {
  const commentText = await generatePinnedPostCommentText();

  const comment = await reddit.submitComment({
    text: commentText,
    id: postId,
  });

  // Pin the comment and save ID
  await comment.distinguish(true);
  await savePinnedPostCommentId(postId, comment.id);

  return comment.id;
}

/**
 * Update the pinned comment for a pinned post with the latest text
 * @param postId - The ID of the pinned post to update the comment for
 * @returns Promise that resolves when the comment is updated
 */
export async function updatePinnedPostComment(postId: T3): Promise<void> {
  // Get the pinned comment ID
  const pinnedCommentId = await getPinnedPostCommentId(postId);
  if (!pinnedCommentId) {
    throw new Error(`No pinned comment found for post ${postId}`);
  }

  // Generate the latest comment text with current leaderboard
  const commentText = await generatePinnedPostCommentText();

  // Update the comment
  const comment = await reddit.getCommentById(
    pinnedCommentId as `t1_${string}`
  );
  await comment.edit({ text: commentText });
}
