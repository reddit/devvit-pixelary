import { context } from '@devvit/web/server';
import type { Request, Response } from 'express';
import type { T3 } from '@devvit/shared-types/tid.js';
import { assertT3 } from '@devvit/shared-types/tid.js';
import {
  createDrawingPostComment,
  updateDrawingPostComment,
  getDrawingCommentData,
} from '../services/posts/drawing';
import { setPostFlair, getDifficultyFromStats } from '../core/flair';

/**
 * Job handler for creating a new drawing pinned comment
 * Creates a contextual comment for drawing posts
 */

export async function handleNewDrawingPinnedComment(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Extract data from the scheduler payload
    const jobData = req.body.data || req.body;
    const { postId } = jobData;

    // Validate and parse postId as T3
    let validatedPostId: T3;
    try {
      assertT3(postId);
      validatedPostId = postId;
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: 'PostId is required and must be a valid T3 ID',
      });
      return;
    }

    // Create the pinned comment
    await createDrawingPostComment(validatedPostId);
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Job failed' });
  }
}

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
    const jobData = req.body.data || req.body;

    // Validate and parse postId as validateT3
    let postId: T3;
    try {
      postId = jobData.postId;
    } catch (error) {
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
      if (stats && stats.guessCount >= 100) {
        const difficulty = getDifficultyFromStats(stats);
        if (difficulty) {
          await setPostFlair(postId, context.subredditName, difficulty);
        }
      }
    } catch (error) {
      // Don't fail the job if flair setting fails
    }

    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Job failed' });
  }
}
