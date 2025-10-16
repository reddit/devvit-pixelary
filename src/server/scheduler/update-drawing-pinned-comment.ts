import type { Request, Response } from 'express';
import { updateDrawingPinnedComment } from '../jobs';

export async function handleUpdateDrawingPinnedComment(
  req: Request,
  res: Response
): Promise<void> {
  try {
    console.log('Received UPDATE_DRAWING_PINNED_COMMENT job:', req.body);

    // Extract data from the scheduler payload (same pattern as new-drawing-pinned-comment)
    const jobData = req.body.data || req.body;
    const { postId } = jobData;

    console.log(`Extracted postId: ${postId}`);

    if (!postId) {
      console.error('PostId is missing from request body:', req.body);
      res.status(400).json({ status: 'error', message: 'PostId is required' });
      return;
    }

    await updateDrawingPinnedComment({ postId });
    console.log(
      `Successfully processed UPDATE_DRAWING_PINNED_COMMENT job for post ${postId}`
    );
    res.json({ status: 'success' });
  } catch (error) {
    console.error(`Error in update drawing pinned comment job: ${error}`);
    res.status(500).json({ status: 'error', message: 'Job failed' });
  }
}
