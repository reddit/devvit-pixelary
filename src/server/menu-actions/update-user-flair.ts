import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import { getLevelByScore, getScore } from '../services/progression';
import { setUserFlair } from '../core/flair';

/**
 * Menu action handler for updating user flair. Enables users to manually trigger a flair update
 */

export async function handleUpdateUserFlair(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const { userId, subredditName } = context;
    if (!userId) {
      res.status(400).json({
        showToast: 'No userId found',
        appearance: 'neutral',
      });
      return;
    }
    const score = await getScore(userId);
    const level = getLevelByScore(score);
    await setUserFlair(userId, subredditName, level);

    res.json({
      showToast: 'Flair updated',
      appearance: 'success',
    });
  } catch (error) {
    console.error('Error in update user flair menu action:', error);
    res.status(500).json({
      showToast: 'Error. Try later.',
    });
  }
}
