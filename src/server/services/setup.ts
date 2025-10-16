import { initializeDictionary } from './dictionary';
import { getSubredditIdByName } from './redis';

/**
 * Setup Pixelary in a subreddit.
 * Needs to remain idempotent as it's called on all app install and app upgrade events.
 * @param subredditName - The name of the subreddit to install Pixelary in.
 */
export async function setupPixelary(subredditName: string): Promise<void> {
  const subredditId = await getSubredditIdByName(subredditName);
  if (!subredditId) {
    throw new Error(`Subreddit not found: ${subredditName}`);
  }

  await initializeDictionary(subredditId);
}
