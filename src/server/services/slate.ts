import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from './redis';
import { getWords } from './dictionary';
import { shuffle } from '../../shared/utils/array';
import type { CandidateWord } from '../../shared/schema/pixelary';

/**
 * Generate a unique slate ID
 */
function generateSlateId(): string {
  return `slate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a slate of word candidates with unique ID
 * @param subredditName - The subreddit name
 * @param count - Number of words to include in slate
 * @returns Slate data with unique ID and candidates
 */
export async function generateSlate(
  subredditName: string,
  count: number = 3
): Promise<{ slateId: string; candidates: CandidateWord[] }> {
  const slateId = generateSlateId();
  const words = await getWords(subredditName);

  if (words.length === 0) {
    return { slateId, candidates: [] };
  }

  // Shuffle and select random words
  const shuffled = shuffle<string>(words);
  const selectedWords = shuffled.slice(0, count);

  // Create candidates with dictionary name
  const candidates: CandidateWord[] = selectedWords.map((word) => ({
    word,
    dictionaryName: `r/${subredditName}`,
  }));

  // Store slate data in Redis
  const slateKey = REDIS_KEYS.slates(subredditName, slateId);
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
      const slateData = await getSlateData(subredditName, slateId);
      if (!slateData) return;

      const promises = slateData.words.map(async (w) => {
        const metricsKey = REDIS_KEYS.wordMetrics(subredditName, w);
        await redis.hIncrBy(metricsKey, 'impressions', 1);
        await redis.expire(metricsKey, 30 * 24 * 60 * 60); // 30 days TTL
      });

      await Promise.all(promises);
    } else if (action === 'click' && word) {
      // Track click for specific word
      const metricsKey = REDIS_KEYS.wordMetrics(subredditName, word);
      await redis.hIncrBy(metricsKey, 'clicks', 1);
      await redis.expire(metricsKey, 30 * 24 * 60 * 60);
    } else if (action === 'publish' && word) {
      // Track publish for specific word
      const metricsKey = REDIS_KEYS.wordMetrics(subredditName, word);
      await redis.hIncrBy(metricsKey, 'publishes', 1);
      await redis.expire(metricsKey, 30 * 24 * 60 * 60);
    }
  } catch (error) {
    console.warn(`Failed to track slate ${action}:`, error);
  }
}

/**
 * Get word metrics for a specific word
 * @param subredditName - The subreddit name
 * @param word - The word to get metrics for
 * @returns Word metrics with calculated rates
 */
export async function getWordMetrics(
  subredditName: string,
  word: string
): Promise<{
  impressions: number;
  clicks: number;
  clickRate: number;
  publishes: number;
  publishRate: number;
}> {
  try {
    const metricsKey = REDIS_KEYS.wordMetrics(subredditName, word);
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
  subredditName: string,
  slateId: string
): Promise<{ words: string[]; timestamp: number } | null> {
  try {
    const slateKey = REDIS_KEYS.slates(subredditName, slateId);
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
