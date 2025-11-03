import type { Request, Response } from 'express';
import { getLevelByScore, getScore } from '@server/services/progression';
import { scheduler } from '@devvit/web/server';

/**
 * Job handler for handling user level up
 */

export async function handleUserLevelUp(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const jobData = req.body.data ?? req.body;
    const { userId, subredditName } = jobData;

    // Validate required parameters
    if (!userId) {
      res.status(400).json({ status: 'error', message: 'userId is required' });
      return;
    }

    if (!subredditName) {
      res
        .status(400)
        .json({ status: 'error', message: 'subredditName is required' });
      return;
    }

    const score = await getScore(userId);
    const level = getLevelByScore(score);

    // Schedule user flair update (non-blocking)
    try {
      await scheduler.runJob({
        name: 'SET_USER_FLAIR',
        data: {
          userId,
          subredditName,
          level,
        },
        runAt: new Date(),
      });
    } catch (error) {
      // Don't fail the job if flair scheduling fails
    }

    // TODO: Send DM to user
    // const message =
    //   `🎉 Congratulations! You've leveled up to **${level.name}** (Level ${level.rank})!\n\n` +
    //   `You now have ${level.extraTime} extra seconds when drawing!\n\n` +
    //   `Keep drawing and guessing to reach the next level!`;

    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Job failed' });
  }
}
