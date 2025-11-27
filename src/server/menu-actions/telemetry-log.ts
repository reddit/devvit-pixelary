import type { Request, Response } from 'express';
import { getTelemetryDateKey } from '../services/telemetry';
import { REDIS_KEYS } from '../core/redis';
import { redis } from '@devvit/web/server';

/**
 * Menu action handler for logging telemetry data
 * Logs the Redis key contents for today's telemetry data
 */

export async function handleTelemetryLog(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const today = getTelemetryDateKey();
    const telemetryKey = REDIS_KEYS.telemetry(today);
    const telemetryData = await redis.hGetAll(telemetryKey);
    console.log(`Telemetry data for ${today}:`, telemetryData);
    res.json({ showToast: 'Done. See server logs' });
  } catch (error) {
    console.error('Error logging telemetry:', error);
    res.status(400).json({
      showToast: 'Failed to log telemetry',
    });
  }
}
