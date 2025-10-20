import { context, redis } from '@devvit/web/server';
import { isT1, type T1 } from '@devvit/shared-types/tid.js';
import { DEFAULT_WORDS } from '../../shared/constants';
import { normalizeWord } from '../../shared/utils/string';
import { shuffle } from '../../shared/utils/array';
import { REDIS_KEYS } from './redis';

const DEFAULT_WORD_SCORE = 1;

/*

Dictionary Service

All words are stored using subreddit-scoped Redis sorted sets to:
- Enable per-subreddit word scoring for slate-bandit system
- Enable word metrics tracking (impressions, clicks, publishes)
- Maintain alphabetical ordering with scores

*/

/*
 * Champion Comments Service
 *
 * Manages champion comments created by !show command.
 * Champion comments allow non-dictionary words to appear unobfuscated
 * in the UI. If a champion comment is removed by Reddit's safety systems,
 * the word loses its unobfuscated status.
 */

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
 * Add a word to the dictionary for the current subreddit. Returns `true` if the word was added, `false` if it already exists or is banned.
 */

export async function addWord(word: string): Promise<boolean> {
  const subName = context.subredditName;
  const normalizedWord = normalizeWord(word);

  // Check if word is in dictionary or banned.
  const [isInDictionary, isBanned] = await Promise.all([
    isWordInList(normalizedWord),
    isWordBanned(normalizedWord),
  ]);

  // Bail if the word already exists or is banned
  if (isInDictionary || isBanned) return false;

  // Save changes to Redis
  const promises: Promise<unknown>[] = [
    redis.global.zAdd(REDIS_KEYS.wordsAll(subName), {
      member: normalizedWord,
      score: DEFAULT_WORD_SCORE,
    }),
  ];

  await Promise.all(promises);
  return true;
}

/**
 * Remove a word from the dictionary
 */

export async function removeWord(word: string): Promise<boolean> {
  const normalizedWord = normalizeWord(word);
  const key = REDIS_KEYS.wordsAll(context.subredditName);
  const removed = await redis.global.zRem(key, [normalizedWord]);
  return removed > 0;
}

/**
 * Get all words from the dictionary for a given subreddit, or the current subreddit if no subreddit name is provided.
 */

export async function getAllWords(subredditName?: string): Promise<string[]> {
  const subName = subredditName ?? context.subredditName;
  const key = REDIS_KEYS.wordsAll(subName);
  // TODO: We may need to paginate this if the list gets too long.
  const entities = await redis.global.zRange(key, 0, -1);
  const words = entities.map((item) => item.member);
  return words;
}

/**
 * Wholesale replace the words for a subreddit
 * This is useful for when you want to replace the dictionary for a subreddit without having to worry about the existing words.
 */

export async function replaceAllWords(words: string[]): Promise<void> {
  const key = REDIS_KEYS.wordsAll(context.subredditName);

  // Normalize all the input words.
  const parsedWords = words.map((word) => normalizeWord(word)).sort();

  // Filter out banned words.
  const bannedWords = await getBannedWords();
  const filteredWords = parsedWords.filter(
    (word) => !bannedWords.includes(word)
  );

  // Clear existing words and add new ones with default score
  await redis.del(key);
  await redis.global.zAdd(
    key,
    ...filteredWords.map((word) => ({
      member: word,
      score: DEFAULT_WORD_SCORE,
    }))
  );
}

/**
 * Get the banned words for a subreddit
 * @param subredditName - The name of the subreddit to get the banned words for
 * @returns The banned words for the subreddit
 */

export async function getBannedWords(): Promise<string[]> {
  const key = REDIS_KEYS.wordsBanned(context.subredditName);
  // TODO: We may need to paginate this if the list gets too long.
  const words = await redis.zRange(key, 0, -1);
  return words.map((item) => item.member);
}

/**
 * Ban a word
 * @param word - The word to ban
 * @returns True if the word was banned, false if it was already banned
 */

export async function banWord(word: string): Promise<boolean> {
  const normalizedWord = normalizeWord(word);
  const [banned, _removedFromDictionary] = await Promise.all([
    redis
      .zAdd(REDIS_KEYS.wordsBanned(context.subredditName), {
        member: normalizedWord,
        score: DEFAULT_WORD_SCORE,
      })
      .then((result) => result > 0),
    redis
      .zRem(REDIS_KEYS.wordsAll(context.subredditName), [normalizedWord])
      .then((result) => result > 0),
  ]);
  return banned;
}

/**
 * Unban a word
 * @param word - The word to unban
 * @returns True if the word was unbanned, false if it was not banned
 */

export async function unbanWord(word: string): Promise<boolean> {
  const normalizedWord = normalizeWord(word);
  const unbanned = await redis
    .zRem(REDIS_KEYS.wordsBanned(context.subredditName), [normalizedWord])
    .then((result) => result > 0);
  return unbanned;
}

/**
 * Wholesale replace the banned words for a subreddit
 * This is useful for when you want to replace the banned words for a subreddit without having to worry about the existing banned words.
 * @param words - The words to replace the banned words with
 */

export async function replaceBannedWords(words: string[]): Promise<void> {
  const key = REDIS_KEYS.wordsBanned(context.subredditName);
  const normalizedWords = words.map((word) => normalizeWord(word));
  await redis.del(key);
  if (normalizedWords.length > 0) {
    await redis.zAdd(
      key,
      ...normalizedWords.map((word) => ({
        member: word,
        score: DEFAULT_WORD_SCORE,
      }))
    );

    // Remove any current words that may now be banned.
    const currentWords = await getAllWords();
    const wordsToRemove = currentWords.filter((word) =>
      normalizedWords.includes(word)
    );
    if (wordsToRemove.length > 0) {
      await redis.zRem(key, wordsToRemove);
    }
  }
}

/**
 * Get random words from a dictionary
 * @param subredditName - The name of the subreddit to get the words from
 * @param count - The number of words to get
 * @returns The random words as CandidateWord objects
 */

export async function getRandomWords(
  subredditName: string,
  count: number = 3
): Promise<Array<{ word: string; dictionaryName: string }>> {
  const words = await getAllWords();
  const shuffled = shuffle<string>(words);
  const result = shuffled.slice(0, count);
  const dictionaryName = `r/${subredditName}`;
  return result.map((word) => ({
    word,
    dictionaryName,
  }));
}

/**
 * Check if a word is banned in the current subreddit. Returns `true` if the word is banned, `false` otherwise.
 */

export async function isWordBanned(word: string): Promise<boolean> {
  const normalizedWord = normalizeWord(word);
  const isBanned = await redis
    .zScore(REDIS_KEYS.wordsBanned(context.subredditName), normalizedWord)
    .then((score) => score !== undefined);
  return isBanned;
}

/**
 * Set a champion comment for a word in a subreddit
 * @param word - The word to set champion comment for
 * @param commentId - The comment ID that serves as champion
 */
export async function setWordChampion(
  word: string,
  commentId: T1
): Promise<void> {
  const subredditName = context.subredditName;
  const normalizedWord = normalizeWord(word);

  // Check if word is banned
  const [isBanned, currentChamp] = await Promise.all([
    isWordBanned(normalizedWord),
    getWordChampion(normalizedWord),
  ]);
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
    // Prevent any stray redis keys from being left behind
    promises.push(redis.del(REDIS_KEYS.championWord(currentChamp)));
  }

  await Promise.all(promises);
}

/**
 * Get the champion comment ID for a word
 * @param word - The word to get champion comment for
 * @returns The comment ID if it exists, null otherwise
 */
export async function getWordChampion(word: string): Promise<T1 | null> {
  const normalizedWord = normalizeWord(word);
  const key = REDIS_KEYS.wordChampion(normalizedWord);
  const commentId = await redis.get(key);
  return commentId && isT1(commentId) ? commentId : null;
}

/**
 * Remove a champion comment for a word in a subreddit
 * @param subredditName - The subreddit name
 * @param word - The word to remove champion comment for
 */
export async function removeWordChampion(word: string): Promise<void> {
  const normalizedWord = normalizeWord(word);
  const subredditName = context.subredditName;
  const commentId = await getWordChampion(normalizedWord);
  if (!commentId) return;

  await Promise.all([
    redis.zRem(REDIS_KEYS.wordsChampioned(subredditName), [normalizedWord]),
    redis.del(REDIS_KEYS.wordChampion(normalizedWord)),
    redis.del(REDIS_KEYS.championWord(commentId)),
  ]);
}

/**
 * Initialize the dictionary for a subreddit. It's idempotent, so it can be called multiple times without causing issues.
 * @param subredditName - The name of the subreddit to initialize the dictionary for
 */

export async function initializeDictionary(
  subredditName: string
): Promise<void> {
  // Check if dictionary already exists
  const [words, bannedWords] = await Promise.all([
    redis.exists(REDIS_KEYS.wordsAll(subredditName)),
    redis.exists(REDIS_KEYS.wordsBanned(subredditName)),
    redis.global.zAdd(REDIS_KEYS.communities(), {
      member: subredditName,
      score: Date.now(),
    }),
  ]);

  if (words && bannedWords) {
    return; // Already initialized
  }

  const seedActions: Promise<unknown>[] = [];

  if (!words) {
    seedActions.push(
      redis.zAdd(
        REDIS_KEYS.wordsAll(subredditName),
        ...DEFAULT_WORDS.map((word) => ({ member: word, score: 1 }))
      )
    );
  }

  if (!bannedWords) {
    seedActions.push(
      redis.set(REDIS_KEYS.wordsBanned(subredditName), JSON.stringify([]))
    );
  }

  if (seedActions.length > 0) {
    await Promise.all(seedActions);
  }
}
