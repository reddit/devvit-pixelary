import type { Request, Response } from 'express';
import { getMigrationStatus } from '@server/services/migration/status';

/**
 * Menu action handler for showing migration status
 * Displays current migration metrics via toast
 */

export async function handleShowMigrationStatus(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const status = await getMigrationStatus();

    const statusText = [
      status.enabled ? 'Enabled' : 'Disabled',
      `Processed: ${status.processed.toLocaleString()}`,
      `Migrated: ${status.migrated.toLocaleString()}`,
      `Failed: ${status.failed.toLocaleString()}`,
      status.isLocked ? 'Locked' : null,
    ]
      .filter((line) => line !== null)
      .join(' • ');

    res.json({
      showToast: statusText,
    });
  } catch (error) {
    console.error('Error getting migration status:', error);
    res.status(500).json({
      showToast: 'Failed to get migration status',
    });
  }
}
