import { redis } from '@devvit/web/server';
import { DEFAULT_WORDS } from '../../shared/constants';
import { titleCase } from '../../shared/utils/string';
import { shuffle } from '../../shared/utils/array';
import { REDIS_KEYS } from './redis';
import { getAllChampionWords } from './champion-comments';
import type { T3 } from '../../shared/types';

/*

Dictionary Service

All words are stored using subreddit-scoped Redis sorted sets to:
- Enable per-subreddit word scoring for slate-bandit system
- Enable word metrics tracking (impressions, clicks, publishes)
- Maintain alphabetical ordering with scores

*/

/**
 * Get the dictionary for a subreddit
 * @param subredditName - The name of the subreddit to get the dictionary for
 * @returns The dictionary for the subreddit
 */

export async function getWords(subredditName: string): Promise<string[]> {
  const key = REDIS_KEYS.wordScores(subredditName);
  const words = await redis.zRange(key, 0, -1);
  return words.map((item) => item.member);
}

/**
 * Add a word to the dictionary
 * @param subredditName - The name of the subreddit to add the word to
 * @param word - The word to add to the dictionary
 * @returns True if the word was added, false if it already exists or is banned
 */

export async function addWord(
  subredditName: string,
  word: string
): Promise<boolean> {
  const [dictionary, bannedWords] = await Promise.all([
    getWords(subredditName),
    getBannedWords(subredditName),
  ]);

  // Format the suggestion
  const normalizedWord = titleCase(word.trim());

  // Check if word already exists (case-insensitive)
  const exists = dictionary.includes(normalizedWord);
  if (exists) return false;

  // Check if word is banned (case-insensitive)
  const banned = bannedWords.includes(normalizedWord);
  if (banned) return false;

  // Add word to sorted set with default score of 1
  const key = REDIS_KEYS.wordScores(subredditName);
  await redis.zAdd(key, {
    member: normalizedWord,
    score: 1,
  });

  return true;
}

/**
 * Wholesale update the words for a subreddit
 * This is useful for when you want to update the dictionary for a subreddit without having to worry about the existing words.
 * @param subredditName - The name of the subreddit to update the words for
 * @param words - The words to update the dictionary with
 */

export async function updateWords(
  subredditName: string,
  words: string[]
): Promise<void> {
  const key = REDIS_KEYS.wordScores(subredditName);
  const parsedWords = words.map((word) => titleCase(word.trim()));

  // Clear existing words and add new ones with default score of 1
  await redis.del(key);
  if (parsedWords.length > 0) {
    await redis.zAdd(
      key,
      ...parsedWords.map((word) => ({ member: word, score: 1 }))
    );
  }
}

/**
 * Remove a word from the dictionary
 * @param subredditName - The name of the subreddit to remove the word from
 * @param word - The word to remove from the dictionary
 * @returns True if the word was removed, false if it was not found
 */

export async function removeWord(
  subredditName: string,
  word: string
): Promise<boolean> {
  const normalizedWord = titleCase(word.trim());
  const key = REDIS_KEYS.wordScores(subredditName);

  // Remove word from sorted set
  const removed = await redis.zRem(key, [normalizedWord]);
  return removed > 0;
}

/**
 * Get the banned words for a subreddit
 * @param subredditName - The name of the subreddit to get the banned words for
 * @returns The banned words for the subreddit
 */

export async function getBannedWords(subredditName: string): Promise<string[]> {
  const words = await redis.get(REDIS_KEYS.bannedWords(subredditName));
  if (!words) return [];
  const wordArray = JSON.parse(words) as string[];
  return wordArray;
}

/**
 * Ban a word
 * @param subredditName - The name of the subreddit to ban the word for
 * @param word - The word to ban
 * @returns True if the word was banned, false if it was already banned
 */

export async function banWord(
  subredditName: string,
  word: string
): Promise<boolean> {
  const bannedWords = await getBannedWords(subredditName);
  const normalizedWord = titleCase(word.trim());

  // Check if already banned
  const exists = bannedWords.includes(normalizedWord);
  if (exists) return false;

  // Add word and sort list alphabetically
  bannedWords.push(normalizedWord);
  bannedWords.sort();

  // Save back to Redis
  const key = REDIS_KEYS.bannedWords(subredditName);
  await redis.set(key, JSON.stringify(bannedWords));
  return true;
}

/**
 * Wholesale update the banned words for a subreddit
 * This is useful for when you want to update the banned words for a subreddit without having to worry about the existing banned words.
 * @param subredditName - The name of the subreddit to update the banned words for
 * @param words - The words to update the banned words with
 */

export async function updateBannedWords(
  subredditName: string,
  words: string[]
): Promise<void> {
  const key = REDIS_KEYS.bannedWords(subredditName);
  const parsedWords = words.map((word) => titleCase(word.trim())).sort();
  await redis.set(key, JSON.stringify(parsedWords));
}

/**
 * Unban a word
 * @param subredditName - The name of the subreddit to remove the banned word from
 * @param word - The word to unban
 * @returns True if the word was unbanned, false if it was not banned
 */

export async function unbanWord(
  subredditName: string,
  word: string
): Promise<boolean> {
  const bannedWords = await getBannedWords(subredditName);
  const normalizedWord = titleCase(word.trim());

  // Remove word (case-insensitive)
  const originalLength = bannedWords.length;
  const filtered = bannedWords.filter((word) => word !== normalizedWord);

  // Return false if word not found
  if (filtered.length === originalLength) return false;

  const key = REDIS_KEYS.bannedWords(subredditName);
  await redis.set(key, JSON.stringify(filtered));
  return true;
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
  const words = await getWords(subredditName);
  const shuffled = shuffle<string>(words);
  const result = shuffled.slice(0, count);
  const dictionaryName = `r/${subredditName}`;
  return result.map((word) => ({
    word,
    dictionaryName,
  }));
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
    redis.exists(REDIS_KEYS.wordScores(subredditName)),
    redis.exists(REDIS_KEYS.bannedWords(subredditName)),
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
        REDIS_KEYS.wordScores(subredditName),
        ...DEFAULT_WORDS.map((word) => ({ member: word, score: 1 }))
      )
    );
  }

  if (!bannedWords) {
    seedActions.push(
      redis.set(REDIS_KEYS.bannedWords(subredditName), JSON.stringify([]))
    );
  }

  if (seedActions.length > 0) {
    await Promise.all(seedActions);
  }
}

/**
 * Get all allowed words for a post (dictionary words + champion comment words - banned words)
 * @param subredditName - The subreddit name
 * @param postId - The post ID
 * @returns Array of allowed words that can appear unobfuscated
 */
export async function getAllowedWords(
  subredditName: string,
  postId: T3
): Promise<string[]> {
  const [dictionaryWords, championWords, bannedWords] = await Promise.all([
    getWords(subredditName),
    getAllChampionWords(postId),
    getBannedWords(subredditName),
  ]);

  // Combine dictionary and champion words
  const allWords = [...dictionaryWords, ...championWords];

  // Normalize all words to titleCase for consistent comparison
  const normalizedWords = allWords.map((word) => titleCase(word.trim()));
  const normalizedBannedWords = bannedWords.map((word) =>
    titleCase(word.trim())
  );

  // Remove duplicates and banned words
  const allowedWords = normalizedWords.filter((word, index, arr) => {
    // Remove duplicates (case-insensitive)
    const firstIndex = arr.findIndex(
      (w) => w.toLowerCase() === word.toLowerCase()
    );
    if (firstIndex !== index) return false;

    // Remove banned words (case-insensitive)
    const isBanned = normalizedBannedWords.some(
      (bannedWord) => bannedWord.toLowerCase() === word.toLowerCase()
    );
    return !isBanned;
  });

  return allowedWords;
}
