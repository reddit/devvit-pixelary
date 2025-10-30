import { redis, cache } from '@devvit/web/server';
import { normalizeWord } from '../../../shared/utils/string';
import { isWordBanned, isWordInList } from './dictionary';
import { REDIS_KEYS } from '../../core/redis';
import { isT1, type T1 } from '@devvit/shared-types/tid.js';

export async function addBacker(word: string, commentId: T1): Promise<void> {
  const normalizedWord = normalizeWord(word);
  const [isBanned, currentBacking] = await Promise.all([
    isWordBanned(normalizedWord),
    getBacker(normalizedWord),
  ]);
  if (isBanned) return;
  const promises: Promise<unknown>[] = [
    redis.set(REDIS_KEYS.wordBacking(normalizedWord), commentId),
    redis.set(REDIS_KEYS.wordBackingComment(commentId), normalizedWord),
  ];
  if (currentBacking) {
    promises.push(redis.del(REDIS_KEYS.wordBackingComment(currentBacking)));
  }
  await Promise.all(promises);
}

export async function getBacker(word: string): Promise<T1 | null> {
  const normalizedWord = normalizeWord(word);
  const key = REDIS_KEYS.wordBacking(normalizedWord);
  const commentId = await redis.get(key);
  return commentId && isT1(commentId) ? commentId : null;
}

export async function removeBacker(word: string): Promise<void> {
  const normalizedWord = normalizeWord(word);
  const commentId = await getBacker(normalizedWord);
  if (!commentId) return;
  await Promise.all([
    redis.del(REDIS_KEYS.wordBacking(normalizedWord)),
    redis.del(REDIS_KEYS.wordBackingComment(commentId)),
  ]);
}

export async function getBackedWord(
  commentId: T1
): Promise<string | undefined> {
  const word = await redis.get(REDIS_KEYS.wordBackingComment(commentId));
  return word ? normalizeWord(word) : undefined;
}

export async function shouldShowWord(word: string): Promise<boolean> {
  const normalizedWord = normalizeWord(word);
  return await cache(
    async () => {
      const backer = await getBacker(normalizedWord);
      if (backer) return true;
      const inDictionary = await isWordInList(normalizedWord);
      return inDictionary;
    },
    { key: `should_show:${normalizedWord}`, ttl: 15 }
  );
}
