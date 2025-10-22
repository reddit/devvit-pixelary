import { context, redis } from '@devvit/web/server';
import { REDIS_KEYS } from './redis';
import type { T3 } from '@devvit/shared-types/tid.js';
import { clamp } from '../../shared/utils/numbers';
import { shuffle } from '../../shared/utils/array';

// Configuration.
// TODO: Move to redis.
const EXPLORATION_RATE = 0.1;
const BUCKET_SIZE_MIN = 20; // Fallback for tiny pools
const Z_SCORE_CLAMP = 3;
const WEIGHT_PICK_RATE = 1;
const WEIGHT_POST_RATE = 1;

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

type Slate = {
  slateId: SlateId;
  words: string[];
  timestamp: number;
  word?: string;
  postId?: T3;
  servedAt?: number;
  pickedAt?: number;
  postedAt?: number;
};

/**
 * Get the index range for a given bucket
 */

function getBucketIndexRange(
  bucket: 0 | 1 | 2,
  wordCount: number,
  thirds: number
): { minIndex: number; maxIndex: number } {
  return {
    minIndex: bucket * thirds,
    maxIndex: Math.min(wordCount - 1, (bucket + 1) * thirds - 1),
  };
}

/**
 * Pick a word from a bucket
 */

export async function pickFromBucket(
  bucket: 0 | 1 | 2,
  wordCount: number,
  thirds: number
): Promise<string> {
  const { minIndex, maxIndex } = getBucketIndexRange(bucket, wordCount, thirds);
  const length = Math.max(1, maxIndex - minIndex + 1);
  const offset = minIndex + Math.floor(Math.random() * length);

  // A small window around offset for randomness without large fetch
  const window = 10;
  const start = Math.max(minIndex, offset - Math.floor(window / 2));
  const stop = Math.min(maxIndex, start + window - 1);

  // Get the members in the window
  const members = await redis.zRange(
    REDIS_KEYS.wordsScore(context.subredditName),
    start,
    stop,
    { by: 'rank', reverse: true }
  );

  // Weighted choice by score
  const total =
    members.reduce((a, m) => a + (m.score || 0), 0) || members.length;

  let random = Math.random() * total;
  for (const member of members) {
    random -= member.score || 1;
    if (random <= 0) return member.member as string;
  }

  const candidate = members[0]?.member;
  if (!candidate) throw new Error('No candidate found');

  return candidate;
}

/**
 * Creates a new slate of candidates
 */

export async function generateSlate(): Promise<Slate> {
  const slateId: SlateId = `slate_${crypto.randomUUID()}`;
  const slateKey = REDIS_KEYS.slate(slateId);
  const now = Date.now();

  // Check out how many words are available
  const wordCount = await redis.zCard(
    REDIS_KEYS.wordsScore(context.subredditName)
  );
  if (wordCount < 3) throw new Error('Not enough candidates to create a slate');

  // Calculate bucket index ranges
  const thirds = Math.max(1, Math.floor(wordCount / 3));

  // Sample 1 from each bucket (top, middle, tail)
  let slateWords = [
    await pickFromBucket(0, wordCount, thirds), // top third
    await pickFromBucket(1, wordCount, thirds), // middle third
    await pickFromBucket(2, wordCount, thirds), // bottom third
  ];

  // Dedupe if collisions
  slateWords = Array.from(new Set(slateWords));
  // If dedupe shrank slate, backfill from global top.
  // TODO: Add a cooldown period per word.
  while (slateWords.length < 3) {
    const backfill = await redis.zRange(
      REDIS_KEYS.wordsScore(context.subredditName),
      0,
      50,
      { by: 'rank', reverse: true }
    );
    for (const candidate of backfill) {
      if (!slateWords.includes(candidate.member)) {
        slateWords.push(candidate.member);
        break;
      }
    }
    if (slateWords.length < 3) break;
  }
  if (slateWords.length < 3) throw new Error('Unable to form slate');

  // 3) ε-exploration: swap lowest-score slot with most-uncertain word
  if (Math.random() < EXPLORATION_RATE) {
    // Get current scores
    const scores = await Promise.all(
      slateWords.map((word) =>
        redis
          .zScore(REDIS_KEYS.wordsScore(context.subredditName), word)
          .then((score) => score ?? -Infinity)
      )
    ).then((scores) => scores.sort());

    // Get the index of the lowest score
    const minIdx = scores.indexOf(Math.min(...scores));

    // Find the most uncertain word not in slate
    const uncertainWords = await redis.zRange(
      REDIS_KEYS.wordsUncertainty(context.subredditName),
      0,
      50,
      { by: 'rank', reverse: true }
    );
    const cand = uncertainWords.find(
      (candidate) => !slateWords.includes(candidate.member)
    );
    if (cand) slateWords[minIdx] = cand.member;
  }

  // Shuffle positions to avoid position bias.
  slateWords = shuffle(slateWords);

  // Create slate object
  const slate: Slate = {
    slateId,
    words: slateWords,
    timestamp: now,
  };

  // Persist slate data in Redis
  await redis.hSet(slateKey, {
    slateId,
    words: JSON.stringify(slateWords),
    timestamp: now.toString(),
  });
  await redis.expire(slateKey, 90 * 24 * 60 * 60); // 90 days TTL

  // Emit served event?
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
        redis.hIncrBy(
          REDIS_KEYS.wordsHourlyStats(context.subredditName, timestamp),
          `${word}:served`,
          1
        ),
        redis.hIncrBy(
          REDIS_KEYS.wordsTotalStats(context.subredditName),
          `${word}:served`,
          1
        )
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
      redis.hIncrBy(
        REDIS_KEYS.wordsHourlyStats(context.subredditName, timestamp),
        `${word}:picked`,
        1
      ),
      redis.hIncrBy(
        REDIS_KEYS.wordsTotalStats(context.subredditName),
        `${word}:picked`,
        1
      ),
      redis.hSet(REDIS_KEYS.slate(slateId), {
        word,
        pickedAt: timestamp,
      })
    );
  } else if (name === 'slate_posted') {
    // Increment post counts + set postedAt time
    const { word, postId } = event;
    promises.push(
      redis.hIncrBy(
        REDIS_KEYS.wordsHourlyStats(context.subredditName, timestamp),
        `${word}:posted`,
        1
      ),
      redis.hIncrBy(
        REDIS_KEYS.wordsTotalStats(context.subredditName),
        `${word}:posted`,
        1
      ),
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

  // Fetch all stats once
  const [allHourlyStats, allTotalStats] = await Promise.all([
    redis.hGetAll(
      REDIS_KEYS.wordsHourlyStats(context.subredditName, timestamp)
    ),
    redis.hGetAll(REDIS_KEYS.wordsTotalStats(context.subredditName)),
  ]);

  // Intermediate tallies
  const pickRates: number[] = [];
  const postRates: number[] = [];
  const wordStats: Record<
    string,
    {
      hourly: {
        served: number;
        picked: number;
        posted: number;
        pickRate: number;
        postRate: number;
      };
      total: {
        served: number;
        picked: number;
        posted: number;
      };
      drawerScore?: number;
      drawerUncertainty?: number;
    }
  > = {};

  for (const word of words) {
    // Extract per-word stats from shared hashes
    const hourly = {
      served: allHourlyStats[`${word}:served`],
      picked: allHourlyStats[`${word}:picked`],
      posted: allHourlyStats[`${word}:posted`],
    };
    const total = {
      served: allTotalStats[`${word}:served`],
      picked: allTotalStats[`${word}:picked`],
      posted: allTotalStats[`${word}:posted`],
    };

    // Parse stats
    const hourlyServed = parseInt(hourly.served ?? '0');
    const hourlyPicked = parseInt(hourly.picked ?? '0');
    const hourlyPosted = parseInt(hourly.posted ?? '0');
    const totalServed = parseInt(total.served ?? '0');
    const totalPicked = parseInt(total.picked ?? '0');
    const totalPosted = parseInt(total.posted ?? '0');

    // Smoothing (alpha-beta filter)
    const hourlyPickRate = (hourlyPicked + 5) / (hourlyServed + 100);
    const hourlyPostRate = (hourlyPosted + 5) / (hourlyPicked + 10);

    // Collect rates for later normalization
    pickRates.push(hourlyPickRate);
    postRates.push(hourlyPostRate);

    // Store stats
    wordStats[word] = {
      hourly: {
        served: hourlyServed,
        picked: hourlyPicked,
        posted: hourlyPosted,
        pickRate: hourlyPickRate,
        postRate: hourlyPostRate,
      },
      total: {
        served: totalServed,
        picked: totalPicked,
        posted: totalPosted,
      },
    };
  }

  // Compute mean and standard deviation for hourly pick and post rates
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

  // Compute z-scores, uncertainties, and drawerscores
  for (const word in wordStats) {
    const wordStat = wordStats[word];
    if (!wordStat) continue;

    const zPickRate = (wordStat.hourly.pickRate - meanPickRate) / stdPickRate;
    const zPostRate = (wordStat.hourly.postRate - meanPostRate) / stdPostRate;
    const zPickRateClamped = clamp(zPickRate, -Z_SCORE_CLAMP, Z_SCORE_CLAMP);
    const zPostRateClamped = clamp(zPostRate, -Z_SCORE_CLAMP, Z_SCORE_CLAMP);

    const drawerScore =
      WEIGHT_PICK_RATE * zPickRateClamped + WEIGHT_POST_RATE * zPostRateClamped;
    const drawerUncertainty = 1 / Math.sqrt(Math.max(wordStat.total.served, 1));

    // Append drawer score and uncertainty to word stats
    wordStats[word] = {
      ...wordStat,
      drawerScore,
      drawerUncertainty,
    };
  }

  // Save data to Redis + cleanup
  await Promise.all([
    // Scores
    redis.zAdd(
      REDIS_KEYS.wordsScore(context.subredditName),
      ...words.map((word) => ({
        member: word,
        score: wordStats[word]?.drawerScore ?? 0,
      }))
    ),
    // Uncertainties
    redis.zAdd(
      REDIS_KEYS.wordsUncertainty(context.subredditName),
      ...words.map((word) => ({
        member: word,
        score: wordStats[word]?.drawerUncertainty ?? 0,
      }))
    ),
    // Cleanup hourly stats in 90 days
    redis.expire(
      REDIS_KEYS.wordsHourlyStats(context.subredditName, timestamp),
      90 * 24 * 60 * 60
    ),
  ]);

  console.log('Scores updated!');
}
