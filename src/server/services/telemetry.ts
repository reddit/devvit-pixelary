import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from './redis';

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

/**
 * Generate date keys for a range of dates
 * Useful for analysis and bulk operations
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @returns Array of date keys in YYYY-MM-DD format
 */
export function getTelemetryDateKeys(startDate: Date, endDate: Date): string[] {
  const keys: string[] = [];

  for (
    let date = new Date(startDate);
    date <= endDate;
    date.setDate(date.getDate() + 1)
  ) {
    keys.push(getTelemetryDateKey(date));
  }

  return keys;
}

export type PostType = 'drawing' | 'pinned';
export type EventType =
  // ============================================================================
  // GENERIC TELEMETRY EVENTS (UI tracking only, no word metrics impact)
  // ============================================================================
  // View events
  | 'view_menu'
  | 'view_my_drawings'
  | 'view_leaderboard'
  | 'view_how_to_play'
  | 'view_level_details'
  | 'view_drawing_post'
  | 'view_guess'
  | 'view_results'
  | 'view_editor'
  | 'view_word_step'
  | 'view_draw_step'
  | 'view_review_step'
  // Click events
  | 'click_draw'
  | 'click_my_drawings'
  | 'click_leaderboard'
  | 'click_how_to_play'
  | 'click_level_details'
  | 'click_close_my_drawings'
  | 'click_drawing_tile'
  | 'click_start_drawing'
  | 'click_close_leaderboard'
  | 'click_close_how_to_play'
  | 'click_close_level_details'
  | 'click_level_prev'
  | 'click_level_next'
  | 'click_guess_submit'
  | 'click_give_up'
  | 'click_draw_something'
  | 'click_close_results'
  | 'click_word_candidate'
  | 'click_refresh_words'
  | 'click_done_drawing'
  | 'click_color_swatch'
  | 'click_post_drawing'
  | 'click_cancel_drawing'
  // Drawing events
  | 'drawing_start'
  | 'drawing_first_pixel'
  | 'drawing_end_manual'
  | 'drawing_end_auto' // Ran out of time
  | 'drawing_publish' // Drawing is posted
  | 'drawing_cancel'
  // Post events (specific taxonomy)
  | 'post_impression' // Post viewed (affects social metrics)
  | 'post_guess' // User submitted guess
  | 'post_solve' // User solved the drawing
  | 'post_skip'; // User gave up/skipped

/**
 * Track a telemetry event with optional metadata
 * Fire-and-forget operation that never blocks
 */
export async function trackEvent(
  postType: PostType,
  eventType: EventType,
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
    console.warn('Telemetry tracking failed:', error);
  }
}

/**
 * Track a telemetry event with automatic post type detection from context
 * Fire-and-forget operation that never blocks
 */
export async function trackEventFromContext(
  eventType: EventType,
  postData: { type: 'drawing' | 'pinned' } | null,
  metadata?: Record<string, string | number>
): Promise<void> {
  // Default to 'pinned' if no postData (e.g., in pinned post context)
  const postType: PostType =
    postData?.type === 'drawing' ? 'drawing' : 'pinned';

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
    console.warn('Failed to get telemetry stats:', error);
    return {};
  }
}

/**
 * Get event stats for today
 */
export async function getTodayEventStats(
  postType?: PostType
): Promise<Record<string, number>> {
  const today = getTelemetryDateKey();
  return getEventStats(today, postType);
}

/**
 * Get event stats for a date range
 */
export async function getEventStatsRange(
  startDate: string,
  endDate: string,
  postType?: PostType
): Promise<Record<string, Record<string, number>>> {
  const result: Record<string, Record<string, number>> = {};

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (
      let date = new Date(start);
      date <= end;
      date.setDate(date.getDate() + 1)
    ) {
      const dateStr = getTelemetryDateKey(date);
      result[dateStr] = await getEventStats(dateStr, postType);
    }

    return result;
  } catch (error) {
    console.warn('Failed to get telemetry stats range:', error);
    return {};
  }
}

/**
 * Calculate CTR (Click Through Rate) for a specific event
 * CTR = clicks / views
 */
export async function calculateCTR(
  date: string,
  postType: PostType,
  viewEvent: EventType,
  clickEvent: EventType
): Promise<number> {
  try {
    const stats = await getEventStats(date, postType);
    const viewKey = `${postType}:${viewEvent}`;
    const clickKey = `${postType}:${clickEvent}`;

    const views = stats[viewKey] || 0;
    const clicks = stats[clickKey] || 0;

    return views > 0 ? clicks / views : 0;
  } catch (error) {
    console.warn('Failed to calculate CTR:', error);
    return 0;
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
    console.warn('Failed to clear telemetry data:', error);
    return 0;
  }
}
