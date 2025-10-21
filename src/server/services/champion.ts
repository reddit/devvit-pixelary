import { context, redis } from '@devvit/web/server';
import { normalizeWord } from '../../shared/utils/string';
import { isWordBanned, banWord } from './dictionary';
import { REDIS_KEYS } from './redis';
import type { T1 } from '@devvit/shared-types/tid.js';
import { isT1 } from '@devvit/shared-types/tid.js';
import { DEFAULT_WORD_SCORE } from '../../shared/constants';

/**
 * Sets the champion comment for a word in the current subreddit
 */

export async function setChampion(word: string, commentId: T1): Promise<void> {
  const subredditName = context.subredditName;
  const normalizedWord = normalizeWord(word);
  const [isBanned, currentChamp] = await Promise.all([
    isWordBanned(normalizedWord),
    getChampion(normalizedWord),
  ]);

  // Bail if word is banned
  if (isBanned) return;

  const promises: Promise<unknown>[] = [
    redis.zAdd(REDIS_KEYS.wordsChampioned(subredditName), {
      member: normalizedWord,
      score: DEFAULT_WORD_SCORE,
    }),
    redis.set(REDIS_KEYS.wordChampion(normalizedWord), commentId),
    redis.set(REDIS_KEYS.championWord(commentId), normalizedWord),
  ];
  if (currentChamp) {
    // Clean up key for previous champion if it exists
    promises.push(redis.del(REDIS_KEYS.championWord(currentChamp)));
  }
  await Promise.all(promises);
}

/**
 * Get the commentId for a word champion if it exists
 */
export async function getChampion(word: string): Promise<T1 | null> {
  const normalizedWord = normalizeWord(word);
  const key = REDIS_KEYS.wordChampion(normalizedWord);
  const commentId = await redis.get(key);
  return commentId && isT1(commentId) ? commentId : null;
}

/**
 * Get the word for a champion comment
 */

export async function isChampion(commentId: T1): Promise<boolean> {
  const key = REDIS_KEYS.championWord(commentId);
  const word = await redis.get(key);
  return word !== undefined;
}

/**
 * Remove a champion
 */
export async function removeChampion(word: string): Promise<void> {
  const normalizedWord = normalizeWord(word);
  const subredditName = context.subredditName;
  const commentId = await getChampion(normalizedWord);
  if (!commentId) return;

  await Promise.all([
    redis.zRem(REDIS_KEYS.wordsChampioned(subredditName), [normalizedWord]),
    redis.del(REDIS_KEYS.wordChampion(normalizedWord)),
    redis.del(REDIS_KEYS.championWord(commentId)),
  ]);
}

/**
 * Handle the deletion of a champion comment
 */

export async function handleChampionDelete(commentId: T1): Promise<void> {
  const word = await redis.get(REDIS_KEYS.championWord(commentId));
  if (!word) return; // Not a champion
  await Promise.all([banWord(word), removeChampion(word)]);
}
