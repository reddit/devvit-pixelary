import { redis } from '@devvit/web/server';
import type { T2 } from '@devvit/shared-types/tid.js';
import { REDIS_KEYS } from '../core/redis';

/**
 * Get the number of legacy users.
 */

export async function getLegacyUsersCount(): Promise<number> {
  const key = REDIS_KEYS.legacyUsers();
  return await redis.global.zCard(key);
}

/**
 * Check if a user is a legacy user. Returns `true` if the user is a legacy user, `false` otherwise.
 */

export async function isLegacyUser(userId: T2): Promise<boolean> {
  const key = REDIS_KEYS.legacyUsers();
  const score = await redis.global.zScore(key, userId);
  return score !== undefined;
}

/**
 * Add a list of userIds to the global legacy users set. Returns the number of users added.
 */

export async function addLegacyUsers(userIds: T2[]): Promise<number> {
  if (userIds.length === 0) return 0;
  const key = REDIS_KEYS.legacyUsers();
  return await redis.global.zAdd(
    key,
    ...userIds.map((userId) => ({
      member: userId,
      score: 1,
    }))
  );
}

/**
 * Remove legacy users from the global legacy users set
 * @param userIds - The userIds to remove
 * @returns The number of users removed
 */

export async function removeLegacyUsers(userIds: T2[]): Promise<number> {
  if (userIds.length === 0) return 0;
  return await redis.global.zRem(REDIS_KEYS.legacyUsers(), userIds);
}
