import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import { initDictionary } from '../services/words/dictionary';
import { initFlairTemplates } from '../core/flair';
import { initSlateBandit } from '../services/words/slate';

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
    const details = error instanceof Error ? error.message : String(error);
    console.error('[handleAppInstall] setup failed', {
      subredditName: context.subredditName,
      appVersion: context.appVersion,
      details,
      error,
    });
    res.status(400).json({
      status: 'error',
      message: 'Failed to install Pixelary',
      details,
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
  try {
    await initDictionary();
  } catch (error) {
    throw new Error(
      `setupPixelary:initDictionary failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  try {
    await initFlairTemplates();
  } catch (error) {
    throw new Error(
      `setupPixelary:initFlairTemplates failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  try {
    await initSlateBandit();
  } catch (error) {
    throw new Error(
      `setupPixelary:initSlateBandit failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
