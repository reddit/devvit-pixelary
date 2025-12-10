import type { Request, Response } from 'express';
import { migratePostBatch } from '@server/services/migration/batch';

/**
 * Scheduler handler for running migration batches
 * Runs every 30 seconds to process migration batches
 */

export async function handleMigrationBatch(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    await migratePostBatch();
    res.json({
      status: 'success',
      message: 'Migration batch completed',
    });
  } catch (error) {
    console.error('[Migration] Scheduler batch failed', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      status: 'error',
      message: 'Migration batch job failed',
    });
  }
}
