import { context, redis } from '@devvit/web/server';
import { normalizeWord } from '../../shared/utils/string';
import { isWordBanned, removeWord } from './dictionary';
import { REDIS_KEYS } from './redis';
import { isT1, type T1 } from '@devvit/shared-types/tid.js';

/**
 * Sets the backing comment for a word in the current subreddit
 * This can be used for dictionary words or any word that needs public comment backing
 */

export async function addBacker(word: string, commentId: T1): Promise<void> {
  const normalizedWord = normalizeWord(word);
  const [isBanned, currentBacking] = await Promise.all([
    isWordBanned(normalizedWord),
    getBacker(normalizedWord),
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
 * Get the commentId backing a word if it exists
 */

export async function getBacker(word: string): Promise<T1 | null> {
  const normalizedWord = normalizeWord(word);
  const key = REDIS_KEYS.wordBacking(normalizedWord);
  const commentId = await redis.get(key);
  return commentId && isT1(commentId) ? commentId : null;
}

/**
 * Remove word backing
 */

export async function removeBacker(word: string): Promise<void> {
  const normalizedWord = normalizeWord(word);
  const commentId = await getBacker(normalizedWord);
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
    removeWord(word),
    removeBacker(word),
    redis.zRem(REDIS_KEYS.wordsUncertainty(subredditName), [normalizedWord]),
  ]);
}
