import type { Request, Response } from 'express';
import type { T3 } from '@devvit/shared-types/tid.js';
import { isT3, assertT3 } from '@devvit/shared-types/tid.js';
import { createPinnedPostComment } from '../services/pinned-post';

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
      console.error(`Invalid postId: ${jobData.postId} - ${error}`);
      res.status(400).json({
        status: 'error',
        message: 'PostId is required and must be a valid T3 ID',
      });
      return;
    }

    console.log(`📌 Creating pinned comment for post: ${postId}`);
    const commentId = await createPinnedPostComment(postId);
    console.log(`✅ Pinned comment created: ${commentId}`);

    res.json({ status: 'success', commentId });
  } catch (error) {
    console.error(`Error in pinned post comment job:`, error);
    res.status(500).json({ status: 'error', message: 'Job failed' });
  }
}
