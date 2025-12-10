import { context, redis } from '@devvit/web/server';
import { DEFAULT_WORDS, DEFAULT_WORD_SCORE } from '@server/constants';
import { normalizeWord } from '@shared/utils/string';
import { shuffle } from '@shared/utils/array';
import { REDIS_KEYS } from '@server/core/redis';

export async function addWord(word: string): Promise<boolean> {
  const subName = context.subredditName;
  const normalizedWord = normalizeWord(word);
  const isBanned = await isWordBanned(normalizedWord);
  if (isBanned) return false;
  const result = await redis.global.zAdd(REDIS_KEYS.wordsAll(subName), {
    member: normalizedWord,
    score: DEFAULT_WORD_SCORE,
  });
  return result > 0;
}

export async function addWords(words: string[]): Promise<void> {
  const subName = context.subredditName;
  const normalizedWords = words.map((word) => normalizeWord(word));
  const bannedWordsResult = await getBannedWords(0, 10000);
  const filteredWords = normalizedWords.filter(
    (word) => !bannedWordsResult.words.includes(word)
  );
  await redis.global.zAdd(
    REDIS_KEYS.wordsAll(subName),
    ...filteredWords.map((word) => ({
      member: word,
      score: DEFAULT_WORD_SCORE,
    }))
  );
}

export async function removeWord(word: string): Promise<boolean> {
  const subName = context.subredditName;
  const normalizedWord = normalizeWord(word);
  const [removed, _removedUncertainty] = await Promise.all([
    redis.global.zRem(REDIS_KEYS.wordsAll(subName), [normalizedWord]),
    redis.global.zRem(REDIS_KEYS.wordsUncertainty(subName), [normalizedWord]),
  ]);
  return removed > 0;
}

export async function getWords(
  subredditName?: string,
  offset: number = 0,
  limit: number = 1000
): Promise<{ words: string[]; total: number; hasMore: boolean }> {
  const subName = subredditName ?? context.subredditName;
  const key = REDIS_KEYS.wordsAll(subName);
  const [entities, total] = await Promise.all([
    redis.global.zRange(key, offset, offset + limit - 1),
    redis.global.zCard(key),
  ]);
  const words = entities.map((item) => item.member);
  return { words, total, hasMore: offset + limit < total };
}

export async function replaceAllWords(words: string[]): Promise<void> {
  const subName = context.subredditName;
  const key = REDIS_KEYS.wordsAll(subName);
  await redis.global.del(key);
  if (words.length === 0) return;
  await addWords(words);
}

export async function updateWordsPreservingScores(
  words: string[]
): Promise<void> {
  const subName = context.subredditName;
  const key = REDIS_KEYS.wordsAll(subName);
  const currentWords = await redis.global.zRange(key, 0, -1);
  const currentWordMap = new Map(
    currentWords.map((item) => [item.member, item.score])
  );
  const normalizedWords = words.map((word) => normalizeWord(word));
  const bannedWordsResult = await getBannedWords(0, 10000);
  const filteredWords = normalizedWords.filter(
    (word) => !bannedWordsResult.words.includes(word)
  );
  const currentWordSet = new Set(currentWordMap.keys());
  const newWordSet = new Set(filteredWords);
  const wordsToRemove = [...currentWordSet].filter(
    (word) => !newWordSet.has(word)
  );
  const wordsToAdd = filteredWords.filter((word) => !currentWordSet.has(word));
  const promises: Array<Promise<unknown>> = [];
  if (wordsToRemove.length > 0) {
    promises.push(redis.global.zRem(key, wordsToRemove));
  }
  if (wordsToAdd.length > 0) {
    promises.push(
      redis.global.zAdd(
        key,
        ...wordsToAdd.map((word) => ({
          member: word,
          score: DEFAULT_WORD_SCORE,
        }))
      )
    );
  }
  await Promise.all(promises);
}

export async function isWordInList(word: string): Promise<boolean> {
  const normalizedWord = normalizeWord(word);
  const isInDictionary = await redis.global
    .zScore(REDIS_KEYS.wordsAll(context.subredditName), normalizedWord)
    .then((result) => result !== undefined);
  return isInDictionary;
}

export async function banWord(word: string): Promise<void> {
  const subName = context.subredditName;
  const normalizedWord = normalizeWord(word);
  await Promise.all([
    redis.zAdd(REDIS_KEYS.wordsBanned(subName), {
      member: normalizedWord,
      score: DEFAULT_WORD_SCORE,
    }),
    redis.global.zRem(REDIS_KEYS.wordsAll(subName), [normalizedWord]),
    redis.global.zRem(REDIS_KEYS.wordsUncertainty(subName), [normalizedWord]),
  ]);
}

export async function banWords(words: string[]): Promise<void> {
  const subName = context.subredditName;
  const normalizedWords = words.map((word) => normalizeWord(word));
  await Promise.all([
    redis.zAdd(
      REDIS_KEYS.wordsBanned(subName),
      ...normalizedWords.map((word) => ({
        member: word,
        score: DEFAULT_WORD_SCORE,
      }))
    ),
    redis.global.zRem(REDIS_KEYS.wordsAll(subName), normalizedWords),
    redis.global.zRem(REDIS_KEYS.wordsUncertainty(subName), normalizedWords),
  ]);
}

export async function unbanWord(word: string): Promise<void> {
  const subName = context.subredditName;
  const normalizedWord = normalizeWord(word);
  await redis.zRem(REDIS_KEYS.wordsBanned(subName), [normalizedWord]);
}

export async function getBannedWords(
  offset: number = 0,
  limit: number = 1000
): Promise<{ words: string[]; total: number; hasMore: boolean }> {
  const subName = context.subredditName;
  const key = REDIS_KEYS.wordsBanned(subName);
  const [words, total] = await Promise.all([
    redis.zRange(key, offset, offset + limit - 1),
    redis.zCard(key),
  ]);
  const wordMembers = words.map((item) => item.member);
  return { words: wordMembers, total, hasMore: offset + limit < total };
}

export async function replaceBannedWords(words: string[]): Promise<void> {
  const subName = context.subredditName;
  await redis.del(REDIS_KEYS.wordsBanned(subName));
  if (words.length === 0) return;
  const normalizedWords = words.map((word) => normalizeWord(word));
  await banWords(normalizedWords);
}

export async function isWordBanned(word: string): Promise<boolean> {
  const subName = context.subredditName;
  const normalizedWord = normalizeWord(word);
  const result = await redis.zScore(
    REDIS_KEYS.wordsBanned(subName),
    normalizedWord
  );
  return result !== undefined;
}

export async function getRandomWords(count: number = 3): Promise<string[]> {
  const wordsResult = await getWords(context.subredditName, 0, 10000);
  const shuffled = shuffle(wordsResult.words);
  const result = shuffled.slice(0, count);
  return result;
}

export async function initDictionary(): Promise<void> {
  const subredditName = context.subredditName;
  const wordsKey = REDIS_KEYS.wordsAll(subredditName);
  const [words, _communityAdditions] = await Promise.all([
    redis.global.exists(wordsKey),
    redis.global.zAdd(REDIS_KEYS.communities(), {
      member: subredditName,
      score: Date.now(),
    }),
  ]);
  if (words !== 0) {
    return;
  }
  await redis.global.zAdd(
    REDIS_KEYS.wordsAll(subredditName),
    ...DEFAULT_WORDS.map((word) => ({
      member: word,
      score: DEFAULT_WORD_SCORE,
    }))
  );
}
