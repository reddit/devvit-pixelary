import { reddit, cache } from '@devvit/web/server';
import type { T2, T3 } from '../../shared/types';

/**
 * Centralized Redis key management
 * Uses short prefixes for efficiency and consistency
 */

export const REDIS_KEYS = {
  // Global tracking of drawings
  drawingsByUser: (userId: T2) => `d:u:${userId}`,
  drawingsByWord: (word: string) => `d:w:${word}`,
  allDrawings: () => 'd:all',

  // Post level data and user interactions
  drawing: (postId: T3) => `d:${postId}`,
  drawingGuesses: (postId: T3) => `guesses:${postId}`,
  userAttempts: (postId: T3) => `attempts:${postId}`,
  userSolved: (postId: T3) => `solves:${postId}`,
  userSkipped: (postId: T3) => `skips:${postId}`,

  // Scores & Leaderboard
  scores: () => 'scores',

  // Dictionary
  words: (subredditName: string) => `words:${subredditName}`,
  bannedWords: (subredditName: string) => `banned:${subredditName}`,

  // User metadata
  username: (userId: T2) => `username:${userId}`,
  moderatorStatus: (subredditName: string, userId: T2) =>
    `mod:${subredditName}:${userId}`,
  adminStatus: (userId: T2) => `admin:${userId}`,

  // Communities
  communities: () => 'communities',

  // Champion comments for !show command
  championComments: (postId: T3) => `champions:${postId}`,
  championCommentReverse: (commentId: string) => `champion:rev:${commentId}`,

  // Pinned post comment storage
  pinnedPost: (postId: T3) => `pinned:${postId}`,

  // Flair templates
  flairTemplates: {
    user: (levelRank: number) => `flair:user:${levelRank}`,
    post: (difficulty: string) => `flair:post:${difficulty}`,
  },

  // Telemetry
  telemetry: (date: string) => `tel:${date}`,

  // Slate system (simplified keys)
  wordScores: (subredditName: string) => `ws:${subredditName}`,
  wordMetrics: (subredditName: string, word: string) =>
    `wm:${subredditName}:${word}`,
  slates: (subredditName: string, slateId: string) =>
    `sl:${subredditName}:${slateId}`,
  slateEvents: (subredditName: string, slateId: string) =>
    `se:${subredditName}:${slateId}`,
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
      key: REDIS_KEYS.username(userId),
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
      key: REDIS_KEYS.moderatorStatus(subredditName, userId),
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
      key: REDIS_KEYS.adminStatus(userId),
      ttl: ADMIN_STATUS_TTL,
    }
  );
}
