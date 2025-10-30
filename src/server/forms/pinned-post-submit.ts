import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import { createPinnedPost } from '../services/posts/pinned';

/**
 * Form handler for pinned post submission
 * Creates a pinned post with the provided title
 */

export async function handlePinnedPostSubmit(
  req: Request,
  res: Response
): Promise<void> {
  try {
    console.log('Pinned post submit request received:', {
      body: req.body,
      subredditName: context.subredditName,
    });

    // Creating pinned post
    const { title } = req.body;

    if (!title) {
      // No title provided
      res.status(400).json({
        status: 'error',
        message: 'Post title is required',
      });
      return;
    }

    console.log('Creating pinned post with title:', title);

    // Create the pinned post using the service
    const postId = await createPinnedPost(title);

    console.log('Pinned post created successfully:', postId);

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
