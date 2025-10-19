import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from './redis';
import { getBannedWords } from './dictionary';

/**
 * Champion Comments Service
 *
 * Manages champion comments created by !show command.
 * Champion comments allow non-dictionary words to appear unobfuscated
 * in the UI. If a champion comment is removed by Reddit's safety systems,
 * the word loses its unobfuscated status.
 */

/**
 * Set a champion comment for a word in a subreddit
 * @param subredditName - The subreddit name
 * @param word - The word to set champion comment for
 * @param commentId - The comment ID that serves as champion
 */
export async function setChampionComment(
  subredditName: string,
  word: string,
  commentId: string
): Promise<void> {
  const normalizedWord = word.toLowerCase();
  const championWordsKey = REDIS_KEYS.wordsChampioned(subredditName);
  const wordToCommentKey = REDIS_KEYS.wordChampion(normalizedWord);
  const commentToWordKey = REDIS_KEYS.championWord(commentId);

  // Get existing champion words
  const existingWords = await getAllChampionWords(subredditName);

  // Add word to champion words list if not already present
  if (!existingWords.includes(normalizedWord)) {
    const updatedWords = [...existingWords, normalizedWord].sort();
    await redis.set(championWordsKey, JSON.stringify(updatedWords));
  }

  // Set word -> commentId mapping
  await redis.set(wordToCommentKey, commentId);

  // Set commentId -> {subredditName, word} mapping
  await redis.set(commentToWordKey, JSON.stringify({ subredditName, word }));
}

/**
 * Get the champion comment ID for a word
 * @param word - The word to get champion comment for
 * @returns The comment ID if it exists, null otherwise
 */
export async function getChampionComment(word: string): Promise<string | null> {
  const normalizedWord = word.toLowerCase();
  const wordToCommentKey = REDIS_KEYS.wordChampion(normalizedWord);
  const commentId = await redis.get(wordToCommentKey);
  return commentId ?? null;
}

/**
 * Remove a champion comment for a word in a subreddit
 * @param subredditName - The subreddit name
 * @param word - The word to remove champion comment for
 */
export async function removeChampionComment(
  subredditName: string,
  word: string
): Promise<void> {
  const normalizedWord = word.toLowerCase();
  const championWordsKey = REDIS_KEYS.wordsChampioned(subredditName);
  const wordToCommentKey = REDIS_KEYS.wordChampion(normalizedWord);

  // Get commentId before deleting
  const commentId = await redis.get(wordToCommentKey);

  // Remove word from champion words list
  const existingWords = await getAllChampionWords(subredditName);
  const updatedWords = existingWords.filter((w) => w !== normalizedWord);
  await redis.set(championWordsKey, JSON.stringify(updatedWords));

  // Delete word -> commentId mapping
  await redis.del(wordToCommentKey);

  // Delete commentId -> {subredditName, word} mapping if commentId exists
  if (commentId) {
    const commentToWordKey = REDIS_KEYS.championWord(commentId);
    await redis.del(commentToWordKey);
  }
}

/**
 * Get all words that have champion comments in a subreddit
 * @param subredditName - The subreddit name
 * @returns Array of words with champion comments
 */
export async function getAllChampionWords(
  subredditName: string
): Promise<string[]> {
  const championWordsKey = REDIS_KEYS.wordsChampioned(subredditName);
  const data = await redis.get(championWordsKey);

  if (!data) {
    return [];
  }

  try {
    return JSON.parse(data) as string[];
  } catch {
    return [];
  }
}

/**
 * Check if a word is banned in a subreddit
 * @param subredditName - The subreddit name
 * @param word - The word to check
 * @returns True if the word is banned
 */
export async function isWordBanned(
  subredditName: string,
  word: string
): Promise<boolean> {
  const bannedWords = await getBannedWords(subredditName);
  return bannedWords.some(
    (bannedWord) => bannedWord.toLowerCase() === word.toLowerCase()
  );
}

/**
 * Check if a comment ID is a champion comment for any word in any subreddit
 * This is used when handling comment deletion to enforce champion removal
 * @param commentId - The comment ID to check
 * @returns Object with subredditName and word if found, null otherwise
 */
export async function findChampionCommentByCommentId(
  commentId: string
): Promise<{ subredditName: string; word: string } | null> {
  const commentToWordKey = REDIS_KEYS.championWord(commentId);
  const data = await redis.get(commentToWordKey);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data) as { subredditName: string; word: string };
  } catch {
    return null;
  }
}
