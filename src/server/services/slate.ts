import { context, redis } from '@devvit/web/server';
import { REDIS_KEYS } from './redis';
import type { T3 } from '@devvit/shared-types/tid.js';
import { clamp } from '../../shared/utils/numbers';

export type SlateId = `slate_${string}`;

export type SlateEventServed = {
  slateId: SlateId;
  name: 'slate_served'; // Did you see it?
  timestamp: string;
};

export type SlateEventPicked = {
  slateId: SlateId;
  name: 'slate_picked'; // Did you pick it?
  timestamp: string;
  word: string;
};

export type SlateEventPosted = {
  slateId: SlateId;
  name: 'slate_posted'; // Did you post it?
  word: string;
  postId: T3;
};

export type SlateEvent = SlateEventServed | SlateEventPicked | SlateEventPosted;

/**
 * Creates a new slate of candidates
 */

export async function generateSlate(): Promise<{
  slateId: string;
  words: string[];
  timestamp: number;
}> {
  const slateId = `slate_${crypto.randomUUID()}`;
  const slateKey = REDIS_KEYS.slate(slateId);
  const timestamp = Date.now();

  const words = ['Apple', 'Banana', 'Cherry'];

  const slate = {
    slateId,
    words,
    timestamp,
  };

  // Store slate data in Redis
  const parsedSlated = {
    slateId: slate.slateId,
    words: JSON.stringify(slate.words),
    timestamp: slate.timestamp.toString(),
  };
  await redis.hSet(slateKey, parsedSlated);
  await redis.expire(slateKey, 7 * 24 * 60 * 60); // 7 days TTL

  return slate;
}

/**
 * Handle a slate events
 */

export async function handleSlateEvent(event: SlateEvent): Promise<void> {
  const { slateId, name } = event;
  const timestamp = getCurrentTimestamp();
  const promises: Promise<unknown>[] = [];

  if (name === 'slate_served') {
    // Increment impression counts + set servedAt time
    const rawWords = await redis.hGet(REDIS_KEYS.slate(slateId), 'words');
    if (!rawWords) return;
    const words = JSON.parse(rawWords) as string[];

    for (const word of words) {
      promises.push(
        redis.hIncrBy(REDIS_KEYS.wordHourlyStats(word, timestamp), 'served', 1),
        redis.hIncrBy(REDIS_KEYS.wordTotalStats(word), 'served', 1)
      );
    }
    promises.push(
      redis.hSet(REDIS_KEYS.slate(slateId), {
        servedAt: timestamp,
      }),
      ...words.map((word) =>
        redis.zAdd(REDIS_KEYS.wordsActive(context.subredditName, timestamp), {
          member: word,
          score: 0,
        })
      )
    );
  } else if (name === 'slate_picked') {
    // Increment pick counts + set pickedAt time
    const { word } = event;
    promises.push(
      redis.hIncrBy(REDIS_KEYS.wordHourlyStats(word, timestamp), 'picked', 1),
      redis.hIncrBy(REDIS_KEYS.wordTotalStats(word), 'picked', 1),
      redis.hSet(REDIS_KEYS.slate(slateId), {
        word,
        pickedAt: timestamp,
      })
    );
  } else if (name === 'slate_posted') {
    // Increment post counts + set postedAt time
    const { word, postId } = event;
    promises.push(
      redis.hIncrBy(REDIS_KEYS.wordHourlyStats(word, timestamp), 'posted', 1),
      redis.hIncrBy(REDIS_KEYS.wordTotalStats(word), 'posted', 1),
      redis.hSet(REDIS_KEYS.slate(slateId), {
        word,
        postId,
        postedAt: timestamp,
      })
    );
  }

  // Execute all promises in parallel
  await Promise.all(promises);
}

function getCurrentTimestamp(): string {
  const now = new Date();
  return now.toISOString().slice(0, 13).replace('T', '-');
}

function getPreviousTimestamp(): string {
  const now = new Date();
  const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
  return lastHour.toISOString().slice(0, 13).replace('T', '-');
}

/**
 * Get all the words used in the last hour
 */

export async function getWordsActive(): Promise<string[]> {
  const timestamp = getPreviousTimestamp();
  const key = REDIS_KEYS.wordsActive(context.subredditName, timestamp);
  const results = await redis
    .zRange(key, 0, -1)
    .then((results) => results.map((result) => result.member));
  return results;
}

/*
 * Update the word scores. Runs every hour.
 */

export async function updateWordScores() {
  const words = await getWordsActive();
  const timestamp = getPreviousTimestamp();

  const pickRates: number[] = [];
  const postRates: number[] = [];

  const wordStats = await Promise.all(
    words.map(async (word) => {
      return {
        word,
        stats: await redis.hGetAll(REDIS_KEYS.wordHourlyStats(word, timestamp)),
      };
    })
  ).then(
    (
      results: {
        word: string;
        stats: Record<string, string>;
      }[]
    ) => {
      return results.map((result) => {
        const served = parseInt(result.stats.served ?? '0');
        const picked = parseInt(result.stats.picked ?? '0');
        const posted = parseInt(result.stats.posted ?? '0');

        // Smoothing (alpha-beta filter)
        const pickRate = (picked + 5) / (served + 100);
        const postRate = (posted + 5) / (picked + 10);

        // Collect rates for later normalization (mean and standard deviation)
        pickRates.push(pickRate);
        postRates.push(postRate);

        return {
          ...result,
          served,
          picked,
          posted,
          pickRate,
          postRate,
        };
      });
    }
  );

  // Compute mean and standard deviation for pick and post rates
  const meanPickRate = pickRates.reduce((a, b) => a + b, 0) / pickRates.length;
  const stdPickRate = Math.sqrt(
    pickRates.reduce((a, b) => a + Math.pow(b - meanPickRate, 2), 0) /
      pickRates.length
  );

  const meanPostRate = postRates.reduce((a, b) => a + b, 0) / postRates.length;
  const stdPostRate = Math.sqrt(
    postRates.reduce((a, b) => a + Math.pow(b - meanPostRate, 2), 0) /
      postRates.length
  );

  // Compute z-scores for pick and post rates
  const Z_SCORE_CLAMP = 3;
  const WEIGHT_PICK_RATE = 1;
  const WEIGHT_POST_RATE = 1;
  const scores = wordStats.map((wordStat) => {
    const zPickRate = (wordStat.pickRate - meanPickRate) / stdPickRate;
    const zPostRate = (wordStat.postRate - meanPostRate) / stdPostRate;
    const zPickRateClamped = clamp(zPickRate, -Z_SCORE_CLAMP, Z_SCORE_CLAMP);
    const zPostRateClamped = clamp(zPostRate, -Z_SCORE_CLAMP, Z_SCORE_CLAMP);
    const drawerScore =
      WEIGHT_PICK_RATE * zPickRateClamped + WEIGHT_POST_RATE * zPostRateClamped;

    return { word: wordStat.word, drawerScore };
  });

  // Save scores to Redis
  // Bucketing

  console.log(scores);
}
