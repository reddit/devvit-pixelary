import type { Request, Response } from 'express';
import { grantItems } from '@server/services/rewards/consumables';

/**
 * Job handler for granting score multipliers upon level claim
 */

export async function handleUserLevelClaimed(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const jobData = req.body.data || req.body;
    const { userId, level } = jobData;

    if (!userId || typeof level !== 'number') {
      res.status(400).json({ status: 'error', message: 'invalid payload' });
      return;
    }

    // Grant 5 score multipliers upon claim
    await grantItems(userId, [
      { itemId: 'score_multiplier_2x_4h', quantity: 5 },
    ]);

    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Job failed' });
  }
}
