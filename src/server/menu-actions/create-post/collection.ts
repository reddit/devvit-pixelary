import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import {
  fetchTopDrawingPosts,
  createCollectionPost,
} from '@server/services/posts/collection';
import { CollectionFormInputSchema } from '@shared/schema';

/**
 * Form handler for collection post submission
 * Creates a collection post with top drawing posts from a specified timeframe
 */

export async function handleCreateCollectionPost(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Handle array inputs from form fields (especially select fields)
    const processedBody = {
      ...req.body,
      numberOfDrawings: Array.isArray(req.body.numberOfDrawings)
        ? req.body.numberOfDrawings[0]
        : req.body.numberOfDrawings,
    };

    // Validate inputs
    const validationResult = CollectionFormInputSchema.safeParse(processedBody);
    if (!validationResult.success) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid input data',
        errors: validationResult.error.errors,
      });
      return;
    }

    const { postTitle, label, numberOfDays, numberOfDrawings } =
      validationResult.data;

    // Fetch top drawing posts
    const drawings = await fetchTopDrawingPosts(
      context.subredditName || '',
      numberOfDays,
      numberOfDrawings
    );

    if (drawings.length === 0) {
      res.status(400).json({
        status: 'error',
        message: `No drawing posts found in the last ${numberOfDays} days`,
      });
      return;
    }

    // Create the collection post
    const post = await createCollectionPost(postTitle, label, drawings);

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error('Error creating collection post:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create collection post',
    });
  }
}
