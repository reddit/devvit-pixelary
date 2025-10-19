import type { Request, Response } from 'express';
import { getTelemetryDateKey, clearTelemetryData } from '../services/telemetry';

/**
 * Menu action handler for clearing daily telemetry data
 * Deletes the Redis hash containing today's telemetry data
 */
export async function handleClearDailyTelemetry(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const today = getTelemetryDateKey();
    const recordCount = await clearTelemetryData(today);

    console.log(`[Telemetry] Cleared ${recordCount} records for ${today}`);

    res.json({
      showToast: `${today} cleared`,
    });
  } catch (error) {
    console.error(`Error clearing daily telemetry: ${error}`);
    res.status(400).json({
      showToast: 'Failed to clear daily telemetry',
    });
  }
}
