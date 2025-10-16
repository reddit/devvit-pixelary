import type { Request, Response } from 'express';
import { createPinnedPostComment } from '../jobs';

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
