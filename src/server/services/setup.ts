import { RedisKeyFactory, RedisService } from './redis-factory.js';
import { DEFAULT_WORDS } from '../../shared/words.js';

/**
 * Setup Pixelary in a subreddit.
 * Needs to remain idempotent as it's called on all app install and app upgrade events.
 * @param subredditName - The name of the subreddit to install Pixelary in.
 */
export async function setupPixelary(subredditName: string): Promise<void> {
  // Keys
  const dictionaryKey = RedisKeyFactory.dictionaryKey(subredditName);
  const bannedWordsKey = RedisKeyFactory.bannedWordsKey(subredditName);
  const communitiesKey = RedisKeyFactory.communitiesKey();

  // Check if this is the first time we're setting up Pixelary in this subreddit
  const dictionaryExists = await RedisService.exists(dictionaryKey);
  const bannedWordsExist = await RedisService.exists(bannedWordsKey);
  const isFirstTimeSetup = !dictionaryExists || !bannedWordsExist;

  // If this is the first time we're setting up Pixelary in this subreddit, create the community dictionary keys in Redis
  if (isFirstTimeSetup) {
    console.log(`[PIXELARY] Setting up r/${subredditName}`);

    if (!dictionaryExists) {
      await RedisService.set(dictionaryKey, JSON.stringify(DEFAULT_WORDS));
    }

    if (!bannedWordsExist) {
      await RedisService.set(bannedWordsKey, JSON.stringify([]));
    }
  }

  // Add the subreddit to the list of partner communities in Redis
  await RedisService.zAdd(communitiesKey, {
    member: subredditName,
    score: Date.now(),
  });
}
