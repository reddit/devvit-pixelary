import type { Request, Response } from 'express';
import {
  setMigrationEnabled,
  setMigrationBatchSize,
} from '@server/services/migration/status';

/**
 * Form handler for editing migration settings
 */

export async function handleEditMigration(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { enabled, batchSize } = req.body;

    if (enabled === undefined) {
      res.status(400).json({
        showToast: 'Enable migration status is required',
      });
      return;
    }

    if (batchSize === undefined) {
      res.status(400).json({
        showToast: 'Batch size is required',
      });
      return;
    }

    const isEnabled = Boolean(enabled);
    const batchSizeNum = Number(batchSize);

    if (isNaN(batchSizeNum) || batchSizeNum < 1 || batchSizeNum > 100) {
      res.status(400).json({
        showToast: 'Batch size must be between 1 and 100',
      });
      return;
    }

    await Promise.all([
      setMigrationEnabled(isEnabled),
      setMigrationBatchSize(batchSizeNum),
    ]);

    res.json({
      showToast: `Migration ${isEnabled ? 'enabled' : 'disabled'} with batch size ${batchSizeNum}`,
    });
  } catch (error) {
    console.error('Error updating migration settings:', error);
    res.status(500).json({
      showToast: 'Failed to update migration settings',
    });
  }
}
