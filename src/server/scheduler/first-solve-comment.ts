import type { Request, Response } from 'express';
import { firstSolveComment } from '../jobs';

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
