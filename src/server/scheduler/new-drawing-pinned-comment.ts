import type { Request, Response } from 'express';
import { newDrawingPinnedComment } from '../jobs';

export async function handleNewDrawingPinnedComment(
  req: Request,
  res: Response
): Promise<void> {
  try {
    console.log('Received NEW_DRAWING_PINNED_COMMENT job:', req.body);

    // Extract data from the scheduler payload
    const jobData = req.body.data || req.body;
    const { postId, authorUsername, word } = jobData;

    console.log(
      `Extracted data - postId: ${postId}, authorUsername: ${authorUsername}, word: ${word}`
    );

    await newDrawingPinnedComment({ postId, authorUsername, word });
    console.log(
      `Successfully processed NEW_DRAWING_PINNED_COMMENT job for post ${postId}`
    );
    res.json({ status: 'success' });
  } catch (error) {
    console.error(`Error in new drawing pinned comment job: ${error}`);
    res.status(500).json({ status: 'error', message: 'Job failed' });
  }
}
