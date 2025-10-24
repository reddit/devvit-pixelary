import type { Request, Response } from 'express';
import { getTelemetryDateKey, clearTelemetryData } from '../services/telemetry';

/**
 * Menu action handler for clearing telemetry data
 * Deletes the Redis hash containing today's telemetry data
 */

export async function handleTelemetryClear(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const today = getTelemetryDateKey();
    await clearTelemetryData(today);
    res.json({
      showToast: 'Cleared',
    });
  } catch (error) {
    console.error(`Error clearing telemetry: ${error}`);
    res.status(400).json({
      showToast: 'Failed to clear telemetry',
    });
  }
}
