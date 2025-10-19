import type { Request, Response } from 'express';
import { getTelemetryDateKey } from '../services/telemetry';
import { REDIS_KEYS } from '../services/redis';
import { redis } from '@devvit/web/server';

/**
 * Menu action handler for logging telemetry key
 * Logs the Redis key contents for today's telemetry data
 */
export async function handleLogTelemetryKey(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const today = getTelemetryDateKey();
    const telemetryKey = REDIS_KEYS.telemetry(today);

    // Get the actual telemetry data from Redis
    const telemetryData = await redis.hGetAll(telemetryKey);

    console.log(
      `[Telemetry] Data for ${today}: ${JSON.stringify(telemetryData, null, 2)}`
    );

    res.json({ showToast: 'Check logs' });
  } catch (error) {
    console.error(`Error logging telemetry key: ${error}`);
    res.status(400).json({
      showToast: 'Failed to log telemetry key',
    });
  }
}
