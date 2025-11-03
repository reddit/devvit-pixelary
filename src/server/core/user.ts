import { reddit, cache } from '@devvit/web/server';
import type { T2 } from '@devvit/shared-types/tid.js';
import { REDIS_KEYS } from './redis';

const USERNAME_CACHE_TTL = 90 * 24 * 60 * 60; // 90 days
const RESOLVE_USERNAME_BATCH_SIZE = 50;

/**
 * Get the username for a userId. Usernames are cached for 90 days. If there is no cached username, the username is fetched from Reddit and cached.
 */

export async function getUsername(userId: T2): Promise<string> {
  return await cache(
    async () => {
      const user = await reddit.getUserById(userId);
      if (!user) {
        throw new Error('No user found for id: ' + userId);
      }
      return user.username;
    },
    {
      key: REDIS_KEYS.userName(userId),
      ttl: USERNAME_CACHE_TTL,
    }
  );
}

/**
 * Resolve a list of case-insensitive usernames to userIds. If a username is not found, it is not included in the result.
 */

export async function resolveUsernamesToIds(
  usernames: string[]
): Promise<T2[]> {
  if (usernames.length === 0) return [];

  const results: T2[] = [];
  for (let i = 0; i < usernames.length; i += RESOLVE_USERNAME_BATCH_SIZE) {
    const slice = usernames.slice(i, i + RESOLVE_USERNAME_BATCH_SIZE);
    const users = await Promise.all(
      slice.map(async (name) => reddit.getUserByUsername(name))
    );
    for (const user of users) {
      if (user?.id) {
        results.push(user.id);
      }
    }
  }

  // Dedupe and return the results
  return Array.from(new Set(results));
}
