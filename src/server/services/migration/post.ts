import { type Post, redis, reddit } from '@devvit/web/server';
import type { T2, T3 } from '@devvit/shared-types/tid.js';
import { isT2 } from '@devvit/shared-types/tid.js';
import { REDIS_KEYS, acquireLock, releaseLock } from '@server/core/redis';
import { normalizeWord } from '@src/shared/utils/string';
import { z } from 'zod';
import {
  DrawingPostDataSchema,
  DrawingDataSchema,
} from '@shared/schema/pixelary';
import { DrawingUtils } from '@shared/schema/drawing';
import type { DrawingData } from '@shared/schema/drawing';
import { createDrawingPostComment } from '@server/services/posts/drawing';
import { cleanupPostKeys } from './cleanup';
import {
  MIGRATION_FAILED_KEY,
  MIGRATION_SKIPPED_KEY,
  MIGRATED_COUNT_KEY,
} from './status';

/*
 * Constants
 */

const MIGRATION_LOCK_TTL_MS = 60 * 1000; // 60 seconds in milliseconds
const LEGACY_COLORS = [
  '#FFFFFF', // white
  '#000000', // black
  '#EB5757', // red
  '#F2994A', // orange
  '#F2C94C', // yellow
  '#27AE60', // green
  '#2F80ED', // blue
  '#9B51E0', // purple
];

/*
 * Types
 */

type DrawingSchemaVersion = 1 | 2 | 3 | null;

/**
 * Schema for the Redis hash structure of a drawing post (version 3)
 */
const DrawingRedisHashSchema = z.object({
  type: z.literal('drawing'),
  postId: z.string(),
  createdAt: z.string(),
  word: z.string(),
  normalizedWord: z.string(),
  dictionary: z.string(),
  drawing: z.string(), // JSON stringified DrawingData
  authorId: z.string(),
  authorName: z.string(),
});

/**
 * Convert old drawing data format (number[]) to new DrawingData format
 */
export function convertOldDrawingData(oldData: number[]): DrawingData {
  // Convert number[] to Uint8Array
  const dataArray = new Uint8Array(oldData.length);
  for (let i = 0; i < oldData.length; i++) {
    dataArray[i] = oldData[i] ?? 0;
  }

  // Encode to base64 using DrawingUtils
  const encodedData = DrawingUtils._encodeData(dataArray);

  return {
    data: encodedData,
    colors: LEGACY_COLORS,
    bg: 0, // white
    size: 16,
  };
}

/**
 * Migrate a drawing post by postId (lazy migration)
 * Fetches the post and calls migratePost
 * @param postId - The post ID to migrate
 * @returns `true` if migration was successful or already complete, `false` if migration failed
 */
export async function migratePostById(postId: T3): Promise<boolean> {
  try {
    const post = await reddit.getPostById(postId);
    return await migratePost(post);
  } catch (error) {
    console.error('[Migration] Failed to migrate post', {
      postId,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  }
}

/**
 * Migrate a drawing post
 * @param post - The post to migrate
 * @returns `true` if migration was successful or already complete, `false` if migration failed
 */
export async function migratePost(post: Post): Promise<boolean> {
  // Pre-migration validation: check if already migrated
  const isValid = await validatePost(post);
  if (isValid) {
    return true; // Already migrated, no work needed
  }

  // Check schema version
  const schema = await detectDrawingSchemaVersion(post.id);
  if (schema === null) {
    // Cannot determine schema version, skip migration
    console.error('[Migration] Cannot determine schema version for post', {
      postId: post.id,
      authorId: post.authorId,
      authorName: post.authorName,
    });

    await redis.zAdd(MIGRATION_SKIPPED_KEY, {
      member: post.id,
      score: Date.now(),
    });

    return false;
  }

  // Route to appropriate migration function based on schema version
  let migrationSuccess = false;
  try {
    if (schema === 1) {
      migrationSuccess = await migrateV1ToV3(post.id);
    } else if (schema === 2) {
      migrationSuccess = await migrateV2ToV3(post.id);
    } else {
      // Already version 3, but validation failed - might be missing indexes
      // Try to ensure all indexes are present
      const indexesFixed = await ensureV3Indexes(post);
      if (indexesFixed) {
        const recheckValid = await validatePost(post);
        if (recheckValid) {
          return true;
        }
      }

      // Still invalid after fixing indexes, mark as failed
      console.error('[Migration] Post is version 3 but validation failed', {
        postId: post.id,
        authorId: post.authorId,
        authorName: post.authorName,
      });
      await redis.zAdd(MIGRATION_FAILED_KEY, {
        member: post.id,
        score: Date.now(),
      });
      return false;
    }

    if (migrationSuccess) {
      // Post-migration validation: verify migration actually succeeded
      const postMigrationValid = await validatePost(post);
      if (!postMigrationValid) {
        console.error(
          '[Migration] Post migration completed but validation failed',
          {
            postId: post.id,
            schemaVersion: schema,
            authorId: post.authorId,
            authorName: post.authorName,
          }
        );
        await redis.zAdd(MIGRATION_FAILED_KEY, {
          member: post.id,
          score: Date.now(),
        });
        return false;
      }

      // Only increment counter on successful migration
      await redis.incrBy(MIGRATED_COUNT_KEY, 1);
      return true;
    } else {
      // Migration function returned false (lock conflict or other issue)
      return false;
    }
  } catch (error) {
    // Handle errors during migration (e.g., deleted posts, API failures)
    console.error('[Migration] Error migrating post', {
      postId: post.id,
      schemaVersion: schema,
      authorId: post.authorId,
      authorName: post.authorName,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    await redis.zAdd(MIGRATION_FAILED_KEY, {
      member: post.id,
      score: Date.now(),
    });
    return false;
  }
}

/**
 * Validate that a Post conforms with the latest drawing post schema
 * @param post - The post to validate
 * @returns `true` if the post conforms to the latest drawing post schema, `false` otherwise
 */
async function validatePost(post: Post): Promise<boolean> {
  const { authorId, authorName, id, createdAt } = post;

  // Has complete Post object
  if (!authorId) {
    // Don't log - this is expected for already-migrated posts during validation
    return false;
  }

  // Validate post data using Zod schema
  const postData = await post.getPostData();
  const postDataResult = DrawingPostDataSchema.safeParse(postData);
  if (!postDataResult.success) {
    return false;
  }

  const data = postDataResult.data;

  // Validate that post data matches post metadata
  if (data.authorId !== authorId || data.authorName !== authorName) {
    return false;
  }

  // Validate Redis hash structure using Zod schema
  const hash = await redis.hGetAll(REDIS_KEYS.drawing(id));
  const hashResult = DrawingRedisHashSchema.safeParse(hash);
  if (!hashResult.success) {
    return false;
  }

  const hashData = hashResult.data;

  // Validate hash data matches post and postData
  if (
    hashData.postId !== id ||
    hashData.createdAt !== createdAt.getTime().toString() ||
    hashData.word !== data.word ||
    hashData.normalizedWord !== normalizeWord(data.word) ||
    hashData.dictionary !== data.dictionary ||
    hashData.authorId !== authorId ||
    hashData.authorName !== authorName
  ) {
    return false;
  }

  // Validate drawing JSON matches by parsing and comparing parsed objects
  let hashDrawing: unknown;
  try {
    hashDrawing = JSON.parse(hashData.drawing);
  } catch {
    return false;
  }

  const drawingResult = DrawingDataSchema.safeParse(hashDrawing);
  if (!drawingResult.success) {
    return false;
  }

  // Compare parsed drawing objects (order-independent comparison)
  const parsedHashDrawing = drawingResult.data;
  if (
    parsedHashDrawing.data !== data.drawing.data ||
    parsedHashDrawing.bg !== data.drawing.bg ||
    parsedHashDrawing.size !== data.drawing.size ||
    JSON.stringify([...parsedHashDrawing.colors].sort()) !==
      JSON.stringify([...data.drawing.colors].sort())
  ) {
    return false;
  }

  // Validate indices
  const userArtKey = REDIS_KEYS.userArt(authorId);
  const compositeId = `d:${id}`;
  const [wordDrawingEntry, userDrawingEntry, allDrawingEntry, userArtEntry] =
    await Promise.all([
      redis.zScore(REDIS_KEYS.wordDrawings(data.word), id),
      redis.zScore(REDIS_KEYS.userDrawings(authorId), id),
      redis.zScore(REDIS_KEYS.allDrawings(), id),
      redis.zScore(userArtKey, compositeId),
    ]);

  if (
    !wordDrawingEntry ||
    !userDrawingEntry ||
    !allDrawingEntry ||
    !userArtEntry
  ) {
    return false;
  }

  // Validate userArtItem hash exists
  const userArtItemExists = await redis.exists(
    REDIS_KEYS.userArtItem(authorId, compositeId)
  );
  if (!userArtItemExists) {
    return false;
  }

  return true;
}

/**
 * Ensure all required indexes exist for a version 3 drawing post
 * This fixes drawings that were migrated before userArt indexes were added
 * @param post - The post to ensure indexes for
 * @returns `true` if indexes were fixed or already present, `false` if unable to fix
 */
async function ensureV3Indexes(post: Post): Promise<boolean> {
  const { authorId, id, createdAt } = post;

  if (!authorId) {
    return false;
  }

  try {
    // Get drawing data from Redis
    const hash = await redis.hGetAll(REDIS_KEYS.drawing(id));
    const word = hash?.word;
    const drawingData = hash?.drawing;
    const createdAtStr = hash?.createdAt;

    if (!word || !drawingData) {
      return false;
    }

    const createdAtTimestamp =
      (createdAtStr ? parseInt(createdAtStr, 10) : null) ?? createdAt.getTime();
    const userArtKey = REDIS_KEYS.userArt(authorId);
    const compositeId = `d:${id}`;

    // Check which indexes are missing
    const [
      wordDrawingExists,
      userDrawingExists,
      allDrawingExists,
      userArtExists,
    ] = await Promise.all([
      redis.zScore(REDIS_KEYS.wordDrawings(word), id),
      redis.zScore(REDIS_KEYS.userDrawings(authorId), id),
      redis.zScore(REDIS_KEYS.allDrawings(), id),
      redis.zScore(userArtKey, compositeId),
    ]);

    const userArtItemExists = await redis.exists(
      REDIS_KEYS.userArtItem(authorId, compositeId)
    );

    // Add missing indexes
    const promises: Array<Promise<unknown>> = [];

    if (wordDrawingExists === null) {
      promises.push(
        redis.zAdd(REDIS_KEYS.wordDrawings(word), {
          member: id,
          score: createdAtTimestamp,
        })
      );
    }

    if (userDrawingExists === null) {
      promises.push(
        redis.zAdd(REDIS_KEYS.userDrawings(authorId), {
          member: id,
          score: createdAtTimestamp,
        })
      );
    }

    if (allDrawingExists === null) {
      promises.push(
        redis.zAdd(REDIS_KEYS.allDrawings(), {
          member: id,
          score: createdAtTimestamp,
        })
      );
    }

    if (userArtExists === null) {
      promises.push(
        redis.zAdd(userArtKey, {
          member: compositeId,
          score: createdAtTimestamp,
        })
      );
    }

    if (!userArtItemExists) {
      promises.push(
        redis.hSet(REDIS_KEYS.userArtItem(authorId, compositeId), {
          type: 'drawing',
          postId: id,
          drawing: drawingData,
          createdAt: createdAtTimestamp.toString(),
        })
      );
    }

    if (promises.length > 0) {
      await Promise.all(promises);
      console.log('[Migration] Fixed missing indexes for v3 drawing', {
        postId: id,
        indexesFixed: promises.length,
      });
    }

    return true;
  } catch (error) {
    console.error('[Migration] Failed to ensure v3 indexes', {
      postId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Determines which schema version is being used for a drawing post with the given postId. Only returns a version number (1-3) for drawing posts; returns null for other post types. Checks keys in priority order (newest first): `drawing:${postId}` → `post:${postId}` → `post-${postId}`
 *
 * @param postId - The post ID to check
 * @returns The schema version (`1`, `2`, or `3`) for drawing posts, or `null` if not a drawing post or no schema found
 */
export async function detectDrawingSchemaVersion(
  postId: T3
): Promise<DrawingSchemaVersion> {
  const v3Key = REDIS_KEYS.drawing(postId); // drawing:${postId}
  const v2Key = `post:${postId}`;
  const v1Key = `post-${postId}`;

  // Check Version 3 first (newest format)
  // If drawing:${postId} key exists, verify it's a drawing post
  const v3Exists = await redis.exists(v3Key);
  if (v3Exists) {
    const keyType = await redis.type(v3Key);
    // Version 3 uses hash structure with 'type' field
    if (keyType === 'hash') {
      const type = await redis.hGet(v3Key, 'type');
      // Only return version if it's a drawing post
      if (type === 'drawing') {
        return 3;
      }
      // If key exists but type is not 'drawing', it's not a drawing post
      return null;
    }
  }

  // Check Version 2 (uses post:${postId}, may or may not have postId field)
  const v2Exists = await redis.exists(v2Key);
  if (v2Exists) {
    // Check if it's a hash (v2) vs string (shouldn't happen but handle it)
    const keyType = await redis.type(v2Key);
    if (keyType === 'hash') {
      // Check postType first to ensure it's a drawing post
      const postType = await redis.hGet(v2Key, 'postType');
      if (postType === 'drawing') {
        // Version 2: has postType='drawing' (postId field presence doesn't matter)
        return 2;
      }
      // Not a drawing post
      return null;
    }
  }

  // Check Version 1 (oldest format)
  // Version 1 was only used for drawing posts (based on historical usage)
  const v1Exists = await redis.exists(v1Key);
  if (v1Exists) {
    // Version 1 is stored as a JSON string, not a hash
    const keyType = await redis.type(v1Key);
    if (keyType === 'string') {
      // Version 1 was only used for drawing posts, so return 1
      return 1;
    }
    // If it's a hash, it might have been migrated but key not cleaned up
    // Check for postType field to see if it's actually v2 data
    if (keyType === 'hash') {
      const postType = await redis.hGet(v1Key, 'postType');
      if (postType === 'drawing') {
        // This is actually v2 data, but stored at v1 key (shouldn't happen normally)
        return 2;
      }
      // Not a drawing post
      return null;
    }
  }

  // No schema found
  return null;
}

/**
 * Migrate a drawing post from version 1 (JSON string at `post-${postId}`) to version 3 (hash at `drawing:${postId}`)
 *
 * @param postId - The post ID to migrate
 * @returns `true` if migration was successful, `false` otherwise
 */
export async function migrateV1ToV3(postId: T3): Promise<boolean> {
  const v1Key = `post-${postId}`;
  const v3Key = REDIS_KEYS.drawing(postId);
  const lockKey = REDIS_KEYS.migrationLock(postId);

  // Acquire lock
  const lockAcquired = await acquireLock(lockKey, MIGRATION_LOCK_TTL_MS);
  if (!lockAcquired) {
    return false;
  }

  try {
    // Double-check: verify migration hasn't happened after acquiring lock
    const v3Exists = await redis.exists(v3Key);
    if (v3Exists) {
      return false; // Already migrated by another process
    }

    // Read v1 JSON string
    const v1DataStr = await redis.get(v1Key);
    if (!v1DataStr) {
      console.error('[Migration] V1 data not found for post', {
        postId,
        v1Key,
      });
      await redis.zAdd(MIGRATION_FAILED_KEY, {
        member: postId,
        score: Date.now(),
      });
      return false;
    }

    // Parse v1 JSON
    let v1Data: {
      word?: string;
      data?: number[];
      author?: string;
      authorId?: string;
      date?: string | number | Date;
    };
    try {
      v1Data = JSON.parse(v1DataStr) as typeof v1Data;
    } catch (error) {
      console.error('[Migration] Failed to parse V1 JSON for post', {
        postId,
        error: error instanceof Error ? error.message : String(error),
      });
      await redis.zAdd(MIGRATION_FAILED_KEY, {
        member: postId,
        score: Date.now(),
      });
      return false;
    }

    const {
      word,
      data: oldDataArray,
      author,
      authorId: v1AuthorId,
      date,
    } = v1Data;

    // Validate required fields
    if (!word || !oldDataArray || !Array.isArray(oldDataArray)) {
      console.error('[Migration] Missing required fields for post', {
        postId,
        hasWord: !!word,
        hasData: !!oldDataArray,
        dataIsArray: Array.isArray(oldDataArray),
      });
      await redis.zAdd(MIGRATION_FAILED_KEY, {
        member: postId,
        score: Date.now(),
      });
      return false;
    }

    // Convert drawing data
    const drawingData = convertOldDrawingData(oldDataArray);
    const normalizedWord = normalizeWord(word);
    const dictionary = 'main'; // V1 didn't have dictionary, default to 'main'

    // Resolve author
    let authorId: T2;
    let authorName: string;

    if (v1AuthorId && isT2(v1AuthorId)) {
      // Use authorId if available and valid
      authorId = v1AuthorId;
      // Try to get username from userId
      try {
        const user = await reddit.getUserById(authorId);
        authorName = user?.username ?? author ?? 'unknown';
      } catch {
        authorName = author ?? 'unknown';
      }
    } else if (author) {
      // Fallback to resolving username
      try {
        const authorUser = await reddit.getUserByUsername(author);
        if (!authorUser?.id || !isT2(authorUser.id)) {
          console.error('[Migration] Failed to resolve author username', {
            postId,
            authorUsername: author,
          });
          await redis.zAdd(MIGRATION_FAILED_KEY, {
            member: postId,
            score: Date.now(),
          });
          return false;
        }
        authorId = authorUser.id;
        authorName = authorUser.username;
      } catch (error) {
        console.error('[Migration] Failed to resolve author username', {
          postId,
          authorUsername: author,
          error: error instanceof Error ? error.message : String(error),
        });
        await redis.zAdd(MIGRATION_FAILED_KEY, {
          member: postId,
          score: Date.now(),
        });
        return false;
      }
    } else {
      console.error('[Migration] Missing author information for post', {
        postId,
        hasV1AuthorId: !!v1AuthorId,
        hasAuthor: !!author,
      });
      await redis.zAdd(MIGRATION_FAILED_KEY, {
        member: postId,
        score: Date.now(),
      });
      return false;
    }

    // Parse date
    let createdAt: number;
    if (typeof date === 'string') {
      createdAt = parseInt(date, 10);
      if (isNaN(createdAt)) {
        // Try parsing as Date string
        const dateObj = new Date(date);
        createdAt = isNaN(dateObj.getTime()) ? Date.now() : dateObj.getTime();
      }
    } else if (typeof date === 'number') {
      createdAt = date;
    } else if (date instanceof Date) {
      createdAt = date.getTime();
    } else {
      // Fallback: try to get from post
      try {
        const post = await reddit.getPostById(postId);
        createdAt = post.createdAt.getTime();
      } catch (error) {
        // Post might be deleted, use current time as fallback
        console.warn(
          `[Migration] Could not fetch post ${postId} for date, using fallback:`,
          error
        );
        createdAt = Date.now();
      }
    }

    // Write v3 hash
    await redis.hSet(v3Key, {
      type: 'drawing',
      postId,
      createdAt: createdAt.toString(),
      word,
      normalizedWord,
      dictionary,
      drawing: JSON.stringify(drawingData),
      authorId,
      authorName,
    });

    // Set postData on the post (best-effort, non-blocking)
    try {
      const post = await reddit.getPostById(postId);
      await post.setPostData({
        type: 'drawing' as const,
        word,
        dictionary,
        drawing: drawingData,
        authorId,
        authorName,
      });
    } catch (error) {
      // Post might be deleted or inaccessible - log but continue migration
      // The Redis data is still migrated, which is the critical part
      console.warn(
        `[Migration] Failed to set postData for ${postId} (post may be deleted, migration continues):`,
        error
      );
    }

    // Update indices (only if not already present)
    const userDrawingsKey = REDIS_KEYS.userDrawings(authorId);
    const wordDrawingsKey = REDIS_KEYS.wordDrawings(word);
    const allDrawingsKey = REDIS_KEYS.allDrawings();

    const [userDrawingsExists, wordDrawingsExists, allDrawingsExists] =
      await Promise.all([
        redis.zScore(userDrawingsKey, postId),
        redis.zScore(wordDrawingsKey, postId),
        redis.zScore(allDrawingsKey, postId),
      ]);

    if (userDrawingsExists === null) {
      await redis.zAdd(userDrawingsKey, {
        member: postId,
        score: createdAt,
      });
    }

    if (wordDrawingsExists === null) {
      await redis.zAdd(wordDrawingsKey, {
        member: postId,
        score: createdAt,
      });
    }

    if (allDrawingsExists === null) {
      await redis.zAdd(allDrawingsKey, {
        member: postId,
        score: createdAt,
      });
    }

    // Add to user-art sorted set and create snapshot (for "My Drawings" page)
    const userArtKey = REDIS_KEYS.userArt(authorId);
    const compositeId = `d:${postId}`;
    const userArtExists = await redis.zScore(userArtKey, compositeId);
    if (userArtExists === null) {
      await Promise.all([
        redis.zAdd(userArtKey, {
          member: compositeId,
          score: createdAt,
        }),
        redis.hSet(REDIS_KEYS.userArtItem(authorId, compositeId), {
          type: 'drawing',
          postId,
          drawing: JSON.stringify(drawingData),
          createdAt: createdAt.toString(),
        }),
      ]);
    }

    // Create pinned comment (best-effort, non-blocking)
    try {
      await createDrawingPostComment(postId);
    } catch (error) {
      // Post might be deleted or comment creation might fail - log but continue
      // The Redis data migration is complete, which is the critical part
      console.warn(
        '[Migration] Failed to create pinned comment (non-critical)',
        {
          postId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }

    // Clean up old Redis keys (best-effort, non-blocking)
    try {
      await cleanupPostKeys(postId);
    } catch (error) {
      // Non-critical cleanup failure - log at debug level
      console.warn(
        '[Migration] Failed to cleanup old post keys (non-critical)',
        {
          postId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }

    return true;
  } catch (error) {
    console.error('[Migration] Migration failed for post', {
      postId,
      version: 'v1',
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    await redis.zAdd(MIGRATION_FAILED_KEY, {
      member: postId,
      score: Date.now(),
    });
    return false;
  } finally {
    await releaseLock(lockKey);
  }
}

/**
 * Migrate a drawing post from version 2 (hash at `post:${postId}`) to version 3 (hash at `drawing:${postId}`)
 *
 * Note: Version 2 detection includes both old v2 and old v3 formats (both use `post:${postId}` key, collapsed by version checker).
 * The new format uses `drawing:${postId}` and is detected as version 3.
 *
 * @param postId - The post ID to migrate
 * @returns `true` if migration was successful, `false` otherwise
 */
export async function migrateV2ToV3(postId: T3): Promise<boolean> {
  const v2Key = `post:${postId}`;
  const v3Key = REDIS_KEYS.drawing(postId);
  const lockKey = REDIS_KEYS.migrationLock(postId);

  // Acquire lock
  const lockAcquired = await acquireLock(lockKey, MIGRATION_LOCK_TTL_MS);
  if (!lockAcquired) {
    return false;
  }

  try {
    // Double-check: verify migration hasn't happened after acquiring lock
    const v3Exists = await redis.exists(v3Key);
    if (v3Exists) {
      return false; // Already migrated by another process
    }

    // Read v2 hash
    const v2Data = await redis.hGetAll(v2Key);
    if (!v2Data || Object.keys(v2Data).length === 0) {
      console.error('[Migration] V2 data not found for post', {
        postId,
        v2Key,
      });
      await redis.zAdd(MIGRATION_FAILED_KEY, {
        member: postId,
        score: Date.now(),
      });
      return false;
    }

    // Validate postType
    const postType = v2Data.postType;
    if (postType !== 'drawing') {
      console.error('[Migration] Post is not a drawing post', {
        postId,
        postType,
      });
      return false;
    }

    // Extract fields
    const authorUsername = v2Data.authorUsername;
    const dateStr = v2Data.date;
    const word = v2Data.word;
    const dictionaryName = v2Data.dictionaryName ?? 'main';
    const dataStr = v2Data.data;

    // Validate required fields
    if (!authorUsername || !dateStr || !word || !dataStr) {
      console.error('[Migration] Missing required fields for post', {
        postId,
        hasAuthorUsername: !!authorUsername,
        hasDateStr: !!dateStr,
        hasWord: !!word,
        hasDataStr: !!dataStr,
      });
      await redis.zAdd(MIGRATION_FAILED_KEY, {
        member: postId,
        score: Date.now(),
      });
      return false;
    }

    // Parse drawing data
    let oldDataArray: number[];
    try {
      oldDataArray = JSON.parse(dataStr) as number[];
    } catch (error) {
      console.error('[Migration] Failed to parse V2 data for post', {
        postId,
        error: error instanceof Error ? error.message : String(error),
      });
      await redis.zAdd(MIGRATION_FAILED_KEY, {
        member: postId,
        score: Date.now(),
      });
      return false;
    }

    if (!Array.isArray(oldDataArray)) {
      console.error('[Migration] Invalid data format for post', {
        postId,
        dataType: typeof oldDataArray,
        expected: 'array',
      });
      await redis.zAdd(MIGRATION_FAILED_KEY, {
        member: postId,
        score: Date.now(),
      });
      return false;
    }

    // Convert drawing data
    const drawingData = convertOldDrawingData(oldDataArray);
    const normalizedWord = normalizeWord(word);

    // Resolve author username to userId
    let authorId: T2;
    let authorName: string;
    try {
      const authorUser = await reddit.getUserByUsername(authorUsername);
      if (!authorUser?.id || !isT2(authorUser.id)) {
        console.error('[Migration] Failed to resolve author username', {
          postId,
          authorUsername,
        });
        await redis.zAdd(MIGRATION_FAILED_KEY, {
          member: postId,
          score: Date.now(),
        });
        return false;
      }
      authorId = authorUser.id;
      authorName = authorUser.username;
    } catch (error) {
      console.error('[Migration] Failed to resolve author username', {
        postId,
        authorUsername,
        error: error instanceof Error ? error.message : String(error),
      });
      await redis.zAdd(MIGRATION_FAILED_KEY, {
        member: postId,
        score: Date.now(),
      });
      return false;
    }

    // Parse date
    let createdAt = parseInt(dateStr, 10);
    if (isNaN(createdAt)) {
      // Fallback: try to get from post
      try {
        const post = await reddit.getPostById(postId);
        createdAt = post.createdAt.getTime();
      } catch (error) {
        // Post might be deleted, use current time as fallback
        console.warn(
          '[Migration] Could not fetch post for date, using fallback',
          {
            postId,
            error: error instanceof Error ? error.message : String(error),
          }
        );
        createdAt = Date.now();
      }
    }

    // Write v3 hash
    await redis.hSet(v3Key, {
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

    // Set postData on the post (best-effort, non-blocking)
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
      // Post might be deleted or inaccessible - log but continue migration
      // The Redis data is still migrated, which is the critical part
      console.warn(
        `[Migration] Failed to set postData for ${postId} (post may be deleted, migration continues):`,
        error
      );
    }

    // Update indices (only if not already present)
    const userDrawingsKey = REDIS_KEYS.userDrawings(authorId);
    const wordDrawingsKey = REDIS_KEYS.wordDrawings(word);
    const allDrawingsKey = REDIS_KEYS.allDrawings();

    const [userDrawingsExists, wordDrawingsExists, allDrawingsExists] =
      await Promise.all([
        redis.zScore(userDrawingsKey, postId),
        redis.zScore(wordDrawingsKey, postId),
        redis.zScore(allDrawingsKey, postId),
      ]);

    if (userDrawingsExists === null) {
      await redis.zAdd(userDrawingsKey, {
        member: postId,
        score: createdAt,
      });
    }

    if (wordDrawingsExists === null) {
      await redis.zAdd(wordDrawingsKey, {
        member: postId,
        score: createdAt,
      });
    }

    if (allDrawingsExists === null) {
      await redis.zAdd(allDrawingsKey, {
        member: postId,
        score: createdAt,
      });
    }

    // Add to user-art sorted set and create snapshot (for "My Drawings" page)
    const userArtKey = REDIS_KEYS.userArt(authorId);
    const compositeId = `d:${postId}`;
    const userArtExists = await redis.zScore(userArtKey, compositeId);
    if (userArtExists === null) {
      await Promise.all([
        redis.zAdd(userArtKey, {
          member: compositeId,
          score: createdAt,
        }),
        redis.hSet(REDIS_KEYS.userArtItem(authorId, compositeId), {
          type: 'drawing',
          postId,
          drawing: JSON.stringify(drawingData),
          createdAt: createdAt.toString(),
        }),
      ]);
    }

    // Create pinned comment (best-effort, non-blocking)
    try {
      await createDrawingPostComment(postId);
    } catch (error) {
      // Post might be deleted or comment creation might fail - log but continue
      // The Redis data migration is complete, which is the critical part
      console.warn(
        '[Migration] Failed to create pinned comment (non-critical)',
        {
          postId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }

    // Clean up old Redis keys (best-effort, non-blocking)
    try {
      await cleanupPostKeys(postId);
    } catch (error) {
      // Non-critical cleanup failure - log at debug level
      console.warn(
        '[Migration] Failed to cleanup old post keys (non-critical)',
        {
          postId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }

    return true;
  } catch (error) {
    console.error('[Migration] Migration failed for post', {
      postId,
      version: 'v2',
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    await redis.zAdd(MIGRATION_FAILED_KEY, {
      member: postId,
      score: Date.now(),
    });
    return false;
  } finally {
    await releaseLock(lockKey);
  }
}
