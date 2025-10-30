import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from '../core/redis';
import type { PostType, TelemetryEventType } from '@shared/types';
import type { PostData } from '@shared/schema';

/**
 * Telemetry service for tracking UI events
 * Uses Redis hash per day with postType:eventType fields
 */

// Telemetry data retention period (30 days in seconds)
const TELEMETRY_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Generate a date key in YYYY-MM-DD format for telemetry
 * @param date - Optional date, defaults to today
 * @returns Date string in YYYY-MM-DD format
 */
export function getTelemetryDateKey(date?: Date): string {
  const targetDate = date ?? new Date();
  return targetDate.toISOString().split('T')[0]!;
}

export async function trackEvent(
  postType: PostType,
  eventType: TelemetryEventType,
  date?: Date,
  metadata?: Record<string, string | number>
): Promise<void> {
  const dateKey = getTelemetryDateKey(date);
  const key = REDIS_KEYS.telemetry(dateKey);
  const field = `${postType}:${eventType}`;

  try {
    const count = await redis.hIncrBy(key, field, 1);

    // Set TTL to 30 days only if this is a new field (count = 1)
    if (count === 1) {
      await redis.expire(key, TELEMETRY_TTL_SECONDS);
    }

    // Store metadata if provided
    if (metadata && Object.keys(metadata).length > 0) {
      const metadataKey = `${key}:meta:${field}`;
      // Convert all values to strings for Redis hash storage
      const stringifiedMetadata: Record<string, string> = {};
      for (const [key, value] of Object.entries(metadata)) {
        stringifiedMetadata[key] = String(value);
      }
      await redis.hSet(metadataKey, stringifiedMetadata);
      await redis.expire(metadataKey, TELEMETRY_TTL_SECONDS);
    }
  } catch (error) {
    // Silently fail - telemetry should never break the app
  }
}

/**
 * Track a telemetry event with automatic post type detection from context
 * Fire-and-forget operation that never blocks
 */
export async function trackEventFromContext(
  eventType: TelemetryEventType,
  postData: PostData | null,
  metadata?: Record<string, string | number>
): Promise<void> {
  // Default to 'pinned' if no postData (e.g., in pinned post context)
  // For collection posts, treat as 'pinned' for telemetry purposes
  const postType: PostType =
    postData?.type === 'drawing'
      ? 'drawing'
      : postData?.type === 'collection'
        ? 'pinned'
        : 'pinned';

  await trackEvent(postType, eventType, undefined, metadata);
}

/**
 * Get event stats for a specific date
 */
export async function getEventStats(
  date: string,
  postType?: PostType
): Promise<Record<string, number>> {
  const key = REDIS_KEYS.telemetry(date);

  try {
    const hash = await redis.hGetAll(key);
    const result: Record<string, number> = {};

    for (const [field, value] of Object.entries(hash)) {
      const [fieldPostType] = field.split(':');

      // Filter by postType if specified
      if (postType && fieldPostType !== postType) {
        continue;
      }

      result[field] = parseInt(value as string, 10);
    }

    return result;
  } catch (error) {
    return {};
  }
}

/**
 * Clear telemetry data for a specific date
 * Returns the number of records that were deleted
 */
export async function clearTelemetryData(date?: string): Promise<number> {
  const targetDate = date ?? getTelemetryDateKey();
  const key = REDIS_KEYS.telemetry(targetDate);

  try {
    // Get count before deletion for logging
    const hash = await redis.hGetAll(key);
    const recordCount = Object.keys(hash).length;

    // Delete the entire hash
    await redis.del(key);

    return recordCount;
  } catch (error) {
    return 0;
  }
}
