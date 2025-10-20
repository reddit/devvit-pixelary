import type { Request, Response } from 'express';
import { getEventQueueSize } from '../services/slate';

/**
 * Menu action handler for showing slate event queue size
 * Shows the current number of events in the queue
 */
export async function handleSlateQueueSize(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const queueSize = await getEventQueueSize();

    res.json({
      showToast: `Slate event queue has ${queueSize} events`,
    });
  } catch (error) {
    console.error(`Error getting slate queue size: ${error}`);
    res.status(500).json({
      showToast: 'Failed to get queue size',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
