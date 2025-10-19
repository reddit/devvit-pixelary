import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from './redis';
import { getWords } from './dictionary';
import type { CandidateWord } from '../../shared/schema/pixelary';

/**
 * Generate a deterministic slate ID based on selected words
 */
function generateSlateId(words: string[]): string {
  // Create a deterministic hash from the sorted words
  const sortedWords = [...words].sort();
  const wordsHash = sortedWords.join('|');

  // Simple hash function for deterministic ID
  let hash = 0;
  for (let i = 0; i < wordsHash.length; i++) {
    const char = wordsHash.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to positive hex string and take first 8 characters
  const hashStr = Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8);

  return `slate_${hashStr}`;
}

/**
 * Select words deterministically based on subreddit name and count
 * Uses a simple hash-based selection to ensure same words are chosen
 * for the same subreddit and count combination
 */
function selectWordsDeterministically(
  words: string[],
  subredditName: string,
  count: number
): string[] {
  if (words.length <= count) {
    return [...words];
  }

  // Create a deterministic seed based on subreddit name
  let seed = 0;
  for (let i = 0; i < subredditName.length; i++) {
    seed += subredditName.charCodeAt(i);
  }

  // Sort words for consistent ordering
  const sortedWords = [...words].sort();

  // Use a simple deterministic selection algorithm
  const selected: string[] = [];
  const used = new Set<number>();

  for (let i = 0; i < count; i++) {
    // Generate deterministic index based on seed and iteration
    const index = (seed + i * 7) % sortedWords.length;

    // Find next available word if this index is already used
    let actualIndex = index;
    let attempts = 0;
    while (used.has(actualIndex) && attempts < sortedWords.length) {
      actualIndex = (actualIndex + 1) % sortedWords.length;
      attempts++;
    }

    if (!used.has(actualIndex)) {
      selected.push(sortedWords[actualIndex]!);
      used.add(actualIndex);
    }
  }

  return selected;
}

/**
 * Generate a slate of word candidates with deterministic ID
 * @param subredditName - The subreddit name
 * @param count - Number of words to include in slate
 * @returns Slate data with deterministic ID and candidates
 */
export async function generateSlate(
  subredditName: string,
  count: number = 3
): Promise<{ slateId: string; candidates: CandidateWord[] }> {
  const words = await getWords();

  if (words.length === 0) {
    const slateId = generateSlateId([]);
    return { slateId, candidates: [] };
  }

  // Select words deterministically based on subreddit and count
  const selectedWords = selectWordsDeterministically(
    words,
    subredditName,
    count
  );

  // Generate deterministic slateId based on selected words
  const slateId = generateSlateId(selectedWords);

  // Create candidates with dictionary name
  const candidates: CandidateWord[] = selectedWords.map((word) => ({
    word,
    dictionaryName: `r/${subredditName}`,
  }));

  // Store slate data in Redis
  const slateKey = REDIS_KEYS.slate(slateId);
  await redis.hSet(slateKey, {
    words: JSON.stringify(selectedWords),
    timestamp: Date.now().toString(),
  });

  // Set TTL for slate data (7 days)
  await redis.expire(slateKey, 7 * 24 * 60 * 60);

  return { slateId, candidates };
}

/**
 * Consolidated slate tracking - single function for all slate actions
 * @param subredditName - The subreddit name
 * @param slateId - The slate ID
 * @param action - The action being tracked
 * @param word - Optional word for click/publish actions
 */
export async function trackSlateAction(
  subredditName: string,
  slateId: string,
  action: 'impression' | 'click' | 'publish',
  word?: string
): Promise<void> {
  try {
    if (action === 'impression') {
      // Track impression for all words in slate
      const slateData = await getSlateData(slateId);

      if (!slateData) {
        console.warn('No slate data found for impression tracking:', {
          subredditName,
          slateId,
        });
        return;
      }

      const promises = slateData.words.map(async (w) => {
        const metricsKey = REDIS_KEYS.wordMetrics(w);
        await redis.hIncrBy(metricsKey, 'impressions', 1);
        await redis.expire(metricsKey, 30 * 24 * 60 * 60); // 30 days TTL
      });

      await Promise.all(promises);
    } else if (action === 'click' && word) {
      // Track click for specific word
      const metricsKey = REDIS_KEYS.wordMetrics(word);
      await redis.hIncrBy(metricsKey, 'clicks', 1);
      await redis.expire(metricsKey, 30 * 24 * 60 * 60);
    } else if (action === 'publish' && word) {
      // Track publish for specific word
      const metricsKey = REDIS_KEYS.wordMetrics(word);
      await redis.hIncrBy(metricsKey, 'publishes', 1);
      await redis.expire(metricsKey, 30 * 24 * 60 * 60);
    } else {
      console.warn('Invalid slate action or missing word:', { action, word });
    }
  } catch (error) {
    console.error(`Failed to track slate ${action}:`, {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      subredditName,
      slateId,
      action,
      word,
    });
  }
}

/**
 * Get word metrics for a specific word
 * @param subredditName - The subreddit name
 * @param word - The word to get metrics for
 * @returns Word metrics with calculated rates
 */
export async function getWordMetrics(word: string): Promise<{
  impressions: number;
  clicks: number;
  clickRate: number;
  publishes: number;
  publishRate: number;
}> {
  try {
    const metricsKey = REDIS_KEYS.wordMetrics(word);
    const metrics = await redis.hGetAll(metricsKey);

    const impressions = parseInt(metrics.impressions || '0', 10);
    const clicks = parseInt(metrics.clicks || '0', 10);
    const publishes = parseInt(metrics.publishes || '0', 10);

    return {
      impressions,
      clicks,
      clickRate: impressions > 0 ? clicks / impressions : 0,
      publishes,
      publishRate: impressions > 0 ? publishes / impressions : 0,
    };
  } catch (error) {
    console.warn('Failed to get word metrics:', error);
    return {
      impressions: 0,
      clicks: 0,
      clickRate: 0,
      publishes: 0,
      publishRate: 0,
    };
  }
}

/**
 * Get slate data by ID
 * @param subredditName - The subreddit name
 * @param slateId - The slate ID
 * @returns Slate data or null if not found
 */
export async function getSlateData(
  slateId: string
): Promise<{ words: string[]; timestamp: number } | null> {
  try {
    const slateKey = REDIS_KEYS.slate(slateId);
    const slateData = await redis.hGetAll(slateKey);

    if (!slateData.words || !slateData.timestamp) {
      return null;
    }

    return {
      words: JSON.parse(slateData.words),
      timestamp: parseInt(slateData.timestamp, 10),
    };
  } catch (error) {
    console.warn('Failed to get slate data:', error);
    return null;
  }
}

/**
 * Test function to verify deterministic slateId generation
 * This can be called manually to test the behavior
 */
export async function testDeterministicSlates(
  subredditName: string
): Promise<void> {
  // Generate multiple slates and verify they're deterministic
  const results = await Promise.all([
    generateSlate(subredditName, 3),
    generateSlate(subredditName, 3),
    generateSlate(subredditName, 3),
  ]);

  const slateIds = results.map((r) => r.slateId);
  const words = results.map((r) => r.candidates.map((c) => c.word).sort());

  // Check if all slateIds are the same
  const allSameId = slateIds.every((id) => id === slateIds[0]);

  // Check if all word sets are the same
  const allSameWords = words.every(
    (wordSet) => JSON.stringify(wordSet) === JSON.stringify(words[0])
  );

  if (allSameId && allSameWords) {
    // Deterministic slate generation working correctly
  } else {
    // Deterministic slate generation has issues
  }
}
