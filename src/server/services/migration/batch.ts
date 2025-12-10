import { redis, reddit, context } from '@devvit/web/server';
import { acquireLock, releaseLock } from '@server/core/redis';
import { migratePost } from './post';
import {
  ENABLED_KEY,
  BATCH_SIZE_KEY,
  PROCESSED_COUNT_KEY,
  SUCCESS_COUNT_KEY,
  FAILED_COUNT_KEY,
  BEFORE_ANCHOR_KEY,
  LOCK_KEY,
} from './status';

/*
 * Constants
 */

const DEFAULT_BATCH_SIZE = 100; // Reddit API limited to 100 / request
const LOCK_TTL_MS = 60 * 1000; // 1 minute

/*
 * Migrate a post batch
 */

export async function migratePostBatch(): Promise<void> {
  const start = Date.now();

  // Check if migration is enabled before acquiring lock
  // Default to disabled if key doesn't exist (null/undefined)
  const enabled = await redis.get(ENABLED_KEY);
  if (enabled !== 'true') {
    return;
  }

  // Acquire lock with extended TTL
  const lockAcquired = await acquireLock(LOCK_KEY, LOCK_TTL_MS);
  if (!lockAcquired) {
    // Another job is running, skip silently
    return;
  }

  const subredditName = context.subredditName || 'pixelary';
  let beforeAnchor: string | undefined;

  try {
    // Get batch size from Redis, default to 100
    const batchSizeStr = await redis.get(BATCH_SIZE_KEY);
    const batchSize = batchSizeStr
      ? parseInt(batchSizeStr, 10)
      : DEFAULT_BATCH_SIZE;
    const clampedBatchSize = Math.max(1, Math.min(100, batchSize)); // Clamp between 1 and 100

    beforeAnchor = await redis.get(BEFORE_ANCHOR_KEY);

    // Log batch start with metrics
    console.log('[Migration] Batch starting', {
      subredditName,
      batchSize: clampedBatchSize,
      beforeAnchor: beforeAnchor || 'none',
    });

    const posts = await reddit
      .getNewPosts({
        subredditName,
        pageSize: clampedBatchSize,
        ...(beforeAnchor && { before: beforeAnchor }),
      })
      .all();

    // Handle empty batch (all posts deleted/removed or end of list)
    if (posts.length === 0) {
      console.log('[Migration] Empty batch, migration complete', {
        subredditName,
        beforeAnchor: beforeAnchor || 'none',
      });
      await redis.set(ENABLED_KEY, 'false');
      // Lock will be released in finally block
      return;
    }

    // Check if migration was disabled mid-batch (race condition handling)
    const stillEnabled = await redis.get(ENABLED_KEY);
    if (stillEnabled !== 'true') {
      console.log('[Migration] Migration disabled mid-batch, stopping', {
        subredditName,
        postsProcessed: 0,
        postsTotal: posts.length,
      });
      // Lock will be released in finally block
      return;
    }

    // Process all migrations in parallel
    const results = await Promise.all(
      posts.map(async (post) => {
        try {
          const success = await migratePost(post);
          return { postId: post.id, success };
        } catch (error) {
          // Handle deleted posts or other errors gracefully
          console.error('[Migration] Error processing post', {
            postId: post.id,
            subredditName,
            error: error instanceof Error ? error.message : String(error),
          });
          return { postId: post.id, success: false };
        }
      })
    );

    // Track results
    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.length - successCount;

    const count = posts.length;
    const lastPost = posts[posts.length - 1];

    // Update counters atomically
    const promises: Promise<unknown>[] = [
      redis.incrBy(PROCESSED_COUNT_KEY, count),
      redis.incrBy(SUCCESS_COUNT_KEY, successCount),
      redis.incrBy(FAILED_COUNT_KEY, failedCount),
    ];

    // Update anchor if we have a valid last post
    // Only advance anchor if we got a full batch AND all posts succeeded
    // This ensures failed posts will be retried in the next batch
    if (lastPost) {
      if (count === clampedBatchSize && failedCount === 0) {
        // Full batch with all successes - continue migration
        promises.push(redis.set(BEFORE_ANCHOR_KEY, lastPost.id));
      } else if (count < clampedBatchSize) {
        // Partial batch - end migration (reached end of posts)
        promises.push(redis.set(ENABLED_KEY, 'false'));
      }
      // If full batch but some failed, don't update anchor - retry next time
    } else {
      // No valid last post - end migration
      promises.push(redis.set(ENABLED_KEY, 'false'));
    }

    await Promise.all(promises);

    const duration = Date.now() - start;
    console.log('[Migration] Batch completed', {
      subredditName,
      durationSeconds: duration / 1000,
      processed: count,
      succeeded: successCount,
      failed: failedCount,
      nextAnchor: count === clampedBatchSize && lastPost ? lastPost.id : null,
      migrationComplete: count < clampedBatchSize || !lastPost,
    });
  } catch (error) {
    // Log batch failure with full context
    console.error('[Migration] Batch failed', {
      subredditName,
      beforeAnchor: beforeAnchor || 'none',
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    // Don't throw - allow next batch to continue from same anchor
    // The anchor wasn't updated, so next run will retry this batch
  } finally {
    await releaseLock(LOCK_KEY);
  }
}
