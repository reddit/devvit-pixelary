import type { Request, Response } from 'express';
import { redis } from '@devvit/web/server';
import { ENABLED_KEY, BATCH_SIZE_KEY } from '@server/services/migration/status';

/**
 * Menu action handler for editing migration settings
 * Shows a form for enabling/disabling and setting batch size
 */

export async function showEditMigrationForm(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const [enabled, batchSize] = await Promise.all([
      redis.get(ENABLED_KEY),
      redis.get(BATCH_SIZE_KEY),
    ]);
    const isEnabled = enabled === 'true'; // Default to false if key doesn't exist
    const currentBatchSize = batchSize ? parseInt(batchSize, 10) : 100; // Default to 100 if key doesn't exist

    res.json({
      showForm: {
        name: 'editMigrationForm',
        form: {
          title: 'Edit Migration',
          description: 'Configure migration settings',
          fields: [
            {
              type: 'boolean',
              name: 'enabled',
              label: 'Enable migration',
              defaultValue: isEnabled,
              required: true,
            },
            {
              type: 'number',
              name: 'batchSize',
              label: 'Batch size',
              helpText: 'Posts processed per batch (1-100)',
              defaultValue: currentBatchSize,
              required: true,
            },
          ],
          acceptLabel: 'Save',
          cancelLabel: 'Cancel',
        },
      },
    });
  } catch (error) {
    console.error('Error loading migration edit form:', error);
    res.json({
      showToast: {
        text: 'Failed to load form',
        appearance: 'error',
      },
    });
  }
}
