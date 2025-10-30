import { context, redis } from '@devvit/web/server';
import { REDIS_KEYS } from '@server/core/redis';
import type { T3 } from '@devvit/shared-types/tid.js';
import { clamp } from '@shared/utils/numbers';
import { shuffle } from '@shared/utils/array';

const EXPLORATION_RATE = 0.1;
const Z_SCORE_CLAMP = 3;
const WEIGHT_PICK_RATE = 1;
const WEIGHT_POST_RATE = 1;
const UCB_CONSTANT = 2;
const SCORE_DECAY_RATE = 0.1;

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
  const ucbScores: Array<{ word: string; ucbScore: number }> = [];
  for (const word of allWords) {
    const uncertainty =
      uncertainties.find((u) => u.member === word.member)?.score ?? 0;
    const ucbScore = (word.score ?? 0) + config.ucbConstant * uncertainty;
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
      selectedWords.push(remainingWords[randomIndex]!.word);
      remainingWords.splice(randomIndex, 1);
    } else {
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
  const promises: Promise<unknown>[] = [];
  if (name === 'slate_served') {
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
  } else if (name === 'slate_picked') {
    const { word, position } = event as SlateEventPicked;
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
    const { word, postId } = event as SlateEventPosted;
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
      total: { served: number; picked: number; posted: number };
      drawerScore?: number;
      drawerUncertainty?: number;
    }
  >
> {
  const lastServedData = await redis.zRange(
    REDIS_KEYS.wordsLastServed(context.subredditName),
    0,
    -1
  );
  const now = Date.now();
  const lastServedMap = new Map(
    (lastServedData || []).map((item) => [item.member, item.score])
  );
  for (const word in wordStats) {
    const wordStat = wordStats[word];
    if (!wordStat || !wordStat.drawerScore) continue;
    if (wordStat.total.served === 0) continue;
    const lastServed = lastServedMap.get(word);
    if (!lastServed) continue;
    const daysSinceLastServed = (now - lastServed) / (1000 * 60 * 60 * 24);
    const decayFactor = Math.exp(-config.scoreDecayRate * daysSinceLastServed);
    wordStat.drawerScore *= decayFactor;
  }
  return wordStats;
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
    const hourlyServed = parseInt(allHourlyStats[`${word}:served`] ?? '0');
    const hourlyPicked = parseInt(allHourlyStats[`${word}:picked`] ?? '0');
    const hourlyPosted = parseInt(allHourlyStats[`${word}:posted`] ?? '0');
    const totalServed = parseInt(allTotalStats[`${word}:served`] ?? '0');
    const totalPicked = parseInt(allTotalStats[`${word}:picked`] ?? '0');
    const totalPosted = parseInt(allTotalStats[`${word}:posted`] ?? '0');
    if (hourlyServed === 0) {
      const drawerUncertainty = 1 / Math.sqrt(Math.max(totalServed, 1));
      wordStats[word] = {
        hourly: { served: 0, picked: 0, posted: 0, pickRate: 0, postRate: 0 },
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
    const hourlyPickRate = (hourlyPicked + 5) / (hourlyServed + 100);
    const hourlyPostRate = (hourlyPosted + 5) / (hourlyPicked + 10);
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
      total: { served: totalServed, picked: totalPicked, posted: totalPosted },
    };
  }
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
    if (stdPostRate === 0) {
      stdPostRate = 1;
    }
  }
  for (const word in wordStats) {
    const wordStat = wordStats[word];
    if (!wordStat) continue;
    let zPickRate = 0;
    let zPostRate = 0;
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
    wordStats[word] = { ...wordStat, drawerScore, drawerUncertainty };
  }
  const decayedWordStats = await applyScoreDecay(wordStats, config);
  const scoreEntries = words.map((word) => ({
    member: word,
    score: decayedWordStats[word]?.drawerScore ?? 0,
  }));
  const uncertaintyEntries = words.map((word) => ({
    member: word,
    score: decayedWordStats[word]?.drawerUncertainty ?? 0,
  }));
  await Promise.all([
    redis.zAdd(REDIS_KEYS.wordsAll(context.subredditName), ...scoreEntries),
    redis.zAdd(
      REDIS_KEYS.wordsUncertainty(context.subredditName),
      ...uncertaintyEntries
    ),
    redis.expire(
      REDIS_KEYS.wordsHourlyStats(context.subredditName, timestamp),
      90 * 24 * 60 * 60
    ),
  ]);
}
