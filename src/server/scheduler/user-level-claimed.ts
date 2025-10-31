import type { Request, Response } from 'express';
import type { T2 } from '@devvit/shared-types/tid.js';

export async function handleUserLevelClaimed(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const jobData = req.body.data || req.body;
    const { userId, level } = jobData as {
      userId?: T2;
      level?: number;
    };

    if (!userId || typeof level !== 'number') {
      res.status(400).json({ status: 'error', message: 'invalid payload' });
      return;
    }

    const { grantItems } = await import('../services/rewards/consumables');

    // Grant 5 score multipliers upon claim
    await grantItems(userId, [
      { itemId: 'score_multiplier_2x_4h', quantity: 5 },
    ]);

    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Job failed' });
  }
}
