import { context, reddit } from '@devvit/web/server';
import type { Request, Response } from 'express';
import {
  getDrawing,
  getDrawingCommentData,
  generateDrawingCommentText,
  saveLastCommentUpdate,
  clearNextScheduledJobId,
} from '../services/drawing';

/**
 * Menu action handler for updating drawing post comments
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

    // Get post data to check if it's a drawing post
    const postData = await getDrawing(postId);
    if (!postData) {
      // No-op for non-drawing posts
      res.json({
        showToast: 'Not a drawing post',
      });
      return;
    }

    // Get current stats and generate comment text
    const stats = await getDrawingCommentData(postId);
    const commentText = generateDrawingCommentText(stats);

    // Update the pinned comment
    const comment = await reddit.getCommentById(
      postData.pinnedCommentId as `t1_${string}`
    );
    await comment.edit({ text: commentText });

    // Update timestamp and clear any scheduled jobs
    await Promise.all([
      saveLastCommentUpdate(postId, Date.now()),
      clearNextScheduledJobId(postId),
    ]);

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
