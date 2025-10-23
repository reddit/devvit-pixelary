import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import { initDictionary } from '../services/dictionary';
import { initFlairTemplates } from '../core/flair';
import { initSlateBandit } from '../services/slate';

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
    await setupPixelary();

    res.json({
      status: 'success',
      message: `Pixelary ${context.appVersion} installed in r/${context.subredditName}`,
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
    // Run setup for the subreddit
    await setupPixelary();

    res.json({
      status: 'success',
      message: `Pixelary upgraded to ${context.appVersion} in r/${context.subredditName}`,
    });
  } catch (error) {
    console.error(`Error upgrading Pixelary: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to upgrade Pixelary',
    });
  }
}

/**
 * Setup Pixelary in the current subreddit. This function is idempotent and can be called multiple times.
 */

async function setupPixelary(): Promise<void> {
  await initDictionary();
  await initFlairTemplates();
  await initSlateBandit();
}
