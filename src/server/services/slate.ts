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
  console.log('🔍 [DEBUG] getSlateBanditConfig: Starting');
  const configKey = REDIS_KEYS.slateConfig();
  console.log('🔍 [DEBUG] getSlateBanditConfig: Config key:', configKey);

  try {
    const config = await redis.hGetAll(configKey);
    console.log(
      '🔍 [DEBUG] getSlateBanditConfig: Raw config from Redis:',
      config
    );

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

    console.log(
      '🔍 [DEBUG] getSlateBanditConfig: Parsed raw config:',
      rawConfig
    );

    // Validate and clamp values
    const finalConfig = {
      explorationRate: clamp(rawConfig.explorationRate, 0, 1),
      zScoreClamp: Math.max(0.1, rawConfig.zScoreClamp),
      weightPickRate: Math.max(0, rawConfig.weightPickRate),
      weightPostRate: Math.max(0, rawConfig.weightPostRate),
      ucbConstant: Math.max(0.1, rawConfig.ucbConstant),
      scoreDecayRate: clamp(rawConfig.scoreDecayRate, 0, 1),
    };

    console.log('🔍 [DEBUG] getSlateBanditConfig: Final config:', finalConfig);
    return finalConfig;
  } catch (error) {
    console.error('🔍 [DEBUG] getSlateBanditConfig: Error occurred:', error);
    throw error;
  }
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
 * Initialize the slate bandit with defaultconfiguration if not set
 */

export async function initSlateBandit(): Promise<void> {
  console.log('🔍 [DEBUG] initSlateBandit: Starting initialization');
  console.log(
    '🔍 [DEBUG] initSlateBandit: Subreddit name:',
    context.subredditName
  );

  try {
    const configKey = REDIS_KEYS.slateConfig();
    console.log('🔍 [DEBUG] initSlateBandit: Config key:', configKey);
    const existingKeys = await redis.exists(configKey);
    console.log(
      '🔍 [DEBUG] initSlateBandit: Existing config keys:',
      existingKeys
    );

    // Only set defaults if no configuration exists
    if (existingKeys === 0) {
      console.log('🔍 [DEBUG] initSlateBandit: Setting default config');
      const defaultConfig: SlateBanditConfig = {
        explorationRate: EXPLORATION_RATE,
        zScoreClamp: Z_SCORE_CLAMP,
        weightPickRate: WEIGHT_PICK_RATE,
        weightPostRate: WEIGHT_POST_RATE,
        ucbConstant: UCB_CONSTANT,
        scoreDecayRate: SCORE_DECAY_RATE,
      };
      await setSlateBanditConfig(defaultConfig);
      console.log('🔍 [DEBUG] initSlateBandit: Default config set');
    }

    // Initialize uncertainty scores for all words if not already set
    const uncertaintyKey = REDIS_KEYS.wordsUncertainty(context.subredditName);
    console.log('🔍 [DEBUG] initSlateBandit: Uncertainty key:', uncertaintyKey);
    const uncertaintyExists = await redis.global.exists(uncertaintyKey);
    console.log(
      '🔍 [DEBUG] initSlateBandit: Uncertainty exists:',
      uncertaintyExists
    );

    if (uncertaintyExists === 0) {
      console.log(
        '🔍 [DEBUG] initSlateBandit: Initializing uncertainty scores'
      );
      // Get all words and set initial uncertainty
      const allWords = await redis.global.zRange(
        REDIS_KEYS.wordsAll(context.subredditName),
        0,
        -1
      );
      console.log('🔍 [DEBUG] initSlateBandit: Found words:', allWords.length);

      // Only proceed if we have words to initialize
      if (allWords.length > 0) {
        const initialUncertainty = 1 / Math.sqrt(10); // Small prior for new words
        console.log(
          '🔍 [DEBUG] initSlateBandit: Setting initial uncertainty:',
          initialUncertainty
        );

        await redis.global.zAdd(
          uncertaintyKey,
          ...allWords.map((word) => ({
            member: word.member,
            score: initialUncertainty,
          }))
        );
        console.log(
          '🔍 [DEBUG] initSlateBandit: Uncertainty scores initialized'
        );
      } else {
        console.log(
          '🔍 [DEBUG] initSlateBandit: No words found to initialize uncertainty'
        );
      }
    }
    console.log('🔍 [DEBUG] initSlateBandit: Initialization complete');
  } catch (error) {
    console.error('🔍 [DEBUG] initSlateBandit: Error occurred:', error);
    throw error;
  }
}

/**
 * Pick words using Upper Confidence Bound (UCB) algorithm
 */

export async function pickWordsWithUCB(count: number = 3): Promise<string[]> {
  console.log('🔍 [DEBUG] pickWordsWithUCB: Starting with count:', count);

  try {
    console.log('🔍 [DEBUG] pickWordsWithUCB: Getting slate bandit config');
    const config = await getSlateBanditConfig();
    console.log('🔍 [DEBUG] pickWordsWithUCB: Config retrieved:', config);

    console.log(
      '🔍 [DEBUG] pickWordsWithUCB: Getting words and uncertainties from Redis'
    );
    // Get all words with their scores and uncertainties
    const [allWords, uncertainties] = await Promise.all([
      redis.global.zRange(REDIS_KEYS.wordsAll(context.subredditName), 0, -1),
      redis.global.zRange(
        REDIS_KEYS.wordsUncertainty(context.subredditName),
        0,
        -1
      ),
    ]);

    console.log('🔍 [DEBUG] pickWordsWithUCB: Retrieved data:', {
      allWordsCount: allWords.length,
      uncertaintiesCount: uncertainties.length,
      subredditName: context.subredditName,
      wordsAllKey: REDIS_KEYS.wordsAll(context.subredditName),
      wordsUncertaintyKey: REDIS_KEYS.wordsUncertainty(context.subredditName),
    });

    if (allWords.length < count) {
      console.error(
        '🔍 [DEBUG] pickWordsWithUCB: Not enough words available:',
        {
          needed: count,
          available: allWords.length,
          words: allWords.map((w) => w.member),
        }
      );
      throw new Error(
        `Not enough words available. Need ${count}, have ${allWords.length}`
      );
    }

    console.log('🔍 [DEBUG] pickWordsWithUCB: Creating UCB scores');
    // Create UCB scores: score + c * sqrt(ln(total_serves) / serves)
    const ucbScores: Array<{ word: string; ucbScore: number }> = [];

    for (const word of allWords) {
      const uncertainty =
        uncertainties.find((u) => u.member === word.member)?.score ?? 0;
      const ucbScore = (word.score ?? 0) + config.ucbConstant * uncertainty;
      ucbScores.push({ word: word.member, ucbScore });
    }

    console.log(
      '🔍 [DEBUG] pickWordsWithUCB: UCB scores created:',
      ucbScores.slice(0, 5)
    );

    // Sort by UCB score (descending)
    ucbScores.sort((a, b) => b.ucbScore - a.ucbScore);
    console.log('🔍 [DEBUG] pickWordsWithUCB: UCB scores sorted');

    // Sample proportionally to UCB scores, but with some randomness
    const selectedWords: string[] = [];
    const remainingWords = [...ucbScores];

    console.log('🔍 [DEBUG] pickWordsWithUCB: Starting word selection');
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
        console.log(
          '🔍 [DEBUG] pickWordsWithUCB: Selected random word:',
          selectedWords[selectedWords.length - 1]
        );
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
        console.log(
          '🔍 [DEBUG] pickWordsWithUCB: Selected weighted word:',
          selectedWords[selectedWords.length - 1]
        );
        remainingWords.splice(selectedIndex, 1);
      }
    }

    console.log(
      '🔍 [DEBUG] pickWordsWithUCB: Final selected words:',
      selectedWords
    );
    return selectedWords;
  } catch (error) {
    console.error('🔍 [DEBUG] pickWordsWithUCB: Error occurred:', error);
    throw error;
  }
}

/**
 * Creates a new slate of candidates
 */

export async function generateSlate(): Promise<Slate> {
  console.log('🔍 [DEBUG] generateSlate: Starting slate generation');
  const slateId: SlateId = `slate_${crypto.randomUUID()}`;
  const slateKey = REDIS_KEYS.slate(slateId);
  const now = Date.now();
  console.log('🔍 [DEBUG] generateSlate: Generated slateId:', slateId);

  try {
    console.log('🔍 [DEBUG] generateSlate: Calling pickWordsWithUCB(3)');
    // Use UCB algorithm to pick words
    let slateWords = await pickWordsWithUCB(3);
    console.log(
      '🔍 [DEBUG] generateSlate: pickWordsWithUCB returned:',
      slateWords
    );

    // Dedupe if collisions
    // Shouldn't happen with UCB but safety check
    slateWords = Array.from(new Set(slateWords));
    console.log('🔍 [DEBUG] generateSlate: After dedupe:', slateWords);

    // If dedupe shrank slate, backfill from top words
    while (slateWords.length < 3) {
      console.log(
        '🔍 [DEBUG] generateSlate: Backfilling words, current count:',
        slateWords.length
      );
      const backfill = await redis.global.zRange(
        REDIS_KEYS.wordsAll(context.subredditName),
        0,
        10,
        { by: 'rank', reverse: true }
      );
      console.log(
        '🔍 [DEBUG] generateSlate: Backfill candidates:',
        backfill.map((b) => b.member)
      );
      for (const candidate of backfill) {
        if (!slateWords.includes(candidate.member)) {
          slateWords.push(candidate.member);
          console.log(
            '🔍 [DEBUG] generateSlate: Added backfill word:',
            candidate.member
          );
          break;
        }
      }
      if (slateWords.length < 3) break;
    }

    // If we don't have 3 words at this point, just give up
    if (slateWords.length < 3) {
      console.error(
        '🔍 [DEBUG] generateSlate: Unable to fill slate:',
        slateWords
      );
      throw new Error(`Unable to fill slate: ${slateWords.join(', ')}`);
    }

    // Shuffle positions to avoid position bias
    slateWords = shuffle(slateWords);
    console.log('🔍 [DEBUG] generateSlate: Final shuffled words:', slateWords);

    // Create slate object
    const slate: Slate = {
      slateId,
      words: slateWords,
      timestamp: now,
    };

    console.log('🔍 [DEBUG] generateSlate: Persisting slate to Redis');
    // Persist slate data in Redis
    await redis.hSet(slateKey, {
      slateId,
      words: JSON.stringify(slateWords),
      timestamp: now.toString(),
    });
    await redis.expire(slateKey, 90 * 24 * 60 * 60); // 90 days TTL
    console.log('🔍 [DEBUG] generateSlate: Slate persisted successfully');

    return slate;
  } catch (error) {
    console.error('🔍 [DEBUG] generateSlate: Error occurred:', error);
    throw error;
  }
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
    console.log('No words found in dictionary');
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

  // Save data to Redis + cleanup
  await Promise.all([
    // Scores
    redis.zAdd(
      REDIS_KEYS.wordsAll(context.subredditName),
      ...words.map((word) => ({
        member: word,
        score: decayedWordStats[word]?.drawerScore ?? 0,
      }))
    ),
    // Uncertainties
    redis.zAdd(
      REDIS_KEYS.wordsUncertainty(context.subredditName),
      ...words.map((word) => ({
        member: word,
        score: decayedWordStats[word]?.drawerUncertainty ?? 0,
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
