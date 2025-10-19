import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import { createPinnedPost } from '../services/pinned-post';

/**
 * Form handler for pinned post submission
 * Creates a pinned post with the provided title
 */

export async function handlePinnedPostSubmit(
  req: Request,
  res: Response
): Promise<void> {
  try {
    console.log('Creating pinned post with body:', req.body);
    const { title } = req.body;

    if (!title) {
      console.log('No title provided in request');
      res.status(400).json({
        status: 'error',
        message: 'Post title is required',
      });
      return;
    }

    // Create the pinned post using the service
    const postId = await createPinnedPost(title);

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${postId}`,
    });
  } catch (error) {
    console.error(`Error creating pinned post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create pinned post',
    });
  }
}
