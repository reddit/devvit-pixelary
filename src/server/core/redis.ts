import { reddit, cache, redis } from '@devvit/web/server';
import type { T2, T3, T1 } from '@devvit/shared-types/tid.js';

/**
 * Centralized Redis key management
 * Uses short prefixes for efficiency and consistency
 */

export const REDIS_KEYS = {
  // Drawings
  drawing: (postId: T3) => `drawing:${postId}`,
  drawingGuesses: (postId: T3) => `drawing:guesses:${postId}`,
  drawingAttempts: (postId: T3) => `drawing:attempts:${postId}`,
  drawingSolves: (postId: T3) => `drawing:solves:${postId}`,
  drawingSkips: (postId: T3) => `drawing:skips:${postId}`,
  authorViews: (postId: T3) => `drawing:author_views:${postId}`,
  allDrawings: () => 'drawings:all',

  // Users
  userName: (userId: T2) => `user:name:${userId}`,
  userMod: (userId: T2) => `user:mod:${userId}`,
  userAdmin: (userId: T2) => `user:admin:${userId}`,
  userDrawings: (userId: T2) => `user:drawings:${userId}`,
  userLevelUpClaim: (userId: T2) => `user:levelup:${userId}`,
  userInventory: (userId: T2) => `user:inventory:${userId}`, // Hash of itemId -> count
  userActiveBoosts: (userId: T2) => `user:active_boosts:${userId}`, // ZSET of activationId scored by expiresAt
  boostActivation: (activationId: string) => `boost:${activationId}`, // Hash for activation metadata
  // User preferences
  userRecentColors: (userId: T2) => `user:colors:recent:${userId}`,

  // Words
  wordsAll: (subredditName: string) => `words:all:${subredditName}`,
  wordsBanned: (subredditName: string) => `words:banned:${subredditName}`,
  wordsActive: (subredditName: string, timestamp: string) =>
    `words:active:${subredditName}:${timestamp}`,
  wordsHourlyStats: (subredditName: string, timestamp: string) =>
    `words:hourly:${subredditName}:${timestamp}`,
  wordsTotalStats: (subredditName: string) => `words:total:${subredditName}`,
  wordsUncertainty: (subredditName: string) =>
    `words:uncertainty:${subredditName}`,
  wordsLastServed: (subredditName: string) =>
    `words:lastServed:${subredditName}`,

  // Word backing
  wordBackingComment: (commentId: T1) => `word:backing:comment:${commentId}`,

  // Word
  wordBacking: (word: string) => `word:backing:${word}`,
  wordDrawings: (word: string) => `word:drawings:${word}`,

  // Communities
  communities: () => 'communities',

  // Legacy
  legacyUsers: () => 'legacy:users',

  // Comment
  comment: (postId: T3) => `comment:${postId}`,
  commentUpdateLock: (postId: T3) => `comment_update_lock:${postId}`,

  // Progression system
  scores: () => 'scores',

  // Flair templates
  flairTemplates: {
    user: (levelRank: number) => `flair:user:${levelRank}`,
    post: (difficulty: string) => `flair:post:${difficulty}`,
  },

  // Telemetry
  telemetry: (date: string) => `telemetry:${date}`,

  // Slates
  slate: (slateId: string) => `slate:${slateId}`,
  slateConfig: () => `slate:config`,

  // Collections
  collection: (collectionId: string) => `collection:${collectionId}`,

  // Tournament
  tournament: (postId: T3) => `tournament:${postId}`,
  tournaments: () => `tournaments:all`,
  tournamentsCounter: () => `tournaments:counter`,
  tournamentEntries: (postId: T3) => `tournament:entries:${postId}`, // Sorted set with ratings as scores
  tournamentEntry: (commentId: T1) => `tournament:entry:${commentId}`,
  tournamentPlayers: (postId: T3) => `tournament:players:${postId}`,
  tournamentHopper: (subredditName: string) =>
    `tournament:hopper:${subredditName}`,
  tournamentSchedulerLock: (subredditName: string) =>
    `tournament:scheduler:lock:${subredditName}`,
  tournamentSchedulerEnabled: (subredditName: string) =>
    `tournament:scheduler:enabled:${subredditName}`,
  tournamentEloLock: (postId: T3) => `tournament:elo_lock:${postId}`,
  tournamentPayoutLedger: (postId: T3) => `tournament:payout:ledger:${postId}`,
  tournamentPayoutLock: (postId: T3, dayIndex: number) =>
    `tournament:payout:lock:${postId}:${dayIndex}`,
  // Rate limit keys
  rateGuess: (userId: T2) => `rate:guess:${userId}`,
  rateVote: (userId: T2) => `rate:vote:${userId}`,
  rateSubmit: (userId: T2) => `rate:submit:${userId}`,
};

const MODERATOR_STATUS_TTL = 10 * 24 * 60 * 60; // 10 days.
const ADMIN_STATUS_TTL = 1 * 24 * 60 * 60; // 1 day.

export { getUsername } from './user';

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
      key: REDIS_KEYS.userMod(userId),
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
      if (user?.isAdmin) {
        return true;
      }
      return false;
    },
    {
      key: REDIS_KEYS.userAdmin(userId),
      ttl: ADMIN_STATUS_TTL,
    }
  );
}

/**
 * Acquire a lightweight distributed lock using atomic SET NX EX semantics.
 * Returns true if the lock was acquired, false otherwise.
 */
export async function acquireLock(
  key: string,
  ttlSeconds: number
): Promise<boolean> {
  const result = await redis.set(
    key as never,
    '1' as never,
    {
      ex: ttlSeconds,
      nx: true,
    } as never
  );
  // Some clients return 'OK', others truthy
  return Boolean(result);
}

/**
 * Best-effort lock release. Safe to call even if lock expired.
 */
export async function releaseLock(key: string): Promise<void> {
  try {
    await redis.del(key as never);
  } catch {
    // noop
  }
}

/**
 * Simple sliding-window-ish rate limiter using INCR + EXPIRE.
 * Returns true if the caller exceeded the limit.
 */
export async function isRateLimited(
  key: string,
  limit: number,
  ttlSeconds: number
): Promise<boolean> {
  const count = await redis.incrBy(key as never, 1 as never);
  if (count === 1) {
    await redis.expire(key as never, ttlSeconds);
  }
  return count > limit;
}
