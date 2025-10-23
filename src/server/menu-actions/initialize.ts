import type { Request, Response } from 'express';
import { initDictionary } from '../services/dictionary';
import { initFlairTemplates } from '../core/flair';
import { initSlateBandit } from '../services/slate';
import { context } from '@devvit/web/server';

/**
 * Menu action handler for initializing the app
 * Sets up the dictionary, flair templates, and slate bandit
 */
export async function handleInitializeApp(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    console.log(`Initializing Pixelary for r/${context.subredditName}`);

    // Run initialization
    await initDictionary();
    await initFlairTemplates();
    await initSlateBandit();

    console.log(
      `Pixelary successfully initialized for r/${context.subredditName}`
    );

    res.json({
      showToast: {
        text: `Pixelary ${context.appVersion} initialized in r/${context.subredditName}`,
        appearance: 'success',
      },
    });
  } catch (error) {
    console.error(`Error initializing Pixelary: ${error}`);
    res.json({
      showToast: {
        text: 'Failed to initialize Pixelary',
        appearance: 'error',
      },
    });
  }
}
