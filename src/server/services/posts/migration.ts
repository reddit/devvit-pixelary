import { redis, reddit } from '@devvit/web/server';
import { REDIS_KEYS, acquireLock, releaseLock } from '@server/core/redis';
import { normalizeWord } from '@shared/utils/string';
import { DrawingUtils } from '@shared/schema/drawing';
import type { DrawingData } from '@shared/schema/drawing';
import type { T2, T3 } from '@devvit/shared-types/tid.js';
import { isT2 } from '@devvit/shared-types/tid.js';

const OLD_COLOR_PALETTE = [
  '#FFFFFF',
  '#000000',
  '#EB5757',
  '#F2994A',
  '#F2C94C',
  '#27AE60',
  '#2F80ED',
  '#9B51E0',
];

const MIGRATION_LOCK_TTL = 60; // seconds

/**
 * Convert old drawing data format (number[]) to new DrawingData format
 */
function convertOldDrawingData(oldData: number[]): DrawingData {
  // Convert number[] to Uint8Array
  const dataArray = new Uint8Array(oldData.length);
  for (let i = 0; i < oldData.length; i++) {
    dataArray[i] = oldData[i] ?? 0;
  }

  // Encode to base64 using DrawingUtils
  const encodedData = DrawingUtils._encodeData(dataArray);

  return {
    data: encodedData,
    colors: OLD_COLOR_PALETTE,
    bg: 0,
    size: 16,
  };
}

/**
 * Migrate an old drawing post from the old schema to the new schema
 * @param postId - The post ID to migrate
 * @returns true if migration was successful, false otherwise
 */
export async function migrateOldDrawingPost(
  postId: T3
): Promise<boolean> {
  const oldPostKey = `post-${postId}`;
  const newDrawingKey = REDIS_KEYS.drawing(postId);
  const migrationMarkerKey = REDIS_KEYS.migrationMarker(postId);
  const migrationLockKey = REDIS_KEYS.migrationLock(postId);

  // Pre-flight checks
  const [newFormatExists, markerExists, oldFormatExists] = await Promise.all([
    redis.exists(newDrawingKey as never),
    redis.exists(migrationMarkerKey as never),
    redis.exists(oldPostKey as never),
  ]);

  if (newFormatExists) {
    return false; // Already migrated
  }

  if (markerExists) {
    return false; // Already checked, no old data
  }

  if (!oldFormatExists) {
    // Set marker to avoid future checks
    await redis.set(migrationMarkerKey as never, '1' as never, {
      ex: 7 * 24 * 60 * 60, // 7 days TTL
    } as never);
    return false; // No old format found
  }

  // Acquire migration lock
  const lockAcquired = await acquireLock(migrationLockKey, MIGRATION_LOCK_TTL);
  if (!lockAcquired) {
    return false; // Another process is migrating
  }

  try {
    // Re-check after lock (double-check pattern)
    const [newFormatExistsAfterLock, markerExistsAfterLock] =
      await Promise.all([
        redis.exists(newDrawingKey as never),
        redis.exists(migrationMarkerKey as never),
      ]);

    if (newFormatExistsAfterLock || markerExistsAfterLock) {
      return false; // Already migrated by another process
    }

    // Read old post data
    const oldPostData = await redis.hGetAll(oldPostKey as never);
    const postType = oldPostData.postType;
    if (postType !== 'drawing') {
      return false; // Not a drawing post
    }

    const authorUsername = oldPostData.authorUsername;
    const dateStr = oldPostData.date;
    const word = oldPostData.word;
    const dictionaryName = oldPostData.dictionaryName || 'main';
    const dataStr = oldPostData.data;

    if (!authorUsername || !dateStr || !word || !dataStr) {
      console.error(
        `Migration failed for ${postId}: missing required fields`,
        { authorUsername, dateStr, word, dataStr }
      );
      return false;
    }

    // Resolve author username to userId
    const authorUser = await reddit.getUserByUsername(authorUsername);
    if (!authorUser?.id || !isT2(authorUser.id)) {
      console.error(
        `Migration failed for ${postId}: could not resolve author username ${authorUsername}`
      );
      return false;
    }

    const authorId = authorUser.id;
    const authorName = authorUser.username;

    // Convert drawing data
    let oldDataArray: number[];
    try {
      oldDataArray = JSON.parse(dataStr) as number[];
    } catch (error) {
      console.error(
        `Migration failed for ${postId}: invalid data format`,
        error
      );
      return false;
    }

    const drawingData = convertOldDrawingData(oldDataArray);
    const normalizedWord = normalizeWord(word);
    const createdAt = parseInt(dateStr, 10);

    // Write new drawing hashmap
    await redis.hSet(newDrawingKey as never, {
      type: 'drawing',
      postId,
      createdAt: createdAt.toString(),
      word,
      normalizedWord,
      dictionary: dictionaryName,
      drawing: JSON.stringify(drawingData),
      authorId,
      authorName,
    });

    // Set postData on the post to mark it as migrated
    try {
      const post = await reddit.getPostById(postId);
      await post.setPostData({ type: 'drawing' });
    } catch (error) {
      console.warn(
        `Failed to set postData for ${postId} (migration continues):`,
        error
      );
    }

    // Migrate solves
    const oldSolvesKey = `solved:${postId}`;
    const newSolvesKey = REDIS_KEYS.drawingSolves(postId);
    const solvesExists = await redis.exists(oldSolvesKey as never);
    if (solvesExists) {
      const solves = await redis.zRange(oldSolvesKey as never, 0, -1);
      if (solves.length > 0) {
        // Resolve each username individually to preserve timestamp mapping
        const solvePromises = solves.map(async (solve) => {
          const username = solve.member;
          const timestamp = solve.score;
          try {
            const user = await reddit.getUserByUsername(username);
            if (user?.id && isT2(user.id)) {
              await redis.zAdd(newSolvesKey as never, {
                member: user.id,
                score: timestamp,
              });
            }
          } catch (error) {
            console.warn(
              `Failed to resolve username ${username} for solves migration:`,
              error
            );
          }
        });
        await Promise.all(solvePromises);
      }
    }

    // Migrate skips
    const oldSkipsKey = `skipped:${postId}`;
    const newSkipsKey = REDIS_KEYS.drawingSkips(postId);
    const skipsExists = await redis.exists(oldSkipsKey as never);
    if (skipsExists) {
      const skips = await redis.zRange(oldSkipsKey as never, 0, -1);
      if (skips.length > 0) {
        const skipPromises = skips.map(async (skip) => {
          const username = skip.member;
          const timestamp = skip.score;
          try {
            const user = await reddit.getUserByUsername(username);
            if (user?.id && isT2(user.id)) {
              await redis.zAdd(newSkipsKey as never, {
                member: user.id,
                score: timestamp,
              });
            }
          } catch (error) {
            console.warn(
              `Failed to resolve username ${username} for skips migration:`,
              error
            );
          }
        });
        await Promise.all(skipPromises);
      }
    }

    // Migrate guesses
    const oldGuessesKey = `guesses:${postId}`;
    const newGuessesKey = REDIS_KEYS.drawingGuesses(postId);
    const guessesExists = await redis.exists(oldGuessesKey as never);
    if (guessesExists) {
      const guesses = await redis.zRange(oldGuessesKey as never, 0, -1);
      if (guesses.length > 0) {
        const guessPromises = guesses.map(async (guess) => {
          const normalizedGuess = guess.member;
          const count = guess.score;
          await redis.zAdd(newGuessesKey as never, {
            member: normalizedGuess,
            score: count,
          });
        });
        await Promise.all(guessPromises);
      }
    }

    // Migrate user guess counter (attempts)
    const oldUserGuessCounterKey = `user-guess-counter:${postId}`;
    const newAttemptsKey = REDIS_KEYS.drawingAttempts(postId);
    const userGuessCounterExists = await redis.exists(
      oldUserGuessCounterKey as never
    );
    if (userGuessCounterExists) {
      const attempts = await redis.zRange(oldUserGuessCounterKey as never, 0, -1);
      if (attempts.length > 0) {
        // Resolve each username individually to preserve guess count mapping
        const attemptPromises = attempts.map(async (attempt) => {
          const username = attempt.member;
          const guessCount = attempt.score;
          try {
            const user = await reddit.getUserByUsername(username);
            if (user?.id && isT2(user.id)) {
              await redis.zAdd(newAttemptsKey as never, {
                member: user.id,
                score: guessCount,
              });
            }
          } catch (error) {
            console.warn(
              `Failed to resolve username ${username} for attempts migration:`,
              error
            );
          }
        });
        await Promise.all(attemptPromises);
      }
    }

    // Migrate indices (only if not already present)
    const userDrawingsKey = REDIS_KEYS.userDrawings(authorId);
    const wordDrawingsKey = REDIS_KEYS.wordDrawings(word);
    const allDrawingsKey = REDIS_KEYS.allDrawings();

    const [userDrawingsExists, wordDrawingsExists, allDrawingsExists] =
      await Promise.all([
        redis.zScore(userDrawingsKey as never, postId as never),
        redis.zScore(wordDrawingsKey as never, postId as never),
        redis.zScore(allDrawingsKey as never, postId as never),
      ]);

    if (userDrawingsExists === null) {
      await redis.zAdd(userDrawingsKey as never, {
        member: postId,
        score: createdAt,
      });
    }

    if (wordDrawingsExists === null) {
      await redis.zAdd(wordDrawingsKey as never, {
        member: postId,
        score: createdAt,
      });
    }

    if (allDrawingsExists === null) {
      await redis.zAdd(allDrawingsKey as never, {
        member: postId,
        score: createdAt,
      });
    }

    // Set migration marker
    await redis.set(migrationMarkerKey as never, '1' as never, {
      ex: 7 * 24 * 60 * 60, // 7 days TTL
    } as never);

    // Clean up old Redis keys
    const oldGuessCommentsKey = `guess-comments:${postId}`;
    await Promise.all([
      redis.del(oldPostKey as never),
      redis.del(oldSolvesKey as never),
      redis.del(oldSkipsKey as never),
      redis.del(oldGuessesKey as never),
      redis.del(oldUserGuessCounterKey as never),
      redis.del(oldGuessCommentsKey as never),
    ]);

    return true;
  } catch (error) {
    console.error(`Migration failed for ${postId}:`, error);
    return false;
  } finally {
    await releaseLock(migrationLockKey);
  }
}

/**
 * Clean up old dictionary keys (dictionary:${dictionaryName})
 * @param dictionaryName - The dictionary name to clean up
 */
export async function cleanupOldDictionary(
  dictionaryName: string
): Promise<boolean> {
  try {
    const oldDictionaryKey = `dictionary:${dictionaryName}`;
    const exists = await redis.exists(oldDictionaryKey as never);
    if (exists) {
      await redis.del(oldDictionaryKey as never);
      return true;
    }
    return false;
  } catch (error) {
    console.error(
      `Failed to cleanup dictionary ${dictionaryName}:`,
      error
    );
    return false;
  }
}

/**
 * Clean up old dictionaries registry key
 */
export async function cleanupOldDictionariesRegistry(): Promise<boolean> {
  try {
    const oldDictionariesKey = 'dictionaries';
    const exists = await redis.exists(oldDictionariesKey as never);
    if (exists) {
      await redis.del(oldDictionariesKey as never);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to cleanup dictionaries registry:', error);
    return false;
  }
}

/**
 * Clean up old game-settings key
 */
export async function cleanupOldGameSettings(): Promise<boolean> {
  try {
    const oldGameSettingsKey = 'game-settings';
    const exists = await redis.exists(oldGameSettingsKey as never);
    if (exists) {
      await redis.del(oldGameSettingsKey as never);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to cleanup game-settings:', error);
    return false;
  }
}

/**
 * Clean up old user data key (users:${username})
 * Note: Level information is computed dynamically from scores in the new system
 * @param username - The username to clean up
 */
export async function cleanupOldUserData(username: string): Promise<boolean> {
  try {
    const oldUserDataKey = `users:${username}`;
    const exists = await redis.exists(oldUserDataKey as never);
    if (exists) {
      await redis.del(oldUserDataKey as never);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Failed to cleanup user data for ${username}:`, error);
    return false;
  }
}

