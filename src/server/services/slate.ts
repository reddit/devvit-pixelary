import { redis, reddit } from '@devvit/web/server';
import { REDIS_KEYS } from './redis';
import { getAllWords } from './dictionary';
import { trackSlateEvent, type EventType } from './telemetry';
import { normalizeWord } from '../../shared/utils/string';
import type { CandidateWord } from '../../shared/schema/pixelary';
import type { T3 } from '@devvit/shared-types/tid.js';

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
  const words = await getAllWords();

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
    served: '0',
    upvotes: '0',
    comments: '0',
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
 * @param postId - Optional post ID for context
 */
export async function trackSlateAction(
  subredditName: string,
  slateId: string,
  action: 'impression' | 'click' | 'publish' | 'start',
  word?: string,
  postId?: T3
): Promise<void> {
  try {
    // Map action to event type for queue tracking
    let eventType: EventType;
    switch (action) {
      case 'impression':
        eventType = 'view_word_step'; // Use existing EventType
        break;
      case 'click':
        eventType = 'click_word_candidate';
        break;
      case 'publish':
        eventType = 'click_post_drawing';
        break;
      case 'start':
        eventType = 'view_draw_step';
        break;
      default:
        eventType = action as EventType;
    }

    // Add event to queue for processing
    const metadata: Record<string, string | number> = {
      word: word || '',
      subredditName,
    };
    if (postId) {
      metadata.postId = postId;
    }

    await trackSlateEvent(slateId, eventType, metadata);

    // Also update metrics directly for immediate availability
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
        const normalizedWord = normalizeWord(w);
        const metricsKey = REDIS_KEYS.wordMetrics(normalizedWord);
        await redis.hIncrBy(metricsKey, 'impressions', 1);
        await redis.expire(metricsKey, 30 * 24 * 60 * 60); // 30 days TTL
      });

      await Promise.all(promises);
    } else if (action === 'click' && word) {
      // Track click for specific word
      const normalizedWord = normalizeWord(word);
      const metricsKey = REDIS_KEYS.wordMetrics(normalizedWord);
      await redis.hIncrBy(metricsKey, 'clicks', 1);
      await redis.expire(metricsKey, 30 * 24 * 60 * 60);
    } else if (action === 'publish' && word) {
      // Track publish for specific word
      const normalizedWord = normalizeWord(word);
      const metricsKey = REDIS_KEYS.wordMetrics(normalizedWord);
      await redis.hIncrBy(metricsKey, 'publishes', 1);
      await redis.expire(metricsKey, 30 * 24 * 60 * 60);
    } else if (action === 'start') {
      // Start action doesn't require word - just track the event
      // No additional metrics needed for start action
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
 * @param word - The word to get metrics for
 * @returns Word metrics with calculated rates
 */
export async function getWordMetrics(word: string): Promise<{
  impressions: number;
  clicks: number;
  clickRate: number;
  publishes: number;
  publishRate: number;
  starts: number;
  guesses: number;
  skips: number;
  solves: number;
  skipRate: number;
  solveRate: number;
  upvotes: number;
  comments: number;
}> {
  console.log('Getting word metrics for:', word);
  try {
    // Normalize the word to match how it's stored in Redis
    const normalizedWord = normalizeWord(word);
    const metricsKey = REDIS_KEYS.wordMetrics(normalizedWord);
    const metrics = await redis.hGetAll(metricsKey);
    console.log('Metrics:', metrics);
    const impressions = parseInt(metrics.impressions || '0', 10);
    const clicks = parseInt(metrics.clicks || '0', 10);
    const publishes = parseInt(metrics.publishes || '0', 10);
    const starts = parseInt(metrics.starts || '0', 10);
    const guesses = parseInt(metrics.guesses || '0', 10);
    const skips = parseInt(metrics.skips || '0', 10);
    const solves = parseInt(metrics.solves || '0', 10);
    const upvotes = parseInt(metrics.upvotes || '0', 10);
    const comments = parseInt(metrics.comments || '0', 10);

    console.log('Impressions:', impressions);
    console.log('Clicks:', clicks);
    console.log('Publishes:', publishes);
    console.log('Starts:', starts);
    console.log('Guesses:', guesses);
    console.log('Skips:', skips);
    console.log('Solves:', solves);

    // Calculate rates
    const clickRate = impressions > 0 ? clicks / impressions : 0;
    const publishRate = impressions > 0 ? publishes / impressions : 0;
    const skipRate = impressions > 0 ? skips / impressions : 0;
    const solveRate = impressions > 0 ? solves / impressions : 0;

    return {
      impressions,
      clicks,
      clickRate,
      publishes,
      publishRate,
      starts,
      guesses,
      skips,
      solves,
      skipRate,
      solveRate,
      upvotes,
      comments,
    };
  } catch (error) {
    console.warn('Failed to get word metrics:', error);
    return {
      impressions: 0,
      clicks: 0,
      clickRate: 0,
      publishes: 0,
      publishRate: 0,
      starts: 0,
      guesses: 0,
      skips: 0,
      solves: 0,
      skipRate: 0,
      solveRate: 0,
      upvotes: 0,
      comments: 0,
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
 * Increment slate served counter
 * @param slateId - The slate ID
 */
export async function incrementSlateServed(slateId: string): Promise<void> {
  try {
    const slateKey = REDIS_KEYS.slate(slateId);
    await redis.hIncrBy(slateKey, 'served', 1);
  } catch (error) {
    console.warn('Failed to increment slate served counter:', error);
  }
}

/**
 * Get slate metrics
 * @param slateId - The slate ID
 * @returns Slate metrics
 */
export async function getSlateMetrics(slateId: string): Promise<{
  served: number;
  upvotes: number;
  comments: number;
}> {
  try {
    const slateKey = REDIS_KEYS.slate(slateId);
    const metrics = await redis.hGetAll(slateKey);

    return {
      served: parseInt(metrics.served || '0', 10),
      upvotes: parseInt(metrics.upvotes || '0', 10),
      comments: parseInt(metrics.comments || '0', 10),
    };
  } catch (error) {
    console.warn('Failed to get slate metrics:', error);
    return {
      served: 0,
      upvotes: 0,
      comments: 0,
    };
  }
}

// ============================================================================
// SLATE EVENT AGGREGATION
// ============================================================================

type SlateEvent = {
  slateId: string;
  eventType: string;
  timestamp: string;
  word?: string;
  postId?: T3;
};

type PostMetrics = {
  upvotes: number;
  comments: number;
};

/**
 * Get post metrics from Reddit API
 * @param postId - The post ID to get metrics for
 * @returns Post metrics with upvotes and comments
 */
async function getPostMetrics(postId: T3): Promise<PostMetrics> {
  try {
    const post = await reddit.getPostById(postId);
    return {
      upvotes: post.score || 0,
      comments: typeof post.comments === 'number' ? post.comments : 0,
    };
  } catch (error) {
    console.warn(`Failed to get post metrics for ${postId}:`, error);
    return { upvotes: 0, comments: 0 };
  }
}

/**
 * Get the last known metrics for a post to calculate deltas
 * @param postId - The post ID
 * @returns Last known metrics or zeros
 */
async function getLastPostMetrics(postId: T3): Promise<PostMetrics> {
  try {
    const key = `slate:post:${postId}`;
    const metrics = await redis.hGetAll(key);
    return {
      upvotes: parseInt(metrics.upvotes || '0', 10),
      comments: parseInt(metrics.comments || '0', 10),
    };
  } catch (error) {
    console.warn(`Failed to get last post metrics for ${postId}:`, error);
    return { upvotes: 0, comments: 0 };
  }
}

/**
 * Update the last known metrics for a post
 * @param postId - The post ID
 * @param metrics - The current metrics
 */
async function updateLastPostMetrics(
  postId: T3,
  metrics: PostMetrics
): Promise<void> {
  try {
    const key = `slate:post:${postId}`;
    await redis.hSet(key, {
      upvotes: metrics.upvotes.toString(),
      comments: metrics.comments.toString(),
    });
    await redis.expire(key, 7 * 24 * 60 * 60); // 7 days TTL
  } catch (error) {
    console.warn(`Failed to update last post metrics for ${postId}:`, error);
  }
}

/**
 * Process a single slate event
 * @param event - The slate event to process
 */
async function processSlateEvent(event: SlateEvent): Promise<void> {
  const { slateId, eventType, word, postId } = event;

  try {
    console.log(`Processing event: ${eventType} for slate ${slateId}`, {
      word,
      postId,
      timestamp: event.timestamp,
    });

    // Handle different event types
    if (eventType === 'view_word_step') {
      // Increment slate served counter
      await incrementSlateServed(slateId);

      // Get slate data to increment impressions for all words
      const slateData = await redis.hGetAll(REDIS_KEYS.slate(slateId));
      if (slateData.words) {
        const words = JSON.parse(slateData.words) as string[];
        console.log(
          `Incrementing impressions for ${words.length} words in slate ${slateId}`
        );

        for (const w of words) {
          const normalizedWord = normalizeWord(w);
          const metricsKey = REDIS_KEYS.wordMetrics(normalizedWord);
          await redis.hIncrBy(metricsKey, 'impressions', 1);
          await redis.expire(metricsKey, 30 * 24 * 60 * 60); // 30 days TTL
        }
      } else {
        console.warn(`No words found in slate data for ${slateId}`);
      }
    } else if (eventType === 'click_word_candidate' && word) {
      // Increment picks (clicks) for the word
      console.log(`Incrementing clicks for word: ${word}`);
      const normalizedWord = normalizeWord(word);
      const metricsKey = REDIS_KEYS.wordMetrics(normalizedWord);
      await redis.hIncrBy(metricsKey, 'clicks', 1);
      await redis.expire(metricsKey, 30 * 24 * 60 * 60);
    } else if (eventType === 'view_draw_step' && word) {
      // Increment starts for the word
      console.log(`Incrementing starts for word: ${word}`);
      const normalizedWord = normalizeWord(word);
      const metricsKey = REDIS_KEYS.wordMetrics(normalizedWord);
      await redis.hIncrBy(metricsKey, 'starts', 1);
      await redis.expire(metricsKey, 30 * 24 * 60 * 60);
    } else if (eventType === 'click_post_drawing' && word) {
      // Increment finishes (publishes) for the word
      console.log(`Incrementing publishes for word: ${word}`);
      const normalizedWord = normalizeWord(word);
      const metricsKey = REDIS_KEYS.wordMetrics(normalizedWord);
      await redis.hIncrBy(metricsKey, 'publishes', 1);
      await redis.expire(metricsKey, 30 * 24 * 60 * 60);
    } else {
      console.log(
        `Event type ${eventType} processed (no specific action needed)`
      );
    }

    // Handle social metrics if postId is available
    if (postId) {
      console.log(`Processing social metrics for post: ${postId}`);

      const currentMetrics = await getPostMetrics(postId);
      const lastMetrics = await getLastPostMetrics(postId);

      // Calculate deltas
      const upvoteDelta = Math.max(
        0,
        currentMetrics.upvotes - lastMetrics.upvotes
      );
      const commentDelta = Math.max(
        0,
        currentMetrics.comments - lastMetrics.comments
      );

      console.log(`Post metrics deltas:`, {
        upvotes: `${lastMetrics.upvotes} -> ${currentMetrics.upvotes} (delta: ${upvoteDelta})`,
        comments: `${lastMetrics.comments} -> ${currentMetrics.comments} (delta: ${commentDelta})`,
      });

      // Update word metrics with deltas
      if (word && (upvoteDelta > 0 || commentDelta > 0)) {
        const normalizedWord = normalizeWord(word);
        const metricsKey = REDIS_KEYS.wordMetrics(normalizedWord);
        if (upvoteDelta > 0) {
          await redis.hIncrBy(metricsKey, 'upvotes', upvoteDelta);
        }
        if (commentDelta > 0) {
          await redis.hIncrBy(metricsKey, 'comments', commentDelta);
        }
        await redis.expire(metricsKey, 30 * 24 * 60 * 60);
      }

      // Update slate metrics with deltas
      if (upvoteDelta > 0 || commentDelta > 0) {
        const slateKey = REDIS_KEYS.slate(slateId);
        if (upvoteDelta > 0) {
          await redis.hIncrBy(slateKey, 'upvotes', upvoteDelta);
        }
        if (commentDelta > 0) {
          await redis.hIncrBy(slateKey, 'comments', commentDelta);
        }
      }

      // Update last known metrics
      await updateLastPostMetrics(postId, currentMetrics);
    }

    console.log(
      `Successfully processed event ${eventType} for slate ${slateId}`
    );
  } catch (error) {
    console.error(
      `Failed to process event ${eventType} for slate ${slateId}:`,
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        event,
      }
    );
    throw error; // Re-throw to be caught by the calling function
  }
}

/**
 * Process slate events in batches
 * @param batchSize - Number of events to process per batch
 * @returns Processing result with count and whether more events remain
 */
export async function processSlateEvents(
  batchSize: number = 100
): Promise<{ processed: number; hasMore: boolean }> {
  const startTime = Date.now();
  const eventKey = REDIS_KEYS.slateEvents();
  let processed = 0;
  let errors = 0;

  try {
    console.log(`Starting slate event processing. Batch size: ${batchSize}`);

    // Get all events from the hash
    const allEvents = await redis.hGetAll(eventKey);
    const eventEntries = Object.entries(allEvents);

    console.log(`Found ${eventEntries.length} total events in queue`);

    if (eventEntries.length === 0) {
      console.log('No events found in queue');
      return {
        processed: 0,
        hasMore: false,
      };
    }

    // Process only the specified batch size
    const eventsToProcess = eventEntries.slice(0, batchSize);
    const hasMore = eventEntries.length > batchSize;

    console.log(
      `Processing ${eventsToProcess.length} events (hasMore: ${hasMore})`
    );

    // Process each event
    for (const [timestamp, eventDataStr] of eventsToProcess) {
      try {
        console.log(`Processing event at timestamp ${timestamp}`);

        // Validate event data
        if (!eventDataStr) {
          console.warn(`Empty event data at timestamp ${timestamp}`);
          await redis.hDel(eventKey, [timestamp]);
          processed++;
          continue;
        }

        let eventData: SlateEvent;
        try {
          eventData = JSON.parse(eventDataStr) as SlateEvent;
        } catch (parseError) {
          console.error(
            `Failed to parse event data at ${timestamp}:`,
            parseError
          );
          console.error(`Raw event data: ${eventDataStr}`);
          await redis.hDel(eventKey, [timestamp]);
          processed++;
          errors++;
          continue;
        }

        // Validate event structure
        if (
          !eventData.slateId ||
          !eventData.eventType ||
          !eventData.timestamp
        ) {
          console.error(`Invalid event structure at ${timestamp}:`, eventData);
          await redis.hDel(eventKey, [timestamp]);
          processed++;
          errors++;
          continue;
        }

        await processSlateEvent(eventData);

        // Remove processed event
        await redis.hDel(eventKey, [timestamp]);
        processed++;

        console.log(
          `Successfully processed event ${eventData.eventType} for slate ${eventData.slateId}`
        );
      } catch (error) {
        console.error(`Failed to process event at ${timestamp}:`, error);
        console.error(`Event data: ${eventDataStr}`);

        // Still remove the event to avoid infinite retry
        await redis.hDel(eventKey, [timestamp]);
        processed++;
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `Slate event processing completed in ${duration}ms. Processed: ${processed}, Errors: ${errors}, HasMore: ${hasMore}`
    );

    return {
      processed,
      hasMore,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Failed to process slate events after ${duration}ms:`, error);
    console.error(`Processed before error: ${processed}, Errors: ${errors}`);

    return {
      processed,
      hasMore: false,
    };
  }
}

/**
 * Get the current size of the slate events queue
 * @returns Number of events in the queue
 */
export async function getEventQueueSize(): Promise<number> {
  try {
    const eventKey = REDIS_KEYS.slateEvents();
    return await redis.hLen(eventKey);
  } catch (error) {
    console.warn('Failed to get event queue size:', error);
    return 0;
  }
}
