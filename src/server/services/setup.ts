import { initializeDictionary } from './dictionary';
import { ensureFlairTemplates } from '../core/flair';
import { initializeSlateBanditConfig } from './slate';

/**
 * Setup Pixelary in a subreddit.
 * Needs to remain idempotent as it's called on all app install and app upgrade events.
 * @param subredditName - The name of the subreddit to install Pixelary in.
 */

export async function setupPixelary(subredditName: string): Promise<void> {
  await initializeDictionary();

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

  // Initialize slate bandit configuration (non-blocking)
  try {
    await initializeSlateBanditConfig();
  } catch (error) {
    console.error(
      `Error initializing slate bandit config for r/${subredditName}:`,
      error
    );
    // Don't throw - slate bandit setup should not block app installation
  }
}
