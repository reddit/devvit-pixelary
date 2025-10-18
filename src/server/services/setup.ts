import { initializeDictionary } from './dictionary';
import { ensureFlairTemplates } from '../core/flair';

/**
 * Setup Pixelary in a subreddit.
 * Needs to remain idempotent as it's called on all app install and app upgrade events.
 * @param subredditName - The name of the subreddit to install Pixelary in.
 */

export async function setupPixelary(subredditName: string): Promise<void> {
  await initializeDictionary(subredditName);

  // Setup flair templates (non-blocking)
  try {
    await ensureFlairTemplates(subredditName);
  } catch (error) {
    console.error(
      `Error setting up flair system for r/${subredditName}:`,
      error
    );
    // Don't throw - flair setup should not block app installation
  }
}
