import { context, redis } from '@devvit/web/server';
import { normalizeWord } from '../../shared/utils/string';
import { isWordBanned, removeWord } from './dictionary';
import { REDIS_KEYS } from './redis';
import type { T1 } from '@devvit/shared-types/tid.js';
import { isT1 } from '@devvit/shared-types/tid.js';
import { DEFAULT_WORD_SCORE } from '../constants';

/**
 * Sets the backing comment for a word in the current subreddit
 * This can be used for dictionary words or any word that needs public comment backing
 */

export async function setWordBacking(
  word: string,
  commentId: T1
): Promise<void> {
  const subredditName = context.subredditName;
  const normalizedWord = normalizeWord(word);
  const [isBanned, currentBacking] = await Promise.all([
    isWordBanned(normalizedWord),
    getWordBacking(normalizedWord),
  ]);

  // Bail if word is banned
  if (isBanned) return;

  const promises: Promise<unknown>[] = [
    redis.set(REDIS_KEYS.wordBacking(normalizedWord), commentId),
    redis.set(REDIS_KEYS.wordBackingComment(commentId), normalizedWord),
  ];
  if (currentBacking) {
    // Clean up key for previous backing if it exists
    promises.push(redis.del(REDIS_KEYS.wordBackingComment(currentBacking)));
  }
  await Promise.all(promises);
}

/**
 * Get the commentId for a word backing if it exists
 */
export async function getWordBacking(word: string): Promise<T1 | null> {
  const normalizedWord = normalizeWord(word);
  const key = REDIS_KEYS.wordBacking(normalizedWord);
  const commentId = await redis.get(key);
  return commentId && isT1(commentId) ? commentId : null;
}

/**
 * Get the word for a backing comment
 */
export async function isWordBacked(commentId: T1): Promise<boolean> {
  const key = REDIS_KEYS.wordBackingComment(commentId);
  const word = await redis.get(key);
  return word !== undefined;
}

/**
 * Remove word backing
 */
export async function removeWordBacking(word: string): Promise<void> {
  const normalizedWord = normalizeWord(word);
  const subredditName = context.subredditName;
  const commentId = await getWordBacking(normalizedWord);
  if (!commentId) return;

  await Promise.all([
    redis.del(REDIS_KEYS.wordBacking(normalizedWord)),
    redis.del(REDIS_KEYS.wordBackingComment(commentId)),
  ]);
}

/**
 * Handle the deletion of a word backing comment
 */
export async function handleWordBackingDelete(commentId: T1): Promise<void> {
  const word = await redis.get(REDIS_KEYS.wordBackingComment(commentId));
  if (!word) return; // Not a word backing comment

  const normalizedWord = normalizeWord(word);
  const subredditName = context.subredditName;

  await Promise.all([
    removeWord(word), // Remove from dictionary
    removeWordBacking(word), // Remove backing tracking
    // Remove from uncertainty scores
    redis.zRem(REDIS_KEYS.wordsUncertainty(subredditName), [normalizedWord]),
  ]);
}
