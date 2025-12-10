import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from '@server/core/redis';
import type { T3 } from '@devvit/shared-types/tid.js';

/**
 * Clean up all old keys related to a specific post
 * Removes old post keys (v1/v2) and old gameplay keys (solves, skips, guesses, attempts)
 * Only deletes if new format exists (migration completed)
 * @param postId - The post ID to clean up
 * @returns `true` if keys were cleaned up, `false` otherwise
 */
export async function cleanupPostKeys(postId: T3): Promise<boolean> {
  try {
    const v3Key = REDIS_KEYS.drawing(postId);

    // Only clean up old keys if v3 key exists (migration completed)
    const v3Exists = await redis.exists(v3Key);
    if (!v3Exists) {
      return false;
    }

    // Old post keys (v1 and v2) and old gameplay keys - delete all in parallel
    const oldKeys = [
      `post-${postId}`,
      `post:${postId}`,
      `solved:${postId}`,
      `skipped:${postId}`,
      `guesses:${postId}`,
      `guess-comments:${postId}`,
      `user-guess-counter:${postId}`,
    ];
    await Promise.all(oldKeys.map((key) => redis.del(key)));

    return true; // Assume cleaned if no error thrown
  } catch (error) {
    console.error(
      `[Cleanup] Failed to cleanup post keys for ${postId}:`,
      error
    );
    return false;
  }
}

/**
 * Clean up all old keys related to a specific user
 * @param username - The username to clean up (old keys use username, not userId)
 * @returns `true` if key was found and deleted, `false` otherwise
 */
export async function cleanupUserKeys(username: string): Promise<boolean> {
  try {
    const userKeys = [`users:${username}`, `user-drawings:${username}`];
    await Promise.all(userKeys.map((key) => redis.del(key)));

    return true; // Assume cleaned if no error thrown
  } catch (error) {
    console.error(
      `[Cleanup] Failed to cleanup user keys for ${username}:`,
      error
    );
    return false;
  }
}

/**
 * Clean up all global/application-level old keys
 * Includes dictionaries registry, game settings, word selection events, etc.
 * @returns `true` if keys were cleaned up, `false` otherwise
 */
export async function cleanupGlobalKeys(): Promise<boolean> {
  try {
    // Delete all global keys in parallel
    const globalKeys = [
      'dictionaries',
      'game-settings',
      'word-selection-events',
      'word-selection-events-v2',
      'solvedDrawingsEvents',
      'solvedDrawings',
      'incorrectGuesses',
    ];

    await Promise.all(globalKeys.map((key) => redis.del(key)));

    return true; // Assume cleaned if no error thrown
  } catch (error) {
    console.error('[Cleanup] Failed to cleanup global keys:', error);
    return false;
  }
}
