import type { Request, Response } from 'express';
import { createPost } from '../core/post';
import { context, scheduler } from '@devvit/web/server';

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

    // Create a new post unit
    const post = await createPost(title, {
      type: 'pinned',
    });

    // Pin the new post
    await post.sticky(1);

    // Schedule pinned comment creation
    await scheduler.runJob({
      name: 'CREATE_PINNED_POST_COMMENT',
      data: { postId: post.id },
      runAt: new Date(), // Run immediately
    });

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating pinned post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create pinned post',
    });
  }
}
