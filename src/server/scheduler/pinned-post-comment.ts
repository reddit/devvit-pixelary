import type { Request, Response } from 'express';
import type { T3 } from '@devvit/shared-types/tid.js';
import { isT3, assertT3 } from '@devvit/shared-types/tid.js';
import { createPinnedPostComment } from '../services/posts/pinned';

/**
 * Job handler for creating pinned post comment
 * Creates a contextual comment for pinned posts
 */

export async function handleCreatePinnedPostComment(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Extract data from the scheduler payload
    const jobData = req.body.data || req.body;

    // Validate and parse postId as T3
    let postId: T3;
    try {
      assertT3(jobData.postId);
      postId = jobData.postId;
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: 'PostId is required and must be a valid T3 ID',
      });
      return;
    }

    const commentId = await createPinnedPostComment(postId);

    res.json({ status: 'success', commentId });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Job failed' });
  }
}
