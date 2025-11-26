import {
  redis,
  scheduler,
  realtime,
  context,
  cache,
  media,
} from '@devvit/web/server';
import { incrementScore } from '@server/services/progression';
import { REDIS_KEYS, acquireLock, isRateLimited } from '@server/core/redis';
import { normalizeWord, obfuscateString } from '@shared/utils/string';
import { shouldShowWord } from '@server/services/words/word-backing';
import type { DrawingPostDataExtended } from '@shared/schema/pixelary';
import { createPost } from '@server/core/post';
import { setPostFlair } from '@server/core/flair';
import type { DrawingData } from '@shared/schema/drawing';
import type { T1, T2, T3 } from '@devvit/shared-types/tid.js';
import { isT2, isT3 } from '@devvit/shared-types/tid.js';
import {
  AUTHOR_REWARD_CORRECT_GUESS,
  AUTHOR_REWARD_SUBMIT,
  GUESSER_REWARD_SOLVE,
} from '@shared/constants';
import type { MediaAsset } from '@devvit/web/server';
import {
  createPinnedComment,
  updatePinnedComment,
} from '@server/services/comments/pinned';
import { REALTIME_CHANNELS } from '@server/core/realtime';
import { encodeDrawingToPngDataUrl } from '@server/utils/png';
import { migrateOldDrawingPost } from './migration';

const DRAWING_DATA_TTL = 5 * 60;

async function getCachedDrawingData(
  postId: T3
): Promise<Record<string, string>> {
  return await cache(
    async () => {
      return await redis.hGetAll(REDIS_KEYS.drawing(postId));
    },
    {
      key: `drawing_data:${postId}`,
      ttl: DRAWING_DATA_TTL,
    }
  );
}

export const createDrawing = async (options: {
  word: string;
  dictionary: string;
  drawing: DrawingData;
  authorName: string;
  authorId: T2;
}): Promise<{ id: T3; createdAt: Date }> => {
  const { word, dictionary, drawing, authorName, authorId } = options;

  let imageUrl: string | undefined;
  try {
    const dataUrl = encodeDrawingToPngDataUrl(drawing, 256);
    const mediaResponse: MediaAsset = await media.upload({
      url: dataUrl,
      type: 'image',
    });
    imageUrl = mediaResponse.mediaUrl;
  } catch (error) {
    console.warn('Failed to generate or upload image:', error);
  }

  const postData = {
    type: 'drawing' as const,
    word,
    drawing,
    dictionary,
    authorId,
    authorName,
  };

  const post = await createPost(
    `What did u/${authorName} draw?`,
    postData,
    imageUrl
  );

  const postId = post.id;
  const currentDate = new Date();
  const currentTime = currentDate.getTime();
  const normalizedWord = normalizeWord(word);

  await Promise.all([
    redis.hSet(REDIS_KEYS.drawing(postId), {
      type: 'drawing',
      postId,
      createdAt: post.createdAt.getTime().toString(),
      word,
      normalizedWord,
      dictionary,
      drawing: JSON.stringify(drawing),
      authorId,
      authorName,
    }),
    incrementScore(authorId, AUTHOR_REWARD_SUBMIT),
    redis.zAdd(REDIS_KEYS.wordDrawings(word), {
      member: postId,
      score: currentTime,
    }),
    redis.zAdd(REDIS_KEYS.allDrawings(), {
      member: postId,
      score: currentTime,
    }),
    redis.zAdd(REDIS_KEYS.userDrawings(authorId), {
      member: postId,
      score: currentTime,
    }),
    // Index into blended user art feed and hydrate listing snapshot
    redis.zAdd(REDIS_KEYS.userArt(authorId), {
      member: `d:${postId}`,
      score: currentTime,
    }),
    redis.hSet(REDIS_KEYS.userArtItem(authorId, `d:${postId}`), {
      type: 'drawing',
      postId,
      drawing: JSON.stringify(drawing),
      createdAt: currentTime.toString(),
    }),
  ]);

  try {
    await scheduler.runJob({
      name: 'NEW_DRAWING_PINNED_COMMENT',
      data: { postId, authorName, word },
      runAt: currentDate,
    });
  } catch (error) {
    // Ignore scheduling errors: comment creation is best-effort
  }

  try {
    await setPostFlair(postId, context.subredditName, 'unranked');
  } catch (error) {
    // Ignore flair errors: should not block post creation
  }

  return post;
};

export async function getDrawing(
  postId: T3
): Promise<DrawingPostDataExtended | null> {
  const key = REDIS_KEYS.drawing(postId);
  const [data, stats] = await Promise.all([
    redis.hGetAll(key),
    getDrawingStats(postId),
  ]);
  const {
    type,
    word,
    dictionary,
    drawing,
    authorId,
    authorName,
    lastCommentUpdate,
  } = data;
  const { playerCount, solvedPercentage } = stats;

  // If new format exists and is valid, return it
  if (
    type === 'drawing' &&
    word &&
    dictionary &&
    drawing &&
    authorId &&
    authorName
  ) {
    return {
      type: 'drawing',
      postId,
      word,
      dictionary,
      drawing: JSON.parse(drawing),
      authorId,
      authorName,
      playerCount,
      solvedPercentage,
      lastCommentUpdate: lastCommentUpdate
        ? parseInt(lastCommentUpdate)
        : undefined,
    };
  }

  // New format doesn't exist or is invalid, try migrating from old format
  const migrationSuccess = await migrateOldDrawingPost(postId);
  if (migrationSuccess) {
    // Migration succeeded, fetch the newly migrated data
    const migratedData = await redis.hGetAll(key);
    const migratedStats = await getDrawingStats(postId);
    const {
      type: migratedType,
      word: migratedWord,
      dictionary: migratedDictionary,
      drawing: migratedDrawing,
      authorId: migratedAuthorId,
      authorName: migratedAuthorName,
      lastCommentUpdate: migratedLastCommentUpdate,
    } = migratedData;
    const {
      playerCount: migratedPlayerCount,
      solvedPercentage: migratedSolvedPercentage,
    } = migratedStats;
    if (
      migratedType === 'drawing' &&
      migratedWord &&
      migratedDictionary &&
      migratedDrawing &&
      migratedAuthorId &&
      migratedAuthorName
    ) {
      return {
        type: 'drawing',
        postId,
        word: migratedWord,
        dictionary: migratedDictionary,
        drawing: JSON.parse(migratedDrawing),
        authorId: migratedAuthorId,
        authorName: migratedAuthorName,
        playerCount: migratedPlayerCount,
        solvedPercentage: migratedSolvedPercentage,
        lastCommentUpdate: migratedLastCommentUpdate
          ? parseInt(migratedLastCommentUpdate)
          : undefined,
      };
    }
  }

  // Migration failed or no old format found
  return null;
}

export async function getDrawings(
  postIds: T3[]
): Promise<DrawingPostDataExtended[]> {
  if (postIds.length === 0) return [];
  const drawings = await Promise.all(
    postIds.map(async (postId) => await getDrawing(postId))
  );
  return drawings.filter(
    (drawing): drawing is DrawingPostDataExtended => drawing !== null
  );
}

export async function skipDrawing(postId: T3, userId: T2): Promise<void> {
  const key = REDIS_KEYS.drawingSkips(postId);
  await redis.zAdd(key, { member: userId, score: Date.now() });
}

export async function getDrawingStats(
  postId: T3
): Promise<{ playerCount: number; solvedPercentage: number }> {
  return await cache(
    async () => {
      const [playerCount, solvedCount] = await Promise.all([
        redis.zCard(REDIS_KEYS.drawingAttempts(postId)),
        redis.zCard(REDIS_KEYS.drawingSolves(postId)),
      ]);
      return {
        playerCount,
        solvedPercentage:
          playerCount === 0
            ? 0
            : Math.round((solvedCount / playerCount) * 100 * 10) / 10,
      };
    },
    { key: `drawing:stats:${postId}`, ttl: 5 }
  );
}

export async function saveLastCommentUpdate(
  postId: T3,
  updatedAt: number
): Promise<void> {
  const key = REDIS_KEYS.drawing(postId);
  await redis.hSet(key, { lastCommentUpdate: updatedAt.toString() });
}

export async function saveNextScheduledJobId(
  postId: T3,
  jobId: string
): Promise<void> {
  const key = REDIS_KEYS.drawing(postId);
  await redis.hSet(key, { nextScheduledJobId: jobId });
}

export async function clearNextScheduledJobId(postId: T3): Promise<void> {
  const key = REDIS_KEYS.drawing(postId);
  await redis.hDel(key, ['nextScheduledJobId']);
}

export async function handleCommentUpdateCooldown(postId: T3): Promise<void> {
  const lockKey = REDIS_KEYS.commentUpdateLock(postId);
  const LOCK_TTL = 30;
  const ONE_MINUTE = 60 * 1000;
  const gotLock = await acquireLock(lockKey, LOCK_TTL);
  if (!gotLock) return;
  try {
    const now = Date.now();
    const [lastUpdate, nextJobId] = await Promise.all([
      redis.hGet(REDIS_KEYS.drawing(postId), 'lastCommentUpdate'),
      redis.hGet(REDIS_KEYS.drawing(postId), 'nextScheduledJobId'),
    ]);
    const lastUpdateTime = lastUpdate ? parseInt(lastUpdate) : 0;
    const timeSinceLastUpdate = now - lastUpdateTime;
    if (timeSinceLastUpdate >= ONE_MINUTE) {
      if (nextJobId) {
        try {
          await scheduler.cancelJob(nextJobId);
          await clearNextScheduledJobId(postId);
        } catch (e) {
          // Ignore cancellation errors
        }
      }
      try {
        await scheduleCommentUpdate(postId, new Date(now));
      } catch (e) {
        // Ignore scheduling errors
      }
    } else if (!nextJobId) {
      const nextUpdateTime = lastUpdateTime + ONE_MINUTE;
      try {
        await scheduleCommentUpdate(postId, new Date(nextUpdateTime));
      } catch (e) {
        // Ignore scheduling errors
      }
    }
  } finally {
    try {
      await redis.del(lockKey);
    } catch (e) {
      // Ignore lock release errors
    }
  }
}

export async function scheduleCommentUpdate(
  postId: T3,
  runAt: Date
): Promise<string> {
  const jobId = await scheduler.runJob({
    name: 'UPDATE_DRAWING_PINNED_COMMENT',
    data: { postId },
    runAt,
  });
  await saveNextScheduledJobId(postId, jobId);
  return jobId;
}

export async function getUserDrawings(
  userId: T2,
  limit: number = 20
): Promise<T3[]> {
  const drawingIds = await redis.zRange(
    REDIS_KEYS.userDrawings(userId),
    0,
    limit - 1,
    { reverse: true, by: 'rank' }
  );
  return drawingIds.map((entry) => entry.member).filter(isT3);
}

export async function getUserDrawingsWithData(
  userId: T2,
  limit: number = 20
): Promise<DrawingPostDataExtended[]> {
  const drawingIds = await redis.zRange(
    REDIS_KEYS.userDrawings(userId),
    0,
    limit - 1,
    { reverse: true, by: 'rank' }
  );
  const postIds = drawingIds.map((entry) => entry.member).filter(isT3);
  if (postIds.length === 0) return [];
  const drawingPromises = postIds.map(async (postId) => {
    const drawingData = await redis.hGetAll(REDIS_KEYS.drawing(postId));
    return { postId, drawingData };
  });
  const results = await Promise.all(drawingPromises);
  const drawings: DrawingPostDataExtended[] = [];
  const validDrawings = results.filter(
    ({ drawingData }) => drawingData.type === 'drawing' && drawingData.drawing
  );
  const statsPromises = validDrawings.map(({ postId }) =>
    getDrawingStats(postId)
  );
  const allStats = await Promise.all(statsPromises);
  validDrawings.forEach(({ postId, drawingData }, index) => {
    const stats = allStats[index] ?? { playerCount: 0, solvedPercentage: 0 };
    drawings.push({
      postId,
      type: 'drawing',
      word: drawingData.word ?? '',
      dictionary: drawingData.dictionary ?? '',
      drawing: JSON.parse(drawingData.drawing ?? '{}'),
      authorId: drawingData.authorId as T2,
      authorName: drawingData.authorName ?? '',
      playerCount: stats.playerCount,
      solvedPercentage: stats.solvedPercentage,
    });
  });
  return drawings;
}

export async function submitGuess(options: {
  postId: T3;
  userId: T2;
  guess: string;
}): Promise<{ correct: boolean; points: number }> {
  const { postId, userId, guess } = options;
  const empty = { correct: false, points: 0 };
  if (await isRateLimited(REDIS_KEYS.rateGuess(userId), 3, 1)) return empty;
  const [drawingData, solved, skipped] = await Promise.all([
    getCachedDrawingData(postId),
    redis.zScore(REDIS_KEYS.drawingSolves(postId), userId),
    redis.zScore(REDIS_KEYS.drawingSkips(postId), userId),
  ]);
  const word = drawingData.word;
  const drawingNormalizedWord = drawingData.normalizedWord;
  const authorId = drawingData.authorId;
  if (
    !word ||
    !authorId ||
    !isT2(authorId) ||
    solved != null ||
    skipped != null
  )
    return empty;
  const normalizedGuess = normalizeWord(guess);
  const normalizedWord = drawingNormalizedWord ?? normalizeWord(word);
  const correct = normalizedGuess === normalizedWord;
  const now = Date.now();
  const redisOperations: Array<Promise<unknown>> = [
    redis.zIncrBy(REDIS_KEYS.drawingAttempts(postId), userId, 1),
    redis.zIncrBy(REDIS_KEYS.wordDrawings(word), postId, 1),
    redis.zIncrBy(REDIS_KEYS.drawingGuesses(postId), normalizedGuess, 1),
  ];
  if (correct) {
    redisOperations.push(
      redis.zAdd(REDIS_KEYS.drawingSolves(postId), {
        member: userId,
        score: now,
      }),
      incrementScore(userId, GUESSER_REWARD_SOLVE),
      incrementScore(authorId, AUTHOR_REWARD_CORRECT_GUESS)
    );
  }
  await Promise.all(redisOperations);
  void handleCommentUpdateCooldown(postId);
  const channelName = REALTIME_CHANNELS.post(postId);
  const finalStats = await getGuesses(postId);
  void realtime.send(channelName, {
    type: 'guess_submitted',
    postId,
    correct,
    timestamp: now,
    stats: finalStats,
  });
  const points = correct ? GUESSER_REWARD_SOLVE : 0;
  return { correct, points };
}

export async function getGuesses(
  postId: T3,
  limit: number = 10
): Promise<{
  guesses: Record<string, number>;
  wordCount: number;
  guessCount: number;
  playerCount: number;
  solvedCount: number;
}> {
  const [guesses, stats, solvedCount] = await Promise.all([
    redis
      .zRange(REDIS_KEYS.drawingGuesses(postId), 0, limit - 1, {
        reverse: true,
        by: 'rank',
      })
      .then((guesses) =>
        guesses.reduce<Record<string, number>>(
          (acc, guess) => ({ ...acc, [guess.member]: guess.score }),
          {}
        )
      ),
    getDrawingStats(postId),
    redis.zCard(REDIS_KEYS.drawingSolves(postId)),
  ]);
  const guessCount = Object.values(guesses).reduce<number>(
    (sum, count) => sum + Number(count),
    0
  );
  const wordCount = Object.keys(guesses).length;
  const words = Object.keys(guesses);
  const showChecks = await Promise.all(
    words.map((word) => shouldShowWord(word))
  );
  const obfuscatedGuesses: Record<string, number> = {};
  words.forEach((word, i) => {
    const displayWord = showChecks[i] ? word : obfuscateString(word);
    obfuscatedGuesses[displayWord] = guesses[word] ?? 0;
  });
  return {
    guesses: obfuscatedGuesses,
    wordCount,
    guessCount,
    playerCount: stats.playerCount,
    solvedCount,
  };
}

export async function getDrawingCommentData(postId: T3): Promise<{
  solves: number;
  solvedPercentage: number;
  skips: number;
  skipPercentage: number;
  wordCount: number;
  guessCount: number;
  playerCount: number;
  guesses: Array<{ word: string; count: number }>;
}> {
  const [playerCount, solvedCount, skippedCount, wordCount, guesses] =
    await Promise.all([
      redis.zCard(REDIS_KEYS.drawingAttempts(postId)),
      redis.zCard(REDIS_KEYS.drawingSolves(postId)),
      redis.zCard(REDIS_KEYS.drawingSkips(postId)),
      redis.zCard(REDIS_KEYS.drawingGuesses(postId)),
      redis.zRange(REDIS_KEYS.drawingGuesses(postId), 0, -1, {
        reverse: true,
        by: 'rank',
      }),
    ]);
  const guessesTyped = guesses as Array<{ member: string; score: number }>;
  const solvedPercentage =
    playerCount === 0
      ? 0
      : Math.round((solvedCount / playerCount) * 100 * 10) / 10;
  const skipPercentage =
    playerCount === 0
      ? 0
      : Math.round((skippedCount / playerCount) * 100 * 10) / 10;
  const guessesParsed = guessesTyped.map((guess) => ({
    word: guess.member,
    count: guess.score,
  }));
  const guessCount = guessesParsed.reduce<number>(
    (sum, guess) => sum + guess.count,
    0
  );
  return {
    solves: solvedCount,
    solvedPercentage,
    skips: skippedCount,
    skipPercentage,
    wordCount,
    guessCount,
    playerCount,
    guesses: guessesParsed,
  };
}

type DrawingCommentStats = {
  playerCount: number;
  guessCount: number;
  wordCount: number;
  skips: number;
  skipPercentage: number;
  solves: number;
  solvedPercentage: number;
};

type CommentSection = {
  content: string;
  condition?: (stats: DrawingCommentStats) => boolean;
};

export async function createDrawingPostComment(postId: T3): Promise<T1> {
  const commentText = generateDrawingCommentText();
  const id = await createPinnedComment(postId, commentText);
  await saveLastCommentUpdate(postId, Date.now());
  return id;
}

export async function updateDrawingPostComment(postId: T3): Promise<void> {
  const postData = await getDrawing(postId);
  if (!postData) {
    throw new Error(`Post data not found for ${postId}`);
  }
  const stats = await getDrawingCommentData(postId);
  const commentText = generateDrawingCommentText(stats);
  await updatePinnedComment(postId, commentText);
  await saveLastCommentUpdate(postId, Date.now());
  await clearNextScheduledJobId(postId);
}

export function generateDrawingCommentText(
  stats?: DrawingCommentStats
): string {
  const sections: CommentSection[] = [
    {
      content: `Pixelary is a community drawing and guessing game. Submit your guess in the post above!`,
    },
    {
      content: generateDifficultySection(stats),
      condition: (stats) => stats.guessCount >= 100,
    },
    { content: generateLiveStatsSection(stats), condition: () => !!stats },
    {
      content: `Comment commands:

* \`!words\` - See dictionary
* \`!add <word>\` - Add word to dictionary (Level 2 required)
* \`!remove <word>\` - Remove word from dictionary (Level 2 required)
* \`!show <word>\` - Reveal an obfuscated guess on the results screen
* \`!help\` - View more commands

Accountability note: Users add words publicly via comments. Others can remove them. Words removed by Reddit's safety systems cannot be added back.`,
    },
    { content: `Good luck and thanks for playing!` },
  ];
  return sections
    .filter(
      (section) => !section.condition || (stats && section.condition(stats))
    )
    .map((section) => section.content)
    .join('\n\n');
}

function generateDifficultySection(
  stats: DrawingCommentStats | undefined
): string {
  if (!stats) return '';
  const difficultyScore =
    stats.playerCount > 0
      ? Math.round((stats.guessCount / stats.playerCount) * 10) / 10
      : 0;
  const difficultyLevel =
    difficultyScore < 2
      ? '🟢 Easy'
      : difficultyScore < 4
        ? '🟡 Medium'
        : difficultyScore < 6
          ? '🟠 Hard'
          : '🔴 Expert';
  return `Difficulty: ${difficultyLevel} (${difficultyScore}/10)`;
}

function generateLiveStatsSection(
  stats: DrawingCommentStats | undefined
): string {
  if (!stats) return '';
  const avgGuessesPerPlayer =
    stats.playerCount > 0
      ? Math.round((stats.guessCount / stats.playerCount) * 10) / 10
      : 0;
  return `Live stats:\n- ${stats.playerCount} unique players guessed\n- ${stats.guessCount} total guesses (avg ${avgGuessesPerPlayer} per player)\n- ${stats.wordCount} unique words guessed\n- ${stats.skips} skips (${stats.skipPercentage}% skip rate)\n- ${stats.solves} solves (${stats.solvedPercentage}% solved rate)`;
}

export async function getUserDrawingStatus(
  postId: T3,
  userId: T2
): Promise<{ solved: boolean; skipped: boolean; guessCount: number }> {
  const [solved, skipped, guesses] = await Promise.all([
    redis.zScore(REDIS_KEYS.drawingSolves(postId), userId),
    redis.zScore(REDIS_KEYS.drawingSkips(postId), userId),
    redis.zRange(REDIS_KEYS.drawingGuesses(postId), 0, -1, { by: 'rank' }),
  ]);
  const guessesTyped2 = guesses as Array<{ member: string; score: number }>;
  const guessCount = guessesTyped2.reduce<number>((sum, g) => sum + g.score, 0);
  return { solved: solved != null, skipped: skipped != null, guessCount };
}

export async function isAuthorFirstView(postId: T3): Promise<boolean> {
  const key = REDIS_KEYS.authorViews(postId);
  const views = await redis.incrBy(key, 1);
  return views === 1;
}
