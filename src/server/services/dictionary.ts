import { context, redis } from '@devvit/web/server';
import { DEFAULT_WORDS, DEFAULT_WORD_SCORE } from '../../shared/constants';
import { normalizeWord } from '../../shared/utils/string';
import { shuffle } from '../../shared/utils/array';
import { REDIS_KEYS } from './redis';

/**
 * Add a word to the dictionary for the current subreddit. Returns `true` if the word was added, `false` if it already exists or is banned.
 */

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

/**
 * Add multiple words to the dictionary for the current subreddit. Words that are banned are ignored.
 */

export async function addWords(words: string[]): Promise<void> {
  const subName = context.subredditName;
  const normalizedWords = words.map((word) => normalizeWord(word));
  const bannedWords = await getAllBannedWords();
  const filteredWords = normalizedWords.filter(
    (word) => !bannedWords.includes(word)
  );
  await redis.global.zAdd(
    REDIS_KEYS.wordsAll(subName),
    ...filteredWords.map((word) => ({
      member: word,
      score: DEFAULT_WORD_SCORE,
    }))
  );
}

/**
 * Remove a word from the dictionary for the current subreddit. Returns `true` if the word was removed, `false` if it didn't exist.
 */

export async function removeWord(word: string): Promise<boolean> {
  const subName = context.subredditName;
  const normalizedWord = normalizeWord(word);
  const key = REDIS_KEYS.wordsAll(subName);
  const removed = await redis.global.zRem(key, [normalizedWord]);
  return removed > 0;
}

/**
 * Get all words from the dictionary for a given subreddit, or the current subreddit if no subreddit name is provided.
 */

export async function getAllWords(subredditName?: string): Promise<string[]> {
  const subName = subredditName ?? context.subredditName;
  const key = REDIS_KEYS.wordsAll(subName);
  // TODO: Will break if list gets too long. Paginate before then.
  const entities = await redis.global.zRange(key, 0, -1);
  const words = entities.map((item) => item.member);
  return words;
}

/**
 * Replace all words in the dictionary for the current subreddit with a new list of words. Words that are banned are ignored.
 */

export async function replaceAllWords(words: string[]): Promise<void> {
  const subName = context.subredditName;
  const key = REDIS_KEYS.wordsAll(subName);
  await redis.global.del(key);
  if (words.length === 0) return;
  await addWords(words);
}

/**
 * Check if a word is in the dictionary for the current subreddit.
 */

export async function isWordInList(word: string): Promise<boolean> {
  const normalizedWord = normalizeWord(word);
  const isInDictionary = await redis.global
    .zScore(REDIS_KEYS.wordsAll(context.subredditName), normalizedWord)
    .then((result) => result !== undefined);
  return isInDictionary;
}

/**
 * Ban a word in the current subreddit
 */

export async function banWord(word: string): Promise<void> {
  const subName = context.subredditName;
  const normalizedWord = normalizeWord(word);
  await Promise.all([
    redis.zAdd(REDIS_KEYS.wordsBanned(subName), {
      member: normalizedWord,
      score: DEFAULT_WORD_SCORE,
    }),
    redis.global.zRem(REDIS_KEYS.wordsAll(subName), [normalizedWord]),
  ]);
}

/**
 * Bulk ban words in the current subreddit
 */

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
  ]);
}

/**
 * Unban a word in the current subreddit
 */

export async function unbanWord(word: string): Promise<void> {
  const subName = context.subredditName;
  const normalizedWord = normalizeWord(word);
  await redis.zRem(REDIS_KEYS.wordsBanned(subName), [normalizedWord]);
}

/**
 * Get all banned words for the current subreddit
 */

export async function getAllBannedWords(): Promise<string[]> {
  const subName = context.subredditName;
  const key = REDIS_KEYS.wordsBanned(subName);
  // TODO: Will break if list gets too long. Paginate before then.
  const words = await redis.zRange(key, 0, -1);
  return words.map((item) => item.member);
}

/**
 * Replaces the entire banned words list with a new one. Existing words are filtered based on the new list.
 */

export async function replaceBannedWords(words: string[]): Promise<void> {
  const subName = context.subredditName;
  await redis.del(REDIS_KEYS.wordsBanned(subName));
  if (words.length === 0) return;
  const normalizedWords = words.map((word) => normalizeWord(word));
  await banWords(normalizedWords);
}

/**
 * Check if a word is banned in the current subreddit. Returns `true` if the word is banned, `false` otherwise.
 */

export async function isWordBanned(word: string): Promise<boolean> {
  const subName = context.subredditName;
  const normalizedWord = normalizeWord(word);
  const result = await redis.zScore(
    REDIS_KEYS.wordsBanned(subName),
    normalizedWord
  );
  return result !== undefined;
}

/**
 * Get random words from a dictionary
 * @param count - The number of words to get
 * @returns The random words as CandidateWord objects
 */

export async function getRandomWords(count: number = 3): Promise<string[]> {
  const words = await getAllWords();
  const shuffled = shuffle(words);
  const result = shuffled.slice(0, count);
  return result;
}

/**
 * Initialize the dictionary in the current subreddit. It's idempotent, so it can be called multiple times without causing issues.
 */

export async function initDictionary(): Promise<void> {
  const subredditName = context.subredditName;

  try {
    const wordsKey = REDIS_KEYS.wordsAll(subredditName);

    const [words, _communityAdditions] = await Promise.all([
      redis.global.exists(wordsKey),
      redis.global.zAdd(REDIS_KEYS.communities(), {
        member: subredditName,
        score: Date.now(),
      }),
    ]);

    if (words !== 0) {
      return; // Already initialized
    }

    await redis.global.zAdd(
      REDIS_KEYS.wordsAll(subredditName),
      ...DEFAULT_WORDS.map((word) => ({
        member: word,
        score: DEFAULT_WORD_SCORE,
      }))
    );
  } catch (error) {
    throw error;
  }
}
