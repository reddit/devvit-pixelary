import { redis, cache } from '@devvit/web/server';
import { normalizeWord } from '../../shared/utils/string';
import { isWordBanned, isWordInList } from './dictionary';
import { REDIS_KEYS } from './redis';
import { isT1, type T1 } from '@devvit/shared-types/tid.js';

/**
 * Adds a comment as a backer for a word so that it may be seen by other users in the game interface.
 */

export async function addBacker(word: string, commentId: T1): Promise<void> {
  const normalizedWord = normalizeWord(word);
  const [isBanned, currentBacking] = await Promise.all([
    isWordBanned(normalizedWord),
    getBacker(normalizedWord),
  ]);

  // Bail if word is banned
  if (isBanned) return;

  // Otherwise, add the comment as the new backer for the word.
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
 * Get the word backed for a commentId if it exists
 */

export async function getBackedWord(
  commentId: T1
): Promise<string | undefined> {
  const word = await redis.get(REDIS_KEYS.wordBackingComment(commentId));
  return word ? normalizeWord(word) : undefined;
}

/**
 * Check if a word should be shown unobfuscated
 * Returns true if the word is in the dictionary OR has been backed
 * Cached for 5 minutes to improve performance
 */
export async function shouldShowWord(word: string): Promise<boolean> {
  const normalizedWord = normalizeWord(word);

  return await cache(
    async () => {
      // Check if backed
      const backer = await getBacker(normalizedWord);
      if (backer) return true;

      // Check if in dictionary
      const inDictionary = await isWordInList(normalizedWord);
      return inDictionary;
    },
    {
      key: `should_show:${normalizedWord}`,
      ttl: 15, // 15 seconds
    }
  );
}
