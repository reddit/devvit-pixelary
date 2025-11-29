import { redis, reddit, scheduler } from '@devvit/web/server';
import { REDIS_KEYS, acquireLock, releaseLock } from '@server/core/redis';
import { normalizeWord } from '@shared/utils/string';
import { DrawingUtils } from '@shared/schema/drawing';
import type { DrawingData } from '@shared/schema/drawing';
import type { T2, T3 } from '@devvit/shared-types/tid.js';
import { isT2 } from '@devvit/shared-types/tid.js';
import { LEGACY_BASE_DRAWING_COLORS } from '@shared/constants';

// Legacy color palette for migrating old drawings (used for reference, actual palette is created in convertOldDrawingData)
const OLD_COLOR_PALETTE = [...LEGACY_BASE_DRAWING_COLORS];

const MIGRATION_LOCK_TTL = 60; // seconds

/**
 * Convert old drawing data format (number[]) to new DrawingData format
 *
 * Old system:
 * - Settings.colors = ["#FFFFFF", "#000000", "#EB5757", ...] (white at 0, black at 1)
 * - Drawing component: `if (colorIndex > 0)` means value 0 = background (white, not rendered)
 * - So: value 0 = white background, value 1 = black, value 2+ = other colors
 *
 * New system:
 * - We want white as background (bg: 0) to match the default
 * - Palette: [white(0), black(1), red(2), ...]
 *
 * Solution: The old data already has the correct mapping!
 * - Old value 0 = white background (not rendered) -> new value 0 = white background (bg: 0)
 * - Old value 1 = black -> new value 1 = black (no change needed)
 * - Other colors stay the same
 *
 * But LEGACY_BASE_DRAWING_COLORS has [black(0), white(1), ...] which is wrong!
 * We need to reorder it to match the old system: [white(0), black(1), ...]
 */
function convertOldDrawingData(oldData: number[]): DrawingData {
  // Reorder palette to match old system: [white(0), black(1), red(2), ...]
  const NEW_COLOR_PALETTE = [
    '#FFFFFF', // white (index 0 - background) - matches old system
    '#000000', // black (index 1) - matches old system
    ...LEGACY_BASE_DRAWING_COLORS.slice(2), // rest: red(2), orange(3), yellow(4), green(5), blue(6), purple(7)
  ];

  // Convert number[] to Uint8Array (no remapping needed - old system already had correct indices)
  const dataArray = new Uint8Array(oldData.length);
  for (let i = 0; i < oldData.length; i++) {
    dataArray[i] = oldData[i] ?? 0;
  }

  // Encode to base64 using DrawingUtils
  const encodedData = DrawingUtils._encodeData(dataArray);

  return {
    data: encodedData,
    colors: NEW_COLOR_PALETTE,
    bg: 0, // white is at index 0 (background) - matches old system where 0 was white background
    size: 16,
  };
}

/**
 * Migrate an old drawing post from the old schema to the new schema
 * @param postId - The post ID to migrate
 * @returns true if migration was successful, false otherwise
 */
export async function migrateOldDrawingPost(postId: T3): Promise<boolean> {
  const oldPostKeyDash = `post-${postId}`;
  const oldPostKeyColon = `post:${postId}`;
  const newDrawingKey = REDIS_KEYS.drawing(postId);
  const migrationMarkerKey = REDIS_KEYS.migrationMarker(postId);
  const migrationLockKey = REDIS_KEYS.migrationLock(postId);

  // Pre-flight checks - check both old formats
  const [
    newFormatExists,
    markerExists,
    oldFormatExistsDash,
    oldFormatExistsColon,
  ] = await Promise.all([
    redis.exists(newDrawingKey as never),
    redis.exists(migrationMarkerKey as never),
    redis.exists(oldPostKeyDash as never),
    redis.exists(oldPostKeyColon as never),
  ]);

  const oldFormatExists = oldFormatExistsDash || oldFormatExistsColon;
  const oldPostKey = oldFormatExistsDash ? oldPostKeyDash : oldPostKeyColon;

  if (newFormatExists) {
    return false; // Already migrated
  }

  // Check postData if no Redis old format exists (even if marker exists - marker might predate postData check)
  if (!oldFormatExists) {
    // Check if postData exists on the post itself (might be in old format or new format)
    try {
      const post = await reddit.getPostById(postId);
      const postData = (await post.getPostData()) as {
        type?: string;
        [key: string]: unknown;
      } | null;

      // If postData exists and is in new format, sync it to Redis
      if (postData && postData.type === 'drawing') {
        // Check if it's already in new format (has drawing object with data string)
        const drawing = postData.drawing as
          | { data?: string; colors?: string[]; bg?: number; size?: number }
          | undefined;
        if (
          drawing?.data &&
          typeof drawing.data === 'string' &&
          drawing.colors &&
          Array.isArray(drawing.colors)
        ) {
          // Already in new format, just ensure Redis has it
          const word = postData.word as string;
          const dictionary = (postData.dictionary as string) ?? 'main';
          const authorId = postData.authorId as string;
          const authorName = postData.authorName as string;
          const createdAt = post.createdAt.getTime();

          if (word && dictionary && authorId && authorName) {
            await redis.hSet(newDrawingKey as never, {
              type: 'drawing',
              postId,
              createdAt: createdAt.toString(),
              word,
              normalizedWord: normalizeWord(word),
              dictionary,
              drawing: JSON.stringify(drawing),
              authorId,
              authorName,
            });
            // Clear marker since we found data
            if (markerExists) {
              await redis.del(migrationMarkerKey as never);
            }
            return true;
          }
        }
      }
    } catch (error) {
      console.error(
        `[Migration] Failed to check postData for ${postId}:`,
        error
      );
    }

    // Only set marker if we've checked both Redis and postData and found nothing
    if (!markerExists) {
      // Set marker to avoid future Redis checks (but we'll still check postData)
      await redis.set(
        migrationMarkerKey as never,
        '1' as never,
        {
          ex: 7 * 24 * 60 * 60, // 7 days TTL
        } as never
      );
    }
    return false; // No old format found
  }

  // If marker exists but we found old format, clear it and proceed
  if (markerExists) {
    await redis.del(migrationMarkerKey as never);
  }

  // Acquire migration lock
  const lockAcquired = await acquireLock(migrationLockKey, MIGRATION_LOCK_TTL);
  if (!lockAcquired) {
    return false; // Another process is migrating
  }

  try {
    // Re-check after lock (double-check pattern)
    const [newFormatExistsAfterLock, markerExistsAfterLock] = await Promise.all(
      [
        redis.exists(newDrawingKey as never),
        redis.exists(migrationMarkerKey as never),
      ]
    );

    if (newFormatExistsAfterLock || markerExistsAfterLock) {
      return false; // Already migrated by another process
    }

    // Read old post data (use the key that exists)
    const oldPostData = await redis.hGetAll(oldPostKey as never);
    const postType = oldPostData.postType;
    if (postType !== 'drawing') {
      return false; // Not a drawing post
    }

    const authorUsername = oldPostData.authorUsername;
    const dateStr = oldPostData.date;
    const word = oldPostData.word;
    const dictionaryName = oldPostData.dictionaryName ?? 'main';
    const dataStr = oldPostData.data;

    if (!authorUsername || !dateStr || !word || !dataStr) {
      console.error(
        `[Migration] Failed for ${postId}: missing required fields`,
        {
          authorUsername,
          dateStr,
          word,
          dataStr,
        }
      );
      return false;
    }

    // Resolve author username to userId
    const authorUser = await reddit.getUserByUsername(authorUsername);
    if (!authorUser?.id || !isT2(authorUser.id)) {
      console.error(
        `[Migration] Failed for ${postId}: could not resolve author username ${authorUsername}`
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
        `[Migration] Failed for ${postId}: invalid data format`,
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
      await post.setPostData({
        type: 'drawing' as const,
        word,
        dictionary: dictionaryName,
        drawing: drawingData,
        authorId,
        authorName,
      });
    } catch (error) {
      console.error(
        `[Migration] Failed to set postData for ${postId} (migration continues):`,
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
      const attempts = await redis.zRange(
        oldUserGuessCounterKey as never,
        0,
        -1
      );
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
    await redis.set(
      migrationMarkerKey as never,
      '1' as never,
      {
        ex: 7 * 24 * 60 * 60, // 7 days TTL
      } as never
    );

    // Schedule pinned comment creation (non-blocking, best-effort)
    try {
      await scheduler.runJob({
        name: 'NEW_DRAWING_PINNED_COMMENT',
        data: { postId, authorName, word },
        runAt: new Date(createdAt),
      });
    } catch (error) {
      // Ignore scheduling errors: comment creation is best-effort
      console.warn(
        `[Migration] Failed to schedule pinned comment for ${postId}:`,
        error
      );
    }

    // Clean up old Redis keys
    const oldGuessCommentsKey = `guess-comments:${postId}`;
    const oldUserDrawingsKey = `user-drawings:${authorUsername}`;
    await Promise.all([
      redis.del(oldPostKey as never),
      redis.del(oldSolvesKey as never),
      redis.del(oldSkipsKey as never),
      redis.del(oldGuessesKey as never),
      redis.del(oldUserGuessCounterKey as never),
      redis.del(oldGuessCommentsKey as never),
      redis.del(oldUserDrawingsKey as never),
    ]);

    return true;
  } catch (error) {
    console.error(`[Migration] Migration failed for ${postId}:`, error);
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
    console.error(`Failed to cleanup dictionary ${dictionaryName}:`, error);
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

/**
 * Clean up old word selection events keys
 * These are global sorted sets tracking word selection events (no longer needed)
 */
export async function cleanupOldWordSelectionEvents(): Promise<boolean> {
  try {
    const oldKeys = ['word-selection-events', 'word-selection-events-v2'];
    let cleaned = false;
    for (const key of oldKeys) {
      const exists = await redis.exists(key as never);
      if (exists) {
        await redis.del(key as never);
        cleaned = true;
      }
    }
    return cleaned;
  } catch (error) {
    console.error('Failed to cleanup word selection events:', error);
    return false;
  }
}
