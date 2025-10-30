import type { Request, Response } from 'express';
import type { T3 } from '@devvit/shared-types/tid.js';
import { assertT3 } from '@devvit/shared-types/tid.js';
import { createTournamentPostComment } from '@server/services/posts/tournament/comments';

/**
 * Job handler for creating tournament post comment
 * Creates a pinned comment explaining how to play the tournament
 */

export async function handleCreateTournamentPostComment(
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
    await createTournamentPostComment(validatedPostId);
    res.json({ status: 'success' });
  } catch (error) {
    console.error('Tournament pinned comment creation failed:', error);
    res.status(500).json({ status: 'error', message: 'Job failed' });
  }
}
