import { context } from '@devvit/web/server';
import type { Request, Response } from 'express';
import type { T3 } from '@devvit/shared-types/tid.js';
import { assertT3 } from '@devvit/shared-types/tid.js';
import {
  updateDrawingPostComment,
  getDrawingCommentData,
} from '@server/services/posts/drawing';
import { setPostFlair, getDifficultyFromStats } from '@server/core/flair';

/**
 * Job handler for updating drawing pinned comment with live stats
 * Updates comment with comprehensive stats and guess distribution
 */

export async function handleUpdateDrawingPinnedComment(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Extract data from the scheduler payload
    const jobData = req.body.data ?? req.body;

    // Validate and parse postId as T3
    let postId: T3;
    try {
      assertT3(jobData.postId);
      postId = jobData.postId;
    } catch (error) {
      console.error('Invalid postId in update drawing pinned comment:', error);
      res.status(400).json({
        status: 'error',
        message: 'PostId is required and must be a valid T3 ID',
      });
      return;
    }

    // Update the pinned comment
    await updateDrawingPostComment(postId);

    // Set difficulty flair if threshold is met (non-blocking)
    try {
      const stats = await getDrawingCommentData(postId);
      if (stats.guessCount >= 100) {
        const difficulty = getDifficultyFromStats(stats);
        if (difficulty) {
          await setPostFlair(postId, context.subredditName, difficulty);
        }
      }
    } catch (error) {
      // Don't fail the job if flair setting fails
      console.error('Error setting flair (non-blocking):', error);
    }

    res.json({ status: 'success' });
  } catch (error) {
    console.error('Error updating drawing pinned comment:', error);
    res.status(500).json({
      status: 'error',
      message: 'Job failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
