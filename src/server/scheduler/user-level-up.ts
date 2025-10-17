import type { Request, Response } from 'express';
//import { getLevelByScore, getScore } from '../services/progression';

export async function handleUserLevelUp(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const jobData = req.body.data || req.body;
    const { userId } = jobData;

    // Validate required parameters
    if (!userId) {
      console.error('UserLeveledUp job failed: userId is undefined or empty');
      res.status(400).json({ status: 'error', message: 'userId is required' });
      return;
    }

    // const score = await getScore(userId);
    // const level = getLevelByScore(score);

    // TODO: Set user flair
    // TODO: Send DM to user

    // const message =
    //   `🎉 Congratulations! You've leveled up to **${level.name}** (Level ${level.rank})!\n\n` +
    //   `You now have ${level.extraTime} extra seconds when drawing!\n\n` +
    //   `Keep drawing and guessing to reach the next level!`;

    res.json({ status: 'success' });
  } catch (error) {
    console.error(`Error in user level up job: ${error}`);
    res.status(500).json({ status: 'error', message: 'Job failed' });
  }
}
