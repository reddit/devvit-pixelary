import type { T5 } from '../../shared/types/TID';
import { initializeDictionary } from './dictionary';

/**
 * Setup Pixelary in a subreddit.
 * Needs to remain idempotent as it's called on all app install and app upgrade events.
 * @param subredditName - The name of the subreddit to install Pixelary in.
 */

export async function setupPixelary(subredditId: T5): Promise<void> {
  await initializeDictionary(subredditId);
}
