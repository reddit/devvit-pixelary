import { redis } from '@devvit/web/server';

/*
 * Constants - exported for use in menu actions
 */

export const ENABLED_KEY = 'migration:enabled';
export const BATCH_SIZE_KEY = 'migration:batch_size';
export const PROCESSED_COUNT_KEY = 'migration:processed_count';
export const SUCCESS_COUNT_KEY = 'migration:success_count';
export const FAILED_COUNT_KEY = 'migration:failed_count';
export const MIGRATED_COUNT_KEY = 'migration:migrated_count';
export const MIGRATION_FAILED_KEY = 'migration:failed';
export const MIGRATION_SKIPPED_KEY = 'migration:skipped';
export const BEFORE_ANCHOR_KEY = 'migration:before';
export const LOCK_KEY = 'migration:lock';

/**
 * Get migration status and metrics
 */
export async function getMigrationStatus(): Promise<{
  enabled: boolean;
  batchSize: number;
  processed: number;
  succeeded: number;
  failed: number;
  migrated: number;
  pendingFailed: number;
  skipped: number;
  beforeAnchor: string | null;
  isLocked: boolean;
}> {
  const [
    enabled,
    batchSize,
    processed,
    succeeded,
    failed,
    migrated,
    beforeAnchor,
    lockExists,
    failedCount,
    skippedCount,
  ] = await Promise.all([
    redis.get(ENABLED_KEY),
    redis.get(BATCH_SIZE_KEY),
    redis.get(PROCESSED_COUNT_KEY),
    redis.get(SUCCESS_COUNT_KEY),
    redis.get(FAILED_COUNT_KEY),
    redis.get(MIGRATED_COUNT_KEY),
    redis.get(BEFORE_ANCHOR_KEY),
    redis.exists(LOCK_KEY),
    redis.zCard(MIGRATION_FAILED_KEY),
    redis.zCard(MIGRATION_SKIPPED_KEY),
  ]);

  return {
    enabled: enabled === 'true', // Default to false if key doesn't exist
    batchSize: batchSize ? parseInt(batchSize, 10) : 100, // Default to 100 if key doesn't exist
    processed: parseInt(processed ?? '0', 10),
    succeeded: parseInt(succeeded ?? '0', 10),
    failed: parseInt(failed ?? '0', 10),
    migrated: parseInt(migrated ?? '0', 10),
    pendingFailed: failedCount,
    skipped: skippedCount,
    beforeAnchor: beforeAnchor ?? null,
    isLocked: lockExists > 0,
  };
}

/**
 * Set migration enabled status
 */
export async function setMigrationEnabled(enabled: boolean): Promise<void> {
  await redis.set(ENABLED_KEY, enabled ? 'true' : 'false');
}

/**
 * Set migration batch size
 */
export async function setMigrationBatchSize(batchSize: number): Promise<void> {
  // Clamp between 1 and 100 (Reddit API limit)
  const clampedSize = Math.max(1, Math.min(100, batchSize));
  await redis.set(BATCH_SIZE_KEY, clampedSize.toString());
}

/**
 * Get migration batch size
 */
export async function getMigrationBatchSize(): Promise<number> {
  const batchSize = await redis.get(BATCH_SIZE_KEY);
  return batchSize ? parseInt(batchSize, 10) : 100; // Default to 100 if key doesn't exist
}
