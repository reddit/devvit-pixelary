import { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import { setupPixelary } from '../services/setup';

/**
 * App lifecycle trigger handlers
 * Handles app installation and upgrade events
 */

export async function handleAppInstall(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    // Run setup for the subreddit
    await setupPixelary(context.subredditName);

    res.json({
      status: 'success',
      message: `Pixelary installed in subreddit ${context.subredditName}`,
    });
  } catch (error) {
    console.error(`Error installing Pixelary: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to install Pixelary',
    });
  }
}

export async function handleAppUpgrade(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    // Run setup for the subreddit (idempotent)
    await setupPixelary(context.subredditName);

    res.json({
      status: 'success',
      message: `App upgraded for subreddit ${context.subredditName}`,
    });
  } catch (error) {
    console.error(`Error upgrading app: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to upgrade app',
    });
  }
}
