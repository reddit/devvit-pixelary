import { reddit, cache } from '@devvit/web/server';
import type { T2 } from '../../shared/types';

const USERNAME_TTL = 30 * 24 * 60 * 60; // 30 days.
const MODERATOR_STATUS_TTL = 10 * 24 * 60 * 60; // 10 days.
const ADMIN_STATUS_TTL = 1 * 24 * 60 * 60; // 1 day.

/**
 * Get the username for a user ID. Cached for 30 days.
 * @param userId - The user ID to get the username for
 * @returns The username for the user ID, or `null` if the user is not found
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
      key: `username:${userId}`,
      ttl: USERNAME_TTL,
    }
  );
}

/**
 * Check if user is moderator with caching
 */

export async function isModerator(
  userId: T2,
  subredditName: string
): Promise<boolean> {
  return await cache(
    async () => {
      const moderators = await reddit
        .getModerators({
          subredditName,
        })
        .all();

      return moderators.some((user) => user.id === userId);
    },
    {
      key: `isModerator:${subredditName}:${userId}`,
      ttl: MODERATOR_STATUS_TTL,
    }
  );
}

/**
 * Check if user is admin with caching
 */
export async function isAdmin(userId: T2): Promise<boolean> {
  return await cache(
    async () => {
      const user = await reddit.getUserById(userId);
      if (user && user.isAdmin) {
        return true;
      }
      return false;
    },
    {
      key: `isAdmin:${userId}`,
      ttl: ADMIN_STATUS_TTL,
    }
  );
}
