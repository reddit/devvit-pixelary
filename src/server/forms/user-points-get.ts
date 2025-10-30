import type { Request, Response } from 'express';
import { reddit } from '@devvit/web/server';
import { getScore } from '../services/progression';
import { getUsername } from '../core/redis';
import type { T2 } from '@devvit/shared-types/tid.js';

/**
 * Form handler for getting user points
 * Returns a toast with user's points
 */

export async function handleGetUserPointsForm(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { username } = req.body;

    if (!username) {
      res.status(400).json({
        showToast: 'Username is required',
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

    // Fetch user data
    const [score, actualUsername] = await Promise.all([
      getScore(userId),
      getUsername(userId),
    ]);

    res.json({
      showToast: `u/${actualUsername} has ${score} points`,
    });
  } catch (error) {
    console.error(`Error getting user points: ${error}`);
    res.status(500).json({
      showToast: 'Failed to get points',
    });
  }
}
