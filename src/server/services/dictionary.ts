import { redis } from '@devvit/web/server';
import { WORDS } from '../../shared/words';
import type { T5 } from '../../shared/types/TID';
import { capitalize } from '../../shared/utils/string';
import { shuffle } from '../../shared/utils/math';

/*

Dictionary Service

All words are stored using global Redis as opposed to per-subreddit Redis to:
- Enable cross-community dictionary sharing
- Enable additional safety guards

*/

/*
 * Redis Keys
 */

const wordsKey = (subredditId: T5) => `words:${subredditId}`;
const bannedWordsKey = (subredditId: T5) => `banned-words:${subredditId}`;
const communitiesKey = 'communities';

/**
 * Get the dictionary for a subreddit
 * @param subredditName - The name of the subreddit to get the dictionary for
 * @returns The dictionary for the subreddit
 */

export async function getWords(subredditId: T5): Promise<string[]> {
  const key = wordsKey(subredditId);
  const words = await redis.global.get(key);
  if (!words) return [];
  return JSON.parse(words) as string[];
}

/**
 * Add a word to the dictionary
 * @param subredditId - The id of the subreddit to add the word to
 * @param word - The word to add to the dictionary
 * @returns True if the word was added, false if it already exists or is banned
 */

export async function addWord(subredditId: T5, word: string): Promise<boolean> {
  const [dictionary, bannedWords] = await Promise.all([
    getWords(subredditId),
    getBannedWords(subredditId),
  ]);

  // Format the suggestion
  const normalizedWord = capitalize(word.trim());

  // Check if word already exists (case-insensitive)
  const exists = dictionary.includes(normalizedWord);
  if (exists) return false;

  // Check if word is banned (case-insensitive)
  const banned = bannedWords.includes(normalizedWord);
  if (banned) return false;

  // Add word and sort list alphabetically
  dictionary.push(normalizedWord);
  dictionary.sort();

  // Save back to Redis
  const key = wordsKey(subredditId);
  await redis.global.set(key, JSON.stringify(dictionary));

  return true;
}

/**
 * Wholesale update the words for a subreddit
 * This is useful for when you want to update the dictionary for a subreddit without having to worry about the existing words.
 * @param subredditId - The id of the subreddit to update the words for
 * @param words - The words to update the dictionary with
 */

export async function updateWords(
  subredditId: T5,
  words: string[]
): Promise<void> {
  const key = wordsKey(subredditId);
  const parsedWords = words.map((word) => capitalize(word.trim())).sort();
  await redis.global.set(key, JSON.stringify(parsedWords));
}

/**
 * Remove a word from the dictionary
 * @param subredditId - The id of the subreddit to remove the word from
 * @param word - The word to remove from the dictionary
 * @returns True if the word was removed, false if it was not found
 */

export async function removeWord(
  subredditId: T5,
  word: string
): Promise<boolean> {
  const dictionary = await getWords(subredditId);

  // Format the removal petition
  const normalizedWord = capitalize(word.trim());

  // Remove word (case-insensitive)
  const originalLength = dictionary.length;
  const filtered = dictionary.filter((word) => word !== normalizedWord);

  // Return false if word not found
  if (filtered.length === originalLength) return false;

  // Save back to Redis
  const key = wordsKey(subredditId);
  await redis.global.set(key, JSON.stringify(filtered));

  return true;
}

/**
 * Get the banned words for a subreddit
 * @param subredditId - The id of the subreddit to get the banned words for
 * @returns The banned words for the subreddit
 */

export async function getBannedWords(subredditId: T5): Promise<string[]> {
  const words = await redis.global.get(bannedWordsKey(subredditId));
  if (!words) return [];
  const wordArray = JSON.parse(words) as string[];
  return wordArray;
}

/**
 * Ban a word
 * @param subredditId - The id of the subreddit to ban the word for
 * @param word - The word to ban
 * @returns True if the word was banned, false if it was already banned
 */

export async function banWord(subredditId: T5, word: string): Promise<boolean> {
  const bannedWords = await getBannedWords(subredditId);
  const normalizedWord = capitalize(word.trim());

  // Check if already banned
  const exists = bannedWords.includes(normalizedWord);
  if (exists) return false;

  // Add word and sort list alphabetically
  bannedWords.push(normalizedWord);
  bannedWords.sort();

  // Save back to Redis
  const key = bannedWordsKey(subredditId);
  await redis.global.set(key, JSON.stringify(bannedWords));
  return true;
}

/**
 * Wholesale update the banned words for a subreddit
 * This is useful for when you want to update the banned words for a subreddit without having to worry about the existing banned words.
 * @param subredditId - The id of the subreddit to update the banned words for
 * @param words - The words to update the banned words with
 */

export async function updateBannedWords(
  subredditId: T5,
  words: string[]
): Promise<void> {
  const key = bannedWordsKey(subredditId);
  const parsedWords = words.map((word) => capitalize(word.trim())).sort();
  await redis.global.set(key, JSON.stringify(parsedWords));
}

/**
 * Unban a word
 * @param subredditId - The id of the subreddit to remove the banned word from
 * @param word - The word to unban
 * @returns True if the word was unbanned, false if it was not banned
 */

export async function unbanWord(
  subredditId: T5,
  word: string
): Promise<boolean> {
  const bannedWords = await getBannedWords(subredditId);
  const normalizedWord = capitalize(word.trim());

  // Remove word (case-insensitive)
  const originalLength = bannedWords.length;
  const filtered = bannedWords.filter((word) => word !== normalizedWord);

  // Return false if word not found
  if (filtered.length === originalLength) return false;

  const key = bannedWordsKey(subredditId);
  await redis.global.set(key, JSON.stringify(filtered));
  return true;
}

/**
 * Get random words from a dictionary
 * @param subredditId - The id of the subreddit to get the words from
 * @param count - The number of words to get
 * @returns The random words
 */

export async function getRandomWords(
  subredditId: T5,
  count: number
): Promise<string[]> {
  const words = await getWords(subredditId);
  const shuffled = shuffle<string>(words);
  const result = shuffled.slice(0, count);
  return result;
}

/**
 * Initialize the dictionary for a subreddit. It's idempotent, so it can be called multiple times without causing issues.
 * @param subredditId - The id of the subreddit to initialize the dictionary for
 */

export async function initializeDictionary(subredditId: T5): Promise<void> {
  // Check if dictionary already exists
  const [words, bannedWords] = await Promise.all([
    redis.global.get(wordsKey(subredditId)).then((words) => !!words),
    redis.global
      .get(bannedWordsKey(subredditId))
      .then((bannedWords) => !!bannedWords),
    redis.global.zAdd(communitiesKey, {
      member: subredditId,
      score: Date.now(),
    }),
  ]);

  if (words && bannedWords) {
    return; // Already initialized
  }

  const seedActions: Promise<unknown>[] = [];

  if (!words) {
    seedActions.push(
      redis.global.set(wordsKey(subredditId), JSON.stringify(WORDS))
    );
  }

  if (!bannedWords) {
    seedActions.push(
      redis.global.set(bannedWordsKey(subredditId), JSON.stringify([]))
    );
  }

  if (seedActions.length > 0) {
    await Promise.all(seedActions);
  }
}
