import { reddit, cache } from '@devvit/web/server';
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
};

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
      key: REDIS_KEYS.userName(userId),
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
      if (user && user.isAdmin) {
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
