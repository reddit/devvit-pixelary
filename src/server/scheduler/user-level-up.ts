import type { Request, Response } from 'express';
import { userLeveledUp } from '../jobs';

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
