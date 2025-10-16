import { reddit, cache } from '@devvit/web/server';
import type { T2, T5 } from '../../shared/types/TID';

/**
 * Get the username for a user ID. Cached for 30 days.
 * @param userId - The user ID to get the username for
 * @returns The username for the user ID, or `null` if the user is not found
 */
export async function getUsernameById(userId: T2): Promise<string | null> {
  return await cache(
    async () => {
      const user = await reddit.getUserById(userId);
      if (!user) {
        throw new Error('No user found for id: ' + userId);
      }
      return user.username;
    },
    {
      key: `username:${userId}`,
      ttl: 30 * 24 * 60 * 60, // expire after 30 days.
    }
  );
}

/**
 * Get the subreddit ID for a subreddit name. Cached for 30 days.
 * @param subredditName - The subreddit name to get the ID for
 * @returns The subreddit ID, or `null` if the subreddit is not found
 */
export async function getSubredditIdByName(
  subredditName: string
): Promise<T5 | null> {
  return await cache(
    async () => {
      const subreddit = await reddit.getSubredditByName(subredditName);
      if (!subreddit) {
        throw new Error('No subreddit found for name: ' + subredditName);
      }
      return subreddit.id as T5;
    },
    {
      key: `subreddit-id:${subredditName}`,
      ttl: 30 * 24 * 60 * 60, // expire after 30 days.
    }
  );
}
