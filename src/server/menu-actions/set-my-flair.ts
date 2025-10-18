import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import { getLevelByScore, getScore } from '../services/progression';
import { setUserFlair } from '../core/flair';

/**
 * Menu action handler for setting user flair
 * Allows users to manually trigger their flair update based on their current level
 */
export async function handleSetMyFlair(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = context.userId;

    if (!userId) {
      console.error('SetMyFlair menu action failed: userId is undefined');
      res.status(400).json({
        showToast: 'Unable to identify user. Please try again.',
      });
      return;
    }

    // Get user's current score and level
    const score = await getScore(userId);
    const level = getLevelByScore(score);

    // Set user flair (non-blocking)
    try {
      await setUserFlair(userId, context.subredditName, level);

      res.json({
        showToast: `Your flair has been updated to Level ${level.rank} - ${level.name}!`,
      });
    } catch (error) {
      console.error(`Error setting user flair for ${userId}:`, error);

      res.json({
        showToast:
          'Unable to update your flair at this time. This may be because user flair is not enabled for this subreddit.',
      });
    }
  } catch (error) {
    console.error(`Error in set my flair menu action: ${error}`);
    res.status(500).json({
      showToast:
        'An error occurred while updating your flair. Please try again.',
    });
  }
}
