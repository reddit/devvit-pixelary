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
  const reverseKey = REDIS_KEYS.championCommentReverse(commentId);

  // Set forward mapping (word -> commentId)
  await redis.hSet(key, { [word.toLowerCase()]: commentId });

  // Set reverse mapping (commentId -> {postId, word})
  await redis.set(reverseKey, JSON.stringify({ postId, word }));
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
  return commentId ?? null;
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

  // Get commentId from forward mapping before deleting
  const commentId = await redis.hGet(key, word.toLowerCase());

  // Delete forward mapping
  await redis.hDel(key, [word.toLowerCase()]);

  // Delete reverse mapping if commentId exists
  if (commentId) {
    const reverseKey = REDIS_KEYS.championCommentReverse(commentId);
    await redis.del(reverseKey);
  }
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
  const reverseKey = REDIS_KEYS.championCommentReverse(commentId);
  const data = await redis.get(reverseKey);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data) as { postId: T3; word: string };
  } catch {
    return null;
  }
}
