import type { Request, Response } from 'express';
import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from '../services/redis';

/**
 * Menu action handler for flushing the slate event queue
 * Clears all events from the queue without processing them
 */
export async function handleSlateEventsClear(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    console.log('Starting slate queue flush...');

    // Get current queue size before flushing
    const eventKey = REDIS_KEYS.slateEvents();
    const queueSize = await redis.hLen(eventKey);

    console.log(`Current slate queue size: ${queueSize}`);

    if (queueSize === 0) {
      console.log('Slate queue is already empty');
      res.json({
        showToast: 'Slate event queue is already empty',
      });
      return;
    }

    // Delete all events from the queue
    await redis.del(eventKey);

    console.log(`Successfully flushed ${queueSize} events from slate queue`);

    res.json({
      showToast: `Successfully flushed ${queueSize} events from slate queue`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error flushing slate queue:`, error);

    res.status(500).json({
      showToast: `Failed to flush slate queue: ${errorMessage}`,
    });
  }
}
