import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import { createPinnedPost } from '@server/services/posts/pinned';

/**
 * Form handler for pinned post submission
 * Creates a pinned post with the provided title
 */

export async function handleCreatePinnedPost(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { title } = req.body;

    if (!title) {
      res.status(400).json({
        status: 'error',
        message: 'Post title is required',
      });
      return;
    }

    const postId = await createPinnedPost(title);

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${postId}`,
    });
  } catch (error) {
    console.error('Error creating pinned post:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create pinned post',
    });
  }
}
