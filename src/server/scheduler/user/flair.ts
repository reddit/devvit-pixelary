import type { Request, Response } from 'express';
import type { T2 } from '@devvit/shared-types/tid.js';
import { getUsername } from '@server/core/user';
import { reddit } from '@devvit/web/server';
import type { Level } from '@shared/types';
import { isLegacyUser } from '@server/services/legacy';

/**
 * Job handler for setting user flair
 * Runs in app context to ensure proper permissions
 */

export async function handleSetUserFlair(
  req: Request,
  res: Response
): Promise<void> {
  let userId: T2;
  let subredditName: string;
  let level: Level;

  try {
    const jobData = req.body.data || req.body;
    ({ userId, subredditName, level } = jobData);

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

    if (!level) {
      res.status(400).json({ status: 'error', message: 'level is required' });
      return;
    }

    // First check if user flair is enabled
    const userTemplates = await reddit
      .getUserFlairTemplates(subredditName)
      .catch((_error) => {
        return [];
      });

    if (userTemplates.length === 0) {
      res.json({ status: 'success', message: 'User flair not enabled' });
      return;
    }

    // Convert T2 ID to username for the API call
    const username = await getUsername(userId);

    // Format flair text and CSS class
    const baseText = `Level ${level.rank} - ${level.name}`;
    let flairText = baseText;
    try {
      if (await isLegacyUser(userId)) {
        flairText = `${baseText} [OG]`;
      }
    } catch {
      // Non-blocking: legacy check shouldn't fail the job
    }
    const cssClass = `level-${level.rank}`;

    // Set user flair using app context
    await reddit.setUserFlair({
      username: username,
      subredditName,
      text: flairText,
      cssClass: cssClass,
    });

    res.json({ status: 'success' });
  } catch (error) {
    // Check if it's a 404 error (API endpoint not found)
    if (error instanceof Error && error.message.includes('404')) {
      res.json({ status: 'success', message: 'Flair API not available' });
    } else {
      res.status(500).json({ status: 'error', message: 'Job failed' });
    }
  }
}
