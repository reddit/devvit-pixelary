import { context, reddit } from '@devvit/web/server';
import type { Request, Response } from 'express';
import {
  getDrawing,
  getDrawingCommentData,
  generateDrawingCommentText,
  getPostPinnedCommentId,
  saveLastCommentUpdate,
  clearNextScheduledJobId,
} from '../services/drawing';
import { updatePinnedPostComment } from '../services/pinned-post';

/**
 * Menu action handler for updating pinned comments on both drawing and pinned posts
 * Moderator access is enforced by Devvit configuration
 */
export async function handleUpdateComment(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const postId = context.postId;

    if (!postId) {
      res.status(400).json({
        showToast: 'Post ID is required',
      });
      return;
    }

    // Get the pinned comment ID for this post (works for both drawing and pinned posts)
    const pinnedCommentId = await getPostPinnedCommentId(postId);
    if (!pinnedCommentId) {
      res.json({
        showToast: 'No pinned comment found for this post',
      });
      return;
    }

    // Determine post type and update accordingly
    const postData = await getDrawing(postId);

    if (postData) {
      // It's a drawing post - generate dynamic comment with stats
      const stats = await getDrawingCommentData(postId);
      const commentText = generateDrawingCommentText(stats);

      // Update the pinned comment
      const comment = await reddit.getCommentById(
        pinnedCommentId as `t1_${string}`
      );
      await comment.edit({ text: commentText });
    } else {
      // It's a pinned post - use the dedicated update method
      await updatePinnedPostComment(postId);
    }

    // Update timestamp and clear any scheduled jobs (only for drawing posts)
    if (postData) {
      await Promise.all([
        saveLastCommentUpdate(postId, Date.now()),
        clearNextScheduledJobId(postId),
      ]);
    }

    res.json({
      showToast: 'Updated!',
    });
  } catch (error) {
    console.error(`Error updating comment: ${error}`);
    res.status(500).json({
      showToast: 'Failed to update',
    });
  }
}
