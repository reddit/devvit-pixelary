import type { Request, Response } from 'express';
import { reddit } from '@devvit/web/server';
import type { T3 } from '../../shared/types';

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
    const { postId } = jobData;

    // Validate postId
    if (!postId) {
      console.error(
        'PostId is undefined or empty in handleCreatePinnedPostComment'
      );
      res.status(400).json({ status: 'error', message: 'PostId is required' });
      return;
    }

    const commentText = `**Welcome to Pixelary!**

How to Play:
- Draw words in 16x16 pixel grids
- Guess what others have drawn
- Earn points and climb the leaderboard!

Ready to play? Start guessing!`;

    const comment = await reddit.submitComment({
      text: commentText,
      id: postId as T3,
    });

    // Pin the comment
    await comment.distinguish(true);
    res.json({ status: 'success' });
  } catch (error) {
    console.error(`Error in handleCreatePinnedPostComment job: ${error}`);
    res.status(500).json({ status: 'error', message: 'Job failed' });
  }
}
