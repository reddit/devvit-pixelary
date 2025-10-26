import type { Request, Response } from 'express';
import { reddit } from '@devvit/web/server';
import { setScore, getUserLevel } from '../services/progression';
import type { T2 } from '@devvit/shared-types/tid.js';

/**
 * Form handler for setting user points
 * Sets the exact score for a user
 */

export async function handleSetUserPointsForm(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { username, points } = req.body;

    if (!username || points === undefined) {
      res.status(400).json({
        showToast: 'Username and points are required',
      });
      return;
    }

    // Strip u/ prefix if present
    const cleanUsername = username.startsWith('u/')
      ? username.slice(2)
      : username.trim();

    // Look up user
    const user = await reddit.getUserByUsername(cleanUsername);
    if (!user) {
      res.status(400).json({
        showToast: `User u/${cleanUsername} not found`,
      });
      return;
    }

    const userId = user.id as T2;
    const pointsNumber = Number(points);

    if (isNaN(pointsNumber)) {
      res.status(400).json({
        showToast: 'Points must be a number',
      });
      return;
    }

    // Set the score
    await setScore(userId, pointsNumber);
    const level = getUserLevel(pointsNumber);
    const rankText = level.rank;

    res.json({
      showToast: `u/${cleanUsername} now has ${pointsNumber} points (Level ${rankText})`,
    });
  } catch (error) {
    console.error(`Error setting user points: ${error}`);
    res.status(500).json({
      showToast: 'Failed to set points',
    });
  }
}
