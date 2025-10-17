import { initializeDictionary } from './dictionary';

/**
 * Setup Pixelary in a subreddit.
 * Needs to remain idempotent as it's called on all app install and app upgrade events.
 * @param subredditName - The name of the subreddit to install Pixelary in.
 */

export async function setupPixelary(subredditName: string): Promise<void> {
  await initializeDictionary(subredditName);
}
