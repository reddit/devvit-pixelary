import { context, redis } from '@devvit/web/server';
import { REDIS_KEYS, acquireLock, releaseLock } from '@server/core/redis';
import type { T3 } from '@devvit/shared-types/tid.js';
import { clamp } from '@shared/utils/numbers';
import { shuffle } from '@shared/utils/array';
import {
  isFiniteNumber,
  safeParseFloat,
  safeParseInt,
} from '@server/utils/numbers';

const EXPLORATION_RATE = 0.1;
const Z_SCORE_CLAMP = 3;
const WEIGHT_PICK_RATE = 1;
const WEIGHT_POST_RATE = 1;
const UCB_CONSTANT = 2;
const SCORE_DECAY_RATE = 0.1;

/**
 * Validate that computed scores are finite before writing to Redis
 */
function validateScoreEntry(entry: { member: string; score: number }): boolean {
  return isFiniteNumber(entry.score);
}

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
  name: 'slate_served';
  timestamp: string;
};

export type SlateEventPicked = {
  slateId: SlateId;
  name: 'slate_picked';
  timestamp: string;
  word: string;
  position: number;
};

export type SlateEventPosted = {
  slateId: SlateId;
  name: 'slate_posted';
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

export async function getSlateBanditConfig(): Promise<SlateBanditConfig> {
  try {
    const configKey = REDIS_KEYS.slateConfig();
    const config = await redis.hGetAll(configKey);
    const finalConfig = {
      explorationRate: clamp(
        safeParseFloat(config.explorationRate, EXPLORATION_RATE),
        0,
        1
      ),
      zScoreClamp: Math.max(
        0.1,
        safeParseFloat(config.zScoreClamp, Z_SCORE_CLAMP, 0.1)
      ),
      weightPickRate: Math.max(
        0,
        safeParseFloat(config.weightPickRate, WEIGHT_PICK_RATE, 0)
      ),
      weightPostRate: Math.max(
        0,
        safeParseFloat(config.weightPostRate, WEIGHT_POST_RATE, 0)
      ),
      ucbConstant: Math.max(
        0.1,
        safeParseFloat(config.ucbConstant, UCB_CONSTANT, 0.1)
      ),
      scoreDecayRate: clamp(
        safeParseFloat(config.scoreDecayRate, SCORE_DECAY_RATE),
        0,
        1
      ),
    };
    // Validate all config values are finite
    if (!Object.values(finalConfig).every((v) => isFiniteNumber(v))) {
      console.error(
        '[getSlateBanditConfig] Invalid config values detected, using defaults'
      );
      return {
        explorationRate: EXPLORATION_RATE,
        zScoreClamp: Z_SCORE_CLAMP,
        weightPickRate: WEIGHT_PICK_RATE,
        weightPostRate: WEIGHT_POST_RATE,
        ucbConstant: UCB_CONSTANT,
        scoreDecayRate: SCORE_DECAY_RATE,
      };
    }
    return finalConfig;
  } catch (error) {
    console.error('[getSlateBanditConfig] Error fetching config:', error);
    // Return defaults on error
    return {
      explorationRate: EXPLORATION_RATE,
      zScoreClamp: Z_SCORE_CLAMP,
      weightPickRate: WEIGHT_PICK_RATE,
      weightPostRate: WEIGHT_POST_RATE,
      ucbConstant: UCB_CONSTANT,
      scoreDecayRate: SCORE_DECAY_RATE,
    };
  }
}

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

export async function initSlateBandit(): Promise<void> {
  const configKey = REDIS_KEYS.slateConfig();
  const existingKeys = await redis.exists(configKey);
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
  const uncertaintyKey = REDIS_KEYS.wordsUncertainty(context.subredditName);
  const uncertaintyExists = await redis.global.exists(uncertaintyKey);
  if (uncertaintyExists === 0) {
    const allWords = await redis.global.zRange(
      REDIS_KEYS.wordsAll(context.subredditName),
      0,
      -1
    );
    if (allWords.length > 0) {
      const initialUncertainty = 1 / Math.sqrt(10);
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

export async function pickWordsWithUCB(count: number = 3): Promise<string[]> {
  const config = await getSlateBanditConfig();
  const [allWords, uncertainties]: [
    Array<{ member: string; score: number }>,
    Array<{ member: string; score: number }>,
  ] = await Promise.all([
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
  const ucbScores: Array<{ word: string; ucbScore: number }> = [];
  for (const word of allWords) {
    const uncertainty =
      uncertainties.find((u) => u.member === word.member)?.score ?? 0;
    const ucbScore = word.score + config.ucbConstant * uncertainty;
    ucbScores.push({ word: word.member, ucbScore });
  }
  ucbScores.sort((a, b) => b.ucbScore - a.ucbScore);
  const selectedWords: string[] = [];
  const remainingWords = [...ucbScores];
  for (let i = 0; i < count && remainingWords.length > 0; i++) {
    const totalScore = remainingWords.reduce(
      (sum, w) => sum + Math.max(0, w.ucbScore),
      0
    );
    if (totalScore === 0) {
      const randomIndex = Math.floor(Math.random() * remainingWords.length);
      const chosen = remainingWords[randomIndex];
      if (chosen) {
        selectedWords.push(chosen.word);
        remainingWords.splice(randomIndex, 1);
      }
    } else {
      let random = Math.random() * totalScore;
      let selectedIndex = 0;
      for (let j = 0; j < remainingWords.length; j++) {
        const rw = remainingWords[j];
        const score = rw ? rw.ucbScore : 0;
        random -= Math.max(0, score);
        if (random <= 0) {
          selectedIndex = j;
          break;
        }
      }
      const chosen2 = remainingWords[selectedIndex];
      if (chosen2) {
        selectedWords.push(chosen2.word);
        remainingWords.splice(selectedIndex, 1);
      }
    }
  }
  return selectedWords;
}

export async function generateSlate(): Promise<Slate> {
  const slateId: SlateId = `slate_${crypto.randomUUID()}`;
  const slateKey = REDIS_KEYS.slate(slateId);
  const now = Date.now();
  let slateWords = await pickWordsWithUCB(3);
  slateWords = Array.from(new Set(slateWords));
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
  if (slateWords.length < 3) {
    throw new Error(`Unable to fill slate: ${slateWords.join(', ')}`);
  }
  slateWords = shuffle(slateWords);
  const slate: Slate = { slateId, words: slateWords, timestamp: now };
  await redis.hSet(slateKey, {
    slateId,
    words: JSON.stringify(slateWords),
    timestamp: now.toString(),
  });
  await redis.expire(slateKey, 90 * 24 * 60 * 60);
  return slate;
}

export async function handleSlateEvent(event: SlateEvent): Promise<void> {
  const { slateId, name } = event;
  const timestamp = getCurrentTimestamp();
  const promises: Array<Promise<unknown>> = [];
  switch (name) {
    case 'slate_served': {
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
        redis.hSet(REDIS_KEYS.slate(slateId), { servedAt: timestamp }),
        ...words.map((word) =>
          redis.zAdd(REDIS_KEYS.wordsActive(context.subredditName, timestamp), {
            member: word,
            score: 0,
          })
        )
      );
      break;
    }
    case 'slate_picked': {
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
      break;
    }
    case 'slate_posted': {
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
      break;
    }
    default:
      break;
  }
  await Promise.all(promises);
}

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
      total: { served: number; picked: number; posted: number };
      drawerScore?: number;
      drawerUncertainty?: number;
    }
  >,
  config: SlateBanditConfig,
  subredditName: string
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
      total: { served: number; picked: number; posted: number };
      drawerScore?: number;
      drawerUncertainty?: number;
    }
  >
> {
  try {
    const lastServedData = await redis.zRange(
      REDIS_KEYS.wordsLastServed(subredditName),
      0,
      -1
    );
    const now = Date.now();
    const lastServedMap = new Map<string, number>();

    // Validate and filter lastServedData
    for (const item of lastServedData ?? []) {
      if (item.member && isFiniteNumber(item.score) && item.score > 0) {
        lastServedMap.set(item.member, item.score);
      }
    }

    for (const word in wordStats) {
      const wordStat = wordStats[word];
      if (!wordStat?.drawerScore) continue;
      if (wordStat.total.served === 0) continue;

      // Validate drawerScore is finite before decay
      if (!isFiniteNumber(wordStat.drawerScore)) {
        console.warn(
          `[applyScoreDecay] Invalid drawerScore for word "${word}", skipping decay`
        );
        continue;
      }

      const lastServed = lastServedMap.get(word);
      if (!lastServed || !isFiniteNumber(lastServed)) continue;

      // Validate timestamp is reasonable (not in future, not too old)
      if (lastServed > now) {
        console.warn(
          `[applyScoreDecay] Future timestamp for word "${word}", skipping decay`
        );
        continue;
      }

      const daysSinceLastServed = (now - lastServed) / (1000 * 60 * 60 * 24);

      // Guard against invalid date calculations
      if (!isFiniteNumber(daysSinceLastServed) || daysSinceLastServed < 0) {
        console.warn(
          `[applyScoreDecay] Invalid daysSinceLastServed for word "${word}", skipping decay`
        );
        continue;
      }

      const decayFactor = Math.exp(
        -config.scoreDecayRate * daysSinceLastServed
      );

      // Validate decay factor is finite
      if (!isFiniteNumber(decayFactor)) {
        console.warn(
          `[applyScoreDecay] Invalid decayFactor for word "${word}", skipping decay`
        );
        continue;
      }

      const newScore = wordStat.drawerScore * decayFactor;

      // Validate new score is finite before applying
      if (isFiniteNumber(newScore)) {
        wordStat.drawerScore = newScore;
      } else {
        console.warn(
          `[applyScoreDecay] Invalid computed score for word "${word}", keeping original`
        );
      }
    }
    return wordStats;
  } catch (error) {
    console.error(`[applyScoreDecay] Error applying score decay:`, error);
    // Return original stats on error rather than failing completely
    return wordStats;
  }
}

export function getCurrentTimestamp(): string {
  const now = new Date();
  return now.toISOString().slice(0, 13).replace('T', '-');
}

function getPreviousTimestamp(): string {
  const now = new Date();
  const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
  return lastHour.toISOString().slice(0, 13).replace('T', '-');
}

export async function updateWordScores(subredditName?: string) {
  const subName = subredditName ?? context.subredditName;
  if (!subName) {
    throw new Error('subredditName is required');
  }

  const startTime = Date.now();
  console.log(`[updateWordScores] Starting update for subreddit: ${subName}`);

  // Acquire lock to prevent concurrent updates (5 minute TTL)
  const lockKey = REDIS_KEYS.wordsUpdateLock(subName);

  try {
    const gotLock = await acquireLock(lockKey, 5 * 60 * 1000);
    if (!gotLock) {
      console.log(
        `[updateWordScores] Lock acquisition failed - update already in progress`
      );
      throw new Error('Word scores update already in progress');
    }
    console.log(`[updateWordScores] Lock acquired successfully`);
  } catch (error) {
    console.error(`[updateWordScores] Error acquiring lock:`, error);
    throw new Error(
      `Failed to acquire lock: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  try {
    const timestamp = getPreviousTimestamp();
    console.log(`[updateWordScores] Fetching data for timestamp: ${timestamp}`);

    let allWords: Array<{ member: string; score: number }>;
    let allHourlyStats: Record<string, string>;
    let allTotalStats: Record<string, string>;
    let config: SlateBanditConfig;

    try {
      [allWords, allHourlyStats, allTotalStats, config] = await Promise.all([
        redis.global.zRange(REDIS_KEYS.wordsAll(subName), 0, -1),
        redis.hGetAll(REDIS_KEYS.wordsHourlyStats(subName, timestamp)),
        redis.hGetAll(REDIS_KEYS.wordsTotalStats(subName)),
        getSlateBanditConfig(),
      ]);
    } catch (error) {
      console.error(
        `[updateWordScores] Error fetching data from Redis:`,
        error
      );
      throw new Error(
        `Failed to fetch data: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Validate config
    if (!Object.values(config).every((v) => isFiniteNumber(v))) {
      throw new Error('Invalid config values detected');
    }

    // Validate and filter words
    const words = allWords
      .map((item) => item.member)
      .filter(
        (member): member is string =>
          typeof member === 'string' && member.length > 0
      );

    console.log(`[updateWordScores] Found ${words.length} words to process`);

    if (words.length === 0) {
      console.log(`[updateWordScores] No words found - returning early`);
      return; // Lock will be released in finally block
    }
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
        total: { served: number; picked: number; posted: number };
        drawerScore?: number;
        drawerUncertainty?: number;
      }
    > = {};

    for (const word of words) {
      try {
        // Use safe parsing with validation
        const hourlyServed = safeParseInt(allHourlyStats[`${word}:served`], 0);
        const hourlyPicked = safeParseInt(allHourlyStats[`${word}:picked`], 0);
        const hourlyPosted = safeParseInt(allHourlyStats[`${word}:posted`], 0);
        const totalServed = safeParseInt(allTotalStats[`${word}:served`], 0);
        const totalPicked = safeParseInt(allTotalStats[`${word}:picked`], 0);
        const totalPosted = safeParseInt(allTotalStats[`${word}:posted`], 0);

        // Validate all stats are non-negative
        if (
          hourlyServed < 0 ||
          hourlyPicked < 0 ||
          hourlyPosted < 0 ||
          totalServed < 0 ||
          totalPicked < 0 ||
          totalPosted < 0
        ) {
          console.warn(
            `[updateWordScores] Negative stats detected for word "${word}", skipping`
          );
          continue;
        }

        if (hourlyServed === 0) {
          const drawerUncertainty = 1 / Math.sqrt(Math.max(totalServed, 1));
          if (!isFiniteNumber(drawerUncertainty)) {
            console.warn(
              `[updateWordScores] Invalid uncertainty for word "${word}", skipping`
            );
            continue;
          }
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
            drawerScore: 0,
            drawerUncertainty,
          };
          continue;
        }

        // Calculate rates with guards against division by zero
        const hourlyPickRate = (hourlyPicked + 5) / (hourlyServed + 100);
        const hourlyPostRate = (hourlyPosted + 5) / (hourlyPicked + 10);

        // Validate rates are finite
        if (
          !isFiniteNumber(hourlyPickRate) ||
          !isFiniteNumber(hourlyPostRate)
        ) {
          console.warn(
            `[updateWordScores] Invalid rates for word "${word}", skipping`
          );
          continue;
        }

        pickRates.push(hourlyPickRate);
        postRates.push(hourlyPostRate);
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
      } catch (error) {
        console.error(
          `[updateWordScores] Error processing word "${word}":`,
          error
        );
        // Continue processing other words
        continue;
      }
    }
    // Calculate mean and standard deviation with validation
    let meanPickRate = 0;
    let stdPickRate = 1;
    let meanPostRate = 0;
    let stdPostRate = 1;

    if (pickRates.length > 1) {
      meanPickRate = pickRates.reduce((a, b) => a + b, 0) / pickRates.length;
      if (!isFiniteNumber(meanPickRate)) {
        console.warn(`[updateWordScores] Invalid meanPickRate, using default`);
        meanPickRate = 0;
      }
      const variancePickRate =
        pickRates.reduce((a, b) => a + Math.pow(b - meanPickRate, 2), 0) /
        pickRates.length;
      stdPickRate = Math.sqrt(Math.max(0, variancePickRate));
      if (!isFiniteNumber(stdPickRate) || stdPickRate === 0) {
        stdPickRate = 1;
      }
    }

    if (postRates.length > 1) {
      meanPostRate = postRates.reduce((a, b) => a + b, 0) / postRates.length;
      if (!isFiniteNumber(meanPostRate)) {
        console.warn(`[updateWordScores] Invalid meanPostRate, using default`);
        meanPostRate = 0;
      }
      const variancePostRate =
        postRates.reduce((a, b) => a + Math.pow(b - meanPostRate, 2), 0) /
        postRates.length;
      stdPostRate = Math.sqrt(Math.max(0, variancePostRate));
      if (!isFiniteNumber(stdPostRate) || stdPostRate === 0) {
        stdPostRate = 1;
      }
    }

    // Calculate z-scores and drawer scores with validation
    for (const word in wordStats) {
      const wordStat = wordStats[word];
      if (!wordStat) continue;

      try {
        let zPickRate = 0;
        let zPostRate = 0;

        if (wordStat.hourly.served > 0 && stdPickRate > 0) {
          zPickRate = (wordStat.hourly.pickRate - meanPickRate) / stdPickRate;
          if (!isFiniteNumber(zPickRate)) {
            zPickRate = 0;
          }
        }

        if (wordStat.hourly.served > 0 && stdPostRate > 0) {
          zPostRate = (wordStat.hourly.postRate - meanPostRate) / stdPostRate;
          if (!isFiniteNumber(zPostRate)) {
            zPostRate = 0;
          }
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

        const drawerUncertainty =
          1 / Math.sqrt(Math.max(wordStat.total.served, 1));

        // Validate computed values are finite
        if (!isFiniteNumber(drawerScore)) {
          console.warn(
            `[updateWordScores] Invalid drawerScore for word "${word}", setting to 0`
          );
          wordStats[word] = {
            ...wordStat,
            drawerScore: 0,
            drawerUncertainty,
          };
        } else if (!isFiniteNumber(drawerUncertainty)) {
          console.warn(
            `[updateWordScores] Invalid drawerUncertainty for word "${word}", setting to default`
          );
          wordStats[word] = { ...wordStat, drawerScore, drawerUncertainty: 1 };
        } else {
          wordStats[word] = { ...wordStat, drawerScore, drawerUncertainty };
        }
      } catch (error) {
        console.error(
          `[updateWordScores] Error calculating scores for word "${word}":`,
          error
        );
        // Set safe defaults
        wordStats[word] = { ...wordStat, drawerScore: 0, drawerUncertainty: 1 };
      }
    }
    // Apply score decay
    const decayedWordStats = await applyScoreDecay(wordStats, config, subName);

    // Build score entries with validation
    const scoreEntries: Array<{ member: string; score: number }> = [];
    const uncertaintyEntries: Array<{ member: string; score: number }> = [];

    for (const word of words) {
      const wordStat = decayedWordStats[word];
      const drawerScore = wordStat?.drawerScore ?? 0;
      const drawerUncertainty = wordStat?.drawerUncertainty ?? 0;

      // Only add entries with valid scores
      if (validateScoreEntry({ member: word, score: drawerScore })) {
        scoreEntries.push({ member: word, score: drawerScore });
      } else {
        console.warn(
          `[updateWordScores] Skipping invalid score entry for word "${word}"`
        );
        // Add zero score as fallback
        scoreEntries.push({ member: word, score: 0 });
      }

      if (validateScoreEntry({ member: word, score: drawerUncertainty })) {
        uncertaintyEntries.push({ member: word, score: drawerUncertainty });
      } else {
        console.warn(
          `[updateWordScores] Skipping invalid uncertainty entry for word "${word}"`
        );
        uncertaintyEntries.push({ member: word, score: 1 });
      }
    }

    if (scoreEntries.length === 0) {
      throw new Error('No valid score entries to write');
    }

    // Calculate aggregate statistics
    const scores = scoreEntries.map((e) => e.score).filter((s) => s !== 0);
    const uncertainties = uncertaintyEntries.map((e) => e.score);
    const totalServed = Object.values(wordStats).reduce(
      (sum, stat) => sum + stat.total.served,
      0
    );
    const totalPicked = Object.values(wordStats).reduce(
      (sum, stat) => sum + stat.total.picked,
      0
    );
    const totalPosted = Object.values(wordStats).reduce(
      (sum, stat) => sum + stat.total.posted,
      0
    );

    const avgScore =
      scores.length > 0
        ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
        : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const avgUncertainty =
      uncertainties.length > 0
        ? uncertainties.reduce((a: number, b: number) => a + b, 0) /
          uncertainties.length
        : 0;

    // Log aggregate statistics
    const duration = Date.now() - startTime;
    console.log(`[Word Scores Update] Subreddit: ${subName}`);
    console.log(`  Words processed: ${words.length}`);
    console.log(`  Words with scores: ${scores.length}`);
    console.log(`  Duration: ${duration}ms`);
    if (scores.length > 0) {
      console.log(
        `  Score range: [${minScore.toFixed(4)}, ${maxScore.toFixed(4)}]`
      );
      console.log(`  Average score: ${avgScore.toFixed(4)}`);
    }
    console.log(`  Average uncertainty: ${avgUncertainty.toFixed(4)}`);
    console.log(
      `  Total stats - Served: ${totalServed}, Picked: ${totalPicked}, Posted: ${totalPosted}`
    );
    console.log(
      `  Pick rate: ${totalServed > 0 ? ((totalPicked / totalServed) * 100).toFixed(2) : 0}%`
    );
    console.log(
      `  Post rate: ${totalPicked > 0 ? ((totalPosted / totalPicked) * 100).toFixed(2) : 0}%`
    );

    // Write scores to Redis with error handling for each operation
    try {
      const writeScorePromise = redis.global
        .zAdd(REDIS_KEYS.wordsAll(subName), ...scoreEntries)
        .catch((err) => {
          console.error(
            `[updateWordScores] Error writing scores to wordsAll:`,
            err
          );
          throw new Error(
            `Failed to write scores: ${err instanceof Error ? err.message : String(err)}`
          );
        });

      const writeUncertaintyPromise = redis.global
        .zAdd(REDIS_KEYS.wordsUncertainty(subName), ...uncertaintyEntries)
        .catch((err) => {
          console.error(`[updateWordScores] Error writing uncertainties:`, err);
          throw new Error(
            `Failed to write uncertainties: ${err instanceof Error ? err.message : String(err)}`
          );
        });

      const expirePromise = redis
        .expire(
          REDIS_KEYS.wordsHourlyStats(subName, timestamp),
          90 * 24 * 60 * 60
        )
        .catch((err) => {
          // Expire is non-critical, log but don't fail
          console.warn(`[updateWordScores] Error setting expiration:`, err);
        });

      await Promise.all([
        writeScorePromise,
        writeUncertaintyPromise,
        expirePromise,
      ]);
      console.log(`[updateWordScores] Successfully updated scores`);
    } catch (error) {
      console.error(`[updateWordScores] Error writing to Redis:`, error);
      throw error;
    }
  } catch (error) {
    console.error(`[updateWordScores] Error during update:`, error);
    throw error;
  } finally {
    try {
      await releaseLock(lockKey);
      console.log(`[updateWordScores] Lock released - function complete`);
    } catch (releaseError) {
      console.error(`[updateWordScores] Error releasing lock:`, releaseError);
      // Don't throw - lock release failure shouldn't mask original error
    }
  }
}
