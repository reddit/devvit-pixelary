import { context, reddit } from '@devvit/web/server';
import type { Request, Response } from 'express';
import {
  getDrawing,
  getDrawingCommentData,
  generateDrawingCommentText,
  saveLastCommentUpdate,
  clearNextScheduledJobId,
} from '../services/posts/drawing';
import { getPinnedCommentId } from '../services/comments/pinned';
import { updatePinnedPostComment } from '../services/posts/pinned';
import type { T1 } from '@devvit/shared-types/tid.js';

/**
 * Menu action handler for updating the pinned comment for a drawing post or pinned post
 */
export async function handleUpdatePinnedComment(
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

    // Get the pinned comment ID for this post
    const pinnedCommentId = await getPinnedCommentId(postId);
    if (!pinnedCommentId) {
      res.json({
        showToast: 'No comment found',
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
      const comment = await reddit.getCommentById(pinnedCommentId as T1);
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
      showToast: 'Comment updated',
      appearance: 'success',
    });
  } catch (error) {
    console.error(`Error updating comment: ${error}`);
    res.status(500).json({
      showToast: 'Failed to update',
    });
  }
}
