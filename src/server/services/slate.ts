import { context, redis } from '@devvit/web/server';
import { REDIS_KEYS } from './redis';
import type { T3 } from '@devvit/shared-types/tid.js';
import { clamp } from '../../shared/utils/numbers';
import { shuffle } from '../../shared/utils/array';

// Default configuration
const EXPLORATION_RATE = 0.1; // ε-exploration rate
const Z_SCORE_CLAMP = 3;
const WEIGHT_PICK_RATE = 1;
const WEIGHT_POST_RATE = 1;
const UCB_CONSTANT = 2; // Upper Confidence Bound exploration constant
const SCORE_DECAY_RATE = 0.1; // Exponential decay rate per day

/*
 * Slate types
 */

export type Slate = {
  slateId: SlateId;
  words: string[];
  timestamp: number;
  word?: string;
  position?: number;
  postId?: T3;
  servedAt?: number;
  pickedAt?: number;
  postedAt?: number;
};

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
  position: number; // Position in the slate (0, 1, or 2)
};

export type SlateEventPosted = {
  slateId: SlateId;
  name: 'slate_posted'; // Did you post it?
  word: string;
  postId: T3;
};

export type SlateEvent = SlateEventServed | SlateEventPicked | SlateEventPosted;

export type SlateBanditConfig = {
  explorationRate: number;
  zScoreClamp: number;
  weightPickRate: number;
  weightPostRate: number;
  ucbConstant: number;
  scoreDecayRate: number;
};

/**
 * Get the current slate bandit configuration from Redis
 */
export async function getSlateBanditConfig(): Promise<SlateBanditConfig> {
  const configKey = REDIS_KEYS.slateConfig();

  const config = await redis.hGetAll(configKey);

  const rawConfig = {
    explorationRate: config.explorationRate
      ? parseFloat(config.explorationRate)
      : EXPLORATION_RATE,
    zScoreClamp: config.zScoreClamp
      ? parseFloat(config.zScoreClamp)
      : Z_SCORE_CLAMP,
    weightPickRate: config.weightPickRate
      ? parseFloat(config.weightPickRate)
      : WEIGHT_PICK_RATE,
    weightPostRate: config.weightPostRate
      ? parseFloat(config.weightPostRate)
      : WEIGHT_POST_RATE,
    ucbConstant: config.ucbConstant
      ? parseFloat(config.ucbConstant)
      : UCB_CONSTANT,
    scoreDecayRate: config.scoreDecayRate
      ? parseFloat(config.scoreDecayRate)
      : SCORE_DECAY_RATE,
  };

  // Validate and clamp values
  const finalConfig = {
    explorationRate: clamp(rawConfig.explorationRate, 0, 1),
    zScoreClamp: Math.max(0.1, rawConfig.zScoreClamp),
    weightPickRate: Math.max(0, rawConfig.weightPickRate),
    weightPostRate: Math.max(0, rawConfig.weightPostRate),
    ucbConstant: Math.max(0.1, rawConfig.ucbConstant),
    scoreDecayRate: clamp(rawConfig.scoreDecayRate, 0, 1),
  };

  return finalConfig;
}

/**
 * Set the slate bandit configuration in Redis
 */

export async function setSlateBanditConfig(
  config: SlateBanditConfig
): Promise<void> {
  const configKey = REDIS_KEYS.slateConfig();
  await redis.hSet(configKey, {
    explorationRate: config.explorationRate.toString(),
    zScoreClamp: config.zScoreClamp.toString(),
    weightPickRate: config.weightPickRate.toString(),
    weightPostRate: config.weightPostRate.toString(),
    ucbConstant: config.ucbConstant.toString(),
    scoreDecayRate: config.scoreDecayRate.toString(),
  });
}

/**
 * Initialize the slate bandit with default configuration if not set
 */

export async function initSlateBandit(): Promise<void> {
  const configKey = REDIS_KEYS.slateConfig();
  const existingKeys = await redis.exists(configKey);

  // Only set defaults if no configuration exists
  if (existingKeys === 0) {
    const defaultConfig: SlateBanditConfig = {
      explorationRate: EXPLORATION_RATE,
      zScoreClamp: Z_SCORE_CLAMP,
      weightPickRate: WEIGHT_PICK_RATE,
      weightPostRate: WEIGHT_POST_RATE,
      ucbConstant: UCB_CONSTANT,
      scoreDecayRate: SCORE_DECAY_RATE,
    };
    await setSlateBanditConfig(defaultConfig);
  }

  // Initialize uncertainty scores for all words if not already set
  const uncertaintyKey = REDIS_KEYS.wordsUncertainty(context.subredditName);
  const uncertaintyExists = await redis.global.exists(uncertaintyKey);

  if (uncertaintyExists === 0) {
    // Get all words and set initial uncertainty
    const allWords = await redis.global.zRange(
      REDIS_KEYS.wordsAll(context.subredditName),
      0,
      -1
    );

    // Only proceed if we have words to initialize
    if (allWords.length > 0) {
      const initialUncertainty = 1 / Math.sqrt(10); // Small prior for new words

      await redis.global.zAdd(
        uncertaintyKey,
        ...allWords.map((word) => ({
          member: word.member,
          score: initialUncertainty,
        }))
      );
    }
  }
}

/**
 * Pick words using Upper Confidence Bound (UCB) algorithm
 */

export async function pickWordsWithUCB(count: number = 3): Promise<string[]> {
  const config = await getSlateBanditConfig();

  // Get all words with their scores and uncertainties
  const [allWords, uncertainties] = await Promise.all([
    redis.global.zRange(REDIS_KEYS.wordsAll(context.subredditName), 0, -1),
    redis.global.zRange(
      REDIS_KEYS.wordsUncertainty(context.subredditName),
      0,
      -1
    ),
  ]);

  if (allWords.length < count) {
    throw new Error(
      `Not enough words available. Need ${count}, have ${allWords.length}`
    );
  }

  // Create UCB scores: score + c * sqrt(ln(total_serves) / serves)
  const ucbScores: Array<{ word: string; ucbScore: number }> = [];

  for (const word of allWords) {
    const uncertainty =
      uncertainties.find((u) => u.member === word.member)?.score ?? 0;
    const ucbScore = (word.score ?? 0) + config.ucbConstant * uncertainty;
    ucbScores.push({ word: word.member, ucbScore });
  }

  // Sort by UCB score (descending)
  ucbScores.sort((a, b) => b.ucbScore - a.ucbScore);

  // Sample proportionally to UCB scores, but with some randomness
  const selectedWords: string[] = [];
  const remainingWords = [...ucbScores];

  for (let i = 0; i < count && remainingWords.length > 0; i++) {
    // Use weighted random selection based on UCB scores
    const totalScore = remainingWords.reduce(
      (sum, w) => sum + Math.max(0, w.ucbScore),
      0
    );

    if (totalScore === 0) {
      // If all scores are negative/zero, pick randomly
      const randomIndex = Math.floor(Math.random() * remainingWords.length);
      selectedWords.push(remainingWords[randomIndex]!.word);
      remainingWords.splice(randomIndex, 1);
    } else {
      // Weighted selection
      let random = Math.random() * totalScore;
      let selectedIndex = 0;

      for (let j = 0; j < remainingWords.length; j++) {
        random -= Math.max(0, remainingWords[j]!.ucbScore);
        if (random <= 0) {
          selectedIndex = j;
          break;
        }
      }

      selectedWords.push(remainingWords[selectedIndex]!.word);
      remainingWords.splice(selectedIndex, 1);
    }
  }

  return selectedWords;
}

/**
 * Creates a new slate of candidates
 */

export async function generateSlate(): Promise<Slate> {
  const slateId: SlateId = `slate_${crypto.randomUUID()}`;
  const slateKey = REDIS_KEYS.slate(slateId);
  const now = Date.now();

  // Use UCB algorithm to pick words
  let slateWords = await pickWordsWithUCB(3);

  // Dedupe if collisions
  // Shouldn't happen with UCB but safety check
  slateWords = Array.from(new Set(slateWords));

  // If dedupe shrank slate, backfill from top words
  while (slateWords.length < 3) {
    const backfill = await redis.global.zRange(
      REDIS_KEYS.wordsAll(context.subredditName),
      0,
      10,
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

  // If we don't have 3 words at this point, just give up
  if (slateWords.length < 3) {
    throw new Error(`Unable to fill slate: ${slateWords.join(', ')}`);
  }

  // Shuffle positions to avoid position bias
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
        ),
        redis.zAdd(REDIS_KEYS.wordsLastServed(context.subredditName), {
          member: word,
          score: Date.now(),
        })
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
    const { word, position } = event;

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
        position: position.toString(),
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

/**
 * Apply exponential decay to word scores based on recency
 */

export async function applyScoreDecay(
  wordStats: Record<
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
  >,
  config: SlateBanditConfig
): Promise<
  Record<
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
  >
> {
  // Get last served timestamps for all words
  const lastServedData = await redis.zRange(
    REDIS_KEYS.wordsLastServed(context.subredditName),
    0,
    -1
  );
  const now = Date.now();

  // Create a map for quick lookup
  const lastServedMap = new Map(
    (lastServedData || []).map((item) => [item.member, item.score])
  );

  for (const word in wordStats) {
    const wordStat = wordStats[word];
    if (!wordStat || !wordStat.drawerScore) continue;

    // If never served, no decay
    if (wordStat.total.served === 0) continue;

    const lastServed = lastServedMap.get(word);
    if (!lastServed) {
      // Word has been served but no timestamp recorded - skip decay
      continue;
    }

    const daysSinceLastServed = (now - lastServed) / (1000 * 60 * 60 * 24);

    // Apply exponential decay: score * exp(-decayRate * days)
    const decayFactor = Math.exp(-config.scoreDecayRate * daysSinceLastServed);
    wordStat.drawerScore *= decayFactor;
  }

  return wordStats;
}

/**
 * Get the current timestamp
 */

export function getCurrentTimestamp(): string {
  const now = new Date();
  return now.toISOString().slice(0, 13).replace('T', '-');
}

/**
 * Get the previous timestamp
 */

function getPreviousTimestamp(): string {
  const now = new Date();
  const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
  return lastHour.toISOString().slice(0, 13).replace('T', '-');
}

/*
 * Update the word scores. Runs every hour.
 */

export async function updateWordScores() {
  const timestamp = getPreviousTimestamp();

  const [allWords, allHourlyStats, allTotalStats, config] = await Promise.all([
    redis.zRange(REDIS_KEYS.wordsAll(context.subredditName), 0, -1),
    redis.hGetAll(
      REDIS_KEYS.wordsHourlyStats(context.subredditName, timestamp)
    ),
    redis.hGetAll(REDIS_KEYS.wordsTotalStats(context.subredditName)),
    getSlateBanditConfig(),
  ]);

  const words = allWords.map((item) => item.member);

  if (words.length === 0) {
    return;
  }

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

    // Skip hourly rate calculation if no hourly data
    if (hourlyServed === 0) {
      // Still calculate uncertainty based on total stats
      const drawerUncertainty = 1 / Math.sqrt(Math.max(totalServed, 1));

      wordStats[word] = {
        hourly: {
          served: 0,
          picked: 0,
          posted: 0,
          pickRate: 0,
          postRate: 0,
        },
        total: {
          served: totalServed,
          picked: totalPicked,
          posted: totalPosted,
        },
        drawerScore: 0, // Default score for words with no hourly data
        drawerUncertainty,
      };
      continue;
    }

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

  // Only compute z-scores if we have enough data points
  let meanPickRate = 0;
  let stdPickRate = 1;
  let meanPostRate = 0;
  let stdPostRate = 1;

  if (pickRates.length > 1) {
    meanPickRate = pickRates.reduce((a, b) => a + b, 0) / pickRates.length;
    const variancePickRate =
      pickRates.reduce((a, b) => a + Math.pow(b - meanPickRate, 2), 0) /
      pickRates.length;
    stdPickRate = Math.sqrt(variancePickRate);

    // Prevent division by zero
    if (stdPickRate === 0) {
      stdPickRate = 1;
    }
  }

  if (postRates.length > 1) {
    meanPostRate = postRates.reduce((a, b) => a + b, 0) / postRates.length;
    const variancePostRate =
      postRates.reduce((a, b) => a + Math.pow(b - meanPostRate, 2), 0) /
      postRates.length;
    stdPostRate = Math.sqrt(variancePostRate);

    // Prevent division by zero
    if (stdPostRate === 0) {
      stdPostRate = 1;
    }
  }

  // Compute z-scores, uncertainties, and drawerscores
  for (const word in wordStats) {
    const wordStat = wordStats[word];
    if (!wordStat) continue;

    let zPickRate = 0;
    let zPostRate = 0;

    // Only calculate z-scores if we have hourly data
    if (wordStat.hourly.served > 0) {
      zPickRate = (wordStat.hourly.pickRate - meanPickRate) / stdPickRate;
      zPostRate = (wordStat.hourly.postRate - meanPostRate) / stdPostRate;
    }

    const zPickRateClamped = clamp(
      zPickRate,
      -config.zScoreClamp,
      config.zScoreClamp
    );
    const zPostRateClamped = clamp(
      zPostRate,
      -config.zScoreClamp,
      config.zScoreClamp
    );

    const drawerScore =
      config.weightPickRate * zPickRateClamped +
      config.weightPostRate * zPostRateClamped;
    const drawerUncertainty = 1 / Math.sqrt(Math.max(wordStat.total.served, 1));

    // Append drawer score and uncertainty to word stats
    wordStats[word] = {
      ...wordStat,
      drawerScore,
      drawerUncertainty,
    };
  }

  // Apply score decay based on recency
  const decayedWordStats = await applyScoreDecay(wordStats, config);

  // Prepare data for Redis operations
  const scoreEntries = words.map((word) => ({
    member: word,
    score: decayedWordStats[word]?.drawerScore ?? 0,
  }));

  const uncertaintyEntries = words.map((word) => ({
    member: word,
    score: decayedWordStats[word]?.drawerUncertainty ?? 0,
  }));

  // Save data to Redis + cleanup
  await Promise.all([
    // Scores
    redis.zAdd(REDIS_KEYS.wordsAll(context.subredditName), ...scoreEntries),
    // Uncertainties
    redis.zAdd(
      REDIS_KEYS.wordsUncertainty(context.subredditName),
      ...uncertaintyEntries
    ),
    // Cleanup hourly stats in 90 days
    redis.expire(
      REDIS_KEYS.wordsHourlyStats(context.subredditName, timestamp),
      90 * 24 * 60 * 60
    ),
  ]);
}
