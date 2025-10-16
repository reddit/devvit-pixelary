import { Request, Response } from 'express';
import { getServerPort } from '@devvit/web/server';
import {
  firstSolveComment,
  userLeveledUp,
  updateDrawingPinnedComment,
  newDrawingPinnedComment,
  createPinnedPostComment,
} from '../jobs';

/**
 * Scheduler job trigger handlers
 * Handles scheduled job execution events
 */

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

export async function handleFirstSolveComment(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { postId, solverUsername, word, authorUsername } = req.body;
    await firstSolveComment({ postId, solverUsername, word, authorUsername });
    res.json({ status: 'success' });
  } catch (error) {
    console.error(`Error in first solve comment job: ${error}`);
    res.status(500).json({ status: 'error', message: 'Job failed' });
  }
}

export async function handleUserLevelUp(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { username, score, prevLevel, newLevel } = req.body;
    await userLeveledUp({ username, score, prevLevel, newLevel });
    res.json({ status: 'success' });
  } catch (error) {
    console.error(`Error in user level up job: ${error}`);
    res.status(500).json({ status: 'error', message: 'Job failed' });
  }
}

export async function handleCreatePinnedPostComment(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { postId } = req.body;
    await createPinnedPostComment({ postId });
    res.json({ status: 'success' });
  } catch (error) {
    console.error(`Error in create pinned post comment job: ${error}`);
    res.status(500).json({ status: 'error', message: 'Job failed' });
  }
}
