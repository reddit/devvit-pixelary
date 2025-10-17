import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from './redis';
import { getBannedWords } from './dictionary';
import type { T3 } from '../../shared/types';

/**
 * Champion Comments Service
 *
 * Manages champion comments created by !show command.
 * Champion comments allow non-dictionary words to appear unobfuscated
 * in the UI. If a champion comment is removed by Reddit's safety systems,
 * the word loses its unobfuscated status.
 */

/**
 * Set a champion comment for a word on a specific post
 * @param postId - The post ID
 * @param word - The word to set champion comment for
 * @param commentId - The comment ID that serves as champion
 */
export async function setChampionComment(
  postId: T3,
  word: string,
  commentId: string
): Promise<void> {
  const key = REDIS_KEYS.championComments(postId);
  await redis.hSet(key, { [word.toLowerCase()]: commentId });
}

/**
 * Get the champion comment ID for a word on a specific post
 * @param postId - The post ID
 * @param word - The word to get champion comment for
 * @returns The comment ID if it exists, null otherwise
 */
export async function getChampionComment(
  postId: T3,
  word: string
): Promise<string | null> {
  const key = REDIS_KEYS.championComments(postId);
  const commentId = await redis.hGet(key, word.toLowerCase());
  return commentId;
}

/**
 * Remove a champion comment for a word on a specific post
 * @param postId - The post ID
 * @param word - The word to remove champion comment for
 */
export async function removeChampionComment(
  postId: T3,
  word: string
): Promise<void> {
  const key = REDIS_KEYS.championComments(postId);
  await redis.hDel(key, word.toLowerCase());
}

/**
 * Get all words that have champion comments for a specific post
 * @param postId - The post ID
 * @returns Array of words with champion comments
 */
export async function getAllChampionWords(postId: T3): Promise<string[]> {
  const key = REDIS_KEYS.championComments(postId);
  const championData = await redis.hGetAll(key);

  // Filter out numeric keys (corrupted data from previous bug)
  const words = Object.keys(championData).filter((key) => isNaN(Number(key)));

  return words;
}

/**
 * Check if a word is banned in a subreddit
 * @param subredditName - The subreddit name
 * @param word - The word to check
 * @returns True if the word is banned
 */
export async function isWordBanned(
  subredditName: string,
  word: string
): Promise<boolean> {
  const bannedWords = await getBannedWords(subredditName);
  return bannedWords.some(
    (bannedWord) => bannedWord.toLowerCase() === word.toLowerCase()
  );
}

/**
 * Check if a comment ID is a champion comment for any word on any post
 * This is used when handling comment deletion to enforce champion removal
 * @param commentId - The comment ID to check
 * @returns Object with postId and word if found, null otherwise
 */
export async function findChampionCommentByCommentId(
  commentId: string
): Promise<{ postId: T3; word: string } | null> {
  // Note: This is a simple implementation that scans all champion comment keys
  // In a production system with many posts, you might want to maintain a reverse index
  // For now, we'll implement a basic scan approach

  // Get all keys that match the champion comments pattern
  const pattern = 'champions:*';
  const keys = await redis.keys(pattern);

  for (const key of keys) {
    const championData = await redis.hGetAll(key);
    for (const [word, storedCommentId] of Object.entries(championData)) {
      if (storedCommentId === commentId) {
        // Extract postId from key (format: champions:t3_xxxxx)
        const postId = key.replace('champions:', '') as T3;
        return { postId, word };
      }
    }
  }

  return null;
}
