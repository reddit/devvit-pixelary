import { redis } from '@devvit/web/server';
import { RedisKeyFactory, RedisService } from './redis-factory';
import type {
  Dictionary,
  CandidateWord,
  WordMetadata,
  WordStats,
  WordCommandComment,
} from '../../shared/schema/pixelary';
import { WORDS } from '../../shared/words';

/**
 * Dictionary management service for Pixelary
 * Handles community-specific dictionaries and word selection
 */

export async function getDictionary(
  subredditName: string
): Promise<Dictionary | null> {
  const key = RedisKeyFactory.dictionaryKey(subredditName);
  const words = await RedisService.get<string[]>(key);

  if (!words) {
    return null;
  }

  return {
    name: `r/${subredditName}`,
    words: Array.isArray(words) ? words : [],
  };
}

export async function addWordToDictionary(
  subredditName: string,
  word: string,
  addedBy?: string,
  commentId?: string
): Promise<boolean> {
  const dictionary = await getDictionary(subredditName);
  if (!dictionary) {
    return false;
  }

  const normalizedWord = capitalize(word.trim());

  // Check if word already exists (case-insensitive)
  const exists = dictionary.words.some(
    (w) => w.toLowerCase() === normalizedWord.toLowerCase()
  );
  if (exists) {
    return false;
  }

  // Check if word is banned
  const bannedWords = await getBannedWords(subredditName);
  const isBanned = bannedWords.some(
    (w) => w.toLowerCase() === normalizedWord.toLowerCase()
  );
  if (isBanned) {
    return false;
  }

  // Add word and sort
  dictionary.words.push(normalizedWord);
  dictionary.words.sort();

  // Save back to Redis
  const key = RedisKeyFactory.dictionaryKey(subredditName);
  const success = await RedisService.set(key, JSON.stringify(dictionary.words));

  // If metadata tracking is provided, store it
  if (success && addedBy && commentId) {
    await addWordMetadata(subredditName, normalizedWord, addedBy, commentId);
  }

  return success;
}

export async function removeWordFromDictionary(
  subredditName: string,
  word: string
): Promise<boolean> {
  const dictionary = await getDictionary(subredditName);
  if (!dictionary) {
    return false;
  }

  const normalizedWord = capitalize(word.trim());

  // Remove word (case-insensitive)
  const originalLength = dictionary.words.length;
  dictionary.words = dictionary.words.filter(
    (w) => w.toLowerCase() !== normalizedWord.toLowerCase()
  );

  if (dictionary.words.length === originalLength) {
    return false; // Word not found
  }

  // Save back to Redis
  const key = RedisKeyFactory.dictionaryKey(subredditName);
  const success = await RedisService.set(key, JSON.stringify(dictionary.words));

  // Clean up metadata if removal was successful
  if (success) {
    await removeWordMetadata(subredditName, normalizedWord);
  }

  return success;
}

export async function getBannedWords(subredditName: string): Promise<string[]> {
  const key = RedisKeyFactory.bannedWordsKey(subredditName);
  const words = await RedisService.get<string[]>(key);

  if (!words) {
    return [];
  }

  return Array.isArray(words) ? words : [];
}

export async function addBannedWord(
  subredditName: string,
  word: string
): Promise<boolean> {
  const bannedWords = await getBannedWords(subredditName);
  const normalizedWord = capitalize(word.trim());

  // Check if already banned
  const exists = bannedWords.some(
    (w) => w.toLowerCase() === normalizedWord.toLowerCase()
  );
  if (exists) {
    return false;
  }

  bannedWords.push(normalizedWord);
  bannedWords.sort();

  const key = RedisKeyFactory.bannedWordsKey(subredditName);
  return await RedisService.set(key, JSON.stringify(bannedWords));
}

export async function removeBannedWord(
  subredditName: string,
  word: string
): Promise<boolean> {
  const bannedWords = await getBannedWords(subredditName);
  const normalizedWord = capitalize(word.trim());

  const originalLength = bannedWords.length;
  const filtered = bannedWords.filter(
    (w) => w.toLowerCase() !== normalizedWord.toLowerCase()
  );

  if (filtered.length === originalLength) {
    return false; // Word not found
  }

  const key = RedisKeyFactory.bannedWordsKey(subredditName);
  return await RedisService.set(key, JSON.stringify(filtered));
}

export async function getFeaturedCommunity(): Promise<string | null> {
  const key = RedisKeyFactory.featuredCommunityKey();
  return await RedisService.get<string>(key);
}

export async function setFeaturedCommunity(
  subredditName: string
): Promise<boolean> {
  const key = RedisKeyFactory.featuredCommunityKey();
  return await RedisService.set(key, subredditName);
}

export async function getCommunities(): Promise<string[]> {
  const key = RedisKeyFactory.communitiesKey();
  try {
    const communities = await redis.zRange(key, 0, -1, {
      reverse: true,
      by: 'rank',
    });
    return communities.map((c) => c.member as string);
  } catch (error) {
    console.error('Error fetching communities:', error);
    return [];
  }
}

export async function addCommunity(subredditName: string): Promise<boolean> {
  const key = RedisKeyFactory.communitiesKey();
  try {
    await redis.zAdd(key, { member: subredditName, score: Date.now() });
    return true;
  } catch (error) {
    console.error(`Error adding community ${subredditName}:`, error);
    return false;
  }
}

export function getRandomWords(
  dictionary: Dictionary,
  count: number
): CandidateWord[] {
  const words = [...dictionary.words];
  const shuffled = shuffle(words);
  return shuffled.slice(0, count).map((word) => ({
    dictionaryName: dictionary.name,
    word,
  }));
}

export function getWordCandidates(dictionaries: Dictionary[]): CandidateWord[] {
  const CANDIDATE_COUNT = 3;
  const FEATURE_COUNT = 2;

  const candidates: CandidateWord[] = [];
  const isPixelary = dictionaries.some((d) => d.name === 'r/Pixelary');
  const isTakeoverActive = dictionaries.length > 1;

  if (isPixelary && isTakeoverActive) {
    // Main dictionary gets 1 word, featured gets 2
    candidates.push(
      ...getRandomWords(dictionaries[0]!, CANDIDATE_COUNT - FEATURE_COUNT)
    );
    candidates.push(...getRandomWords(dictionaries[1]!, FEATURE_COUNT));
  } else {
    // Single dictionary gets all 3
    candidates.push(...getRandomWords(dictionaries[0]!, CANDIDATE_COUNT));
  }

  return candidates;
}

export async function getWordCandidatesForSubreddit(
  subredditName: string
): Promise<CandidateWord[]> {
  const dictionaries: Dictionary[] = [];

  // Get main dictionary
  const mainDict = await getDictionary(subredditName);
  if (mainDict) {
    dictionaries.push(mainDict);
  }

  // If this is r/Pixelary, get featured community dictionary
  if (subredditName === 'Pixelary') {
    const featuredCommunity = await getFeaturedCommunity();
    if (featuredCommunity && featuredCommunity !== subredditName) {
      const featuredDict = await getDictionary(featuredCommunity);
      if (featuredDict) {
        dictionaries.push(featuredDict);
      }
    }
  }

  // Fallback to default words if no dictionaries found
  if (dictionaries.length === 0) {
    const defaultDict: Dictionary = {
      name: 'default',
      words: [...WORDS], // Create a mutable copy
    };
    dictionaries.push(defaultDict);
  }

  const candidates = getWordCandidates(dictionaries);

  // Track exposure stats for each candidate word
  for (const candidate of candidates) {
    await incrementWordStat(subredditName, candidate.word, 'exposures');
  }

  return candidates;
}

export async function initializeDictionary(
  subredditName: string
): Promise<boolean> {
  const dictionary = await getDictionary(subredditName);
  if (dictionary) {
    return true; // Already initialized
  }

  // Initialize with default words
  const key = RedisKeyFactory.dictionaryKey(subredditName);
  const success = await RedisService.set(key, JSON.stringify(WORDS));

  if (success) {
    // Add to communities list
    await addCommunity(subredditName);
  }

  return success;
}

export async function updateDictionary(
  subredditName: string,
  words: string[]
): Promise<boolean> {
  const key = RedisKeyFactory.dictionaryKey(subredditName);
  const normalizedWords = words.map((word) => capitalize(word.trim())).sort();
  return await RedisService.set(key, JSON.stringify(normalizedWords));
}

export async function updateBannedWords(
  subredditName: string,
  words: string[]
): Promise<boolean> {
  const key = RedisKeyFactory.bannedWordsKey(subredditName);
  const normalizedWords = words.map((word) => capitalize(word.trim())).sort();
  return await RedisService.set(key, JSON.stringify(normalizedWords));
}

// Utility functions
function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function shuffle<T>(array: readonly T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  return shuffled;
}

// Word Metadata Functions

export async function addWordMetadata(
  subredditName: string,
  word: string,
  addedBy: string,
  commentId: string
): Promise<boolean> {
  const normalizedWord = capitalize(word.trim());
  const key = RedisKeyFactory.wordMetadataKey(subredditName, normalizedWord);

  const metadata: WordMetadata = {
    word: normalizedWord,
    addedBy,
    addedAt: Date.now(),
    commentId,
    reports: [],
    stats: {
      exposures: 0,
      picks: 0,
      submissions: 0,
      guesses: 0,
      solves: 0,
    },
  };

  return await RedisService.set(key, metadata);
}

export async function getWordMetadata(
  subredditName: string,
  word: string
): Promise<WordMetadata | null> {
  const normalizedWord = capitalize(word.trim());
  const key = RedisKeyFactory.wordMetadataKey(subredditName, normalizedWord);
  return await RedisService.get<WordMetadata>(key);
}

export async function removeWordMetadata(
  subredditName: string,
  word: string
): Promise<boolean> {
  const normalizedWord = capitalize(word.trim());
  const key = RedisKeyFactory.wordMetadataKey(subredditName, normalizedWord);
  return await RedisService.del(key);
}

export async function incrementWordStat(
  subredditName: string,
  word: string,
  stat: keyof WordStats,
  increment: number = 1
): Promise<boolean> {
  const metadata = await getWordMetadata(subredditName, word);
  if (!metadata) {
    return false;
  }

  metadata.stats[stat] += increment;
  const key = RedisKeyFactory.wordMetadataKey(subredditName, word);
  return await RedisService.set(key, metadata);
}

export async function clearWordReports(
  subredditName: string,
  word: string
): Promise<boolean> {
  const metadata = await getWordMetadata(subredditName, word);
  if (!metadata) {
    return false;
  }

  metadata.reports = [];
  const key = RedisKeyFactory.wordMetadataKey(subredditName, word);
  const success = await RedisService.set(key, metadata);

  // Remove from reported words sorted set
  if (success) {
    const reportedKey = RedisKeyFactory.reportedWordsKey(subredditName);
    await redis.zRem(reportedKey, [word.toLowerCase()]);
  }

  return success;
}

export async function getReportedWords(
  subredditName: string,
  limit: number = 50
): Promise<Array<{ word: string; reportCount: number }>> {
  const key = RedisKeyFactory.reportedWordsKey(subredditName);

  try {
    const results = await redis.zRange(key, 0, limit - 1, {
      reverse: true,
      by: 'rank',
    });

    return results.map((result) => ({
      word: result.member as string,
      reportCount: result.score,
    }));
  } catch (error) {
    console.error('Error fetching reported words:', error);
    return [];
  }
}

export async function trackWordCommandComment(
  subredditName: string,
  commentId: string,
  command: string,
  word: string,
  author: string
): Promise<boolean> {
  const key = RedisKeyFactory.wordCommandCommentsKey(subredditName);

  const commandData: WordCommandComment = {
    command,
    word: capitalize(word.trim()),
    author,
    timestamp: Date.now(),
  };

  return await RedisService.set(`${key}:${commentId}`, commandData);
}

export async function getWordCommandComment(
  subredditName: string,
  commentId: string
): Promise<WordCommandComment | null> {
  const key = RedisKeyFactory.wordCommandCommentsKey(subredditName);
  return await RedisService.get<WordCommandComment>(`${key}:${commentId}`);
}

export async function removeWordCommandComment(
  subredditName: string,
  commentId: string
): Promise<boolean> {
  const key = RedisKeyFactory.wordCommandCommentsKey(subredditName);
  return await RedisService.del(`${key}:${commentId}`);
}

// Word Analytics Functions

export async function trackWordPick(
  subredditName: string,
  word: string
): Promise<boolean> {
  return await incrementWordStat(subredditName, word, 'picks');
}

export async function trackWordSubmission(
  subredditName: string,
  word: string
): Promise<boolean> {
  return await incrementWordStat(subredditName, word, 'submissions');
}

export async function trackWordGuess(
  subredditName: string,
  word: string
): Promise<boolean> {
  return await incrementWordStat(subredditName, word, 'guesses');
}

export async function trackWordSolve(
  subredditName: string,
  word: string
): Promise<boolean> {
  return await incrementWordStat(subredditName, word, 'solves');
}
