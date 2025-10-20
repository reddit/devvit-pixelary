import type { Request, Response } from 'express';
import { scheduler } from '@devvit/web/server';
import { processSlateEvents, getEventQueueSize } from '../services/slate';

/**
 * Menu action handler for processing slate event queue immediately
 * Triggers the slate aggregator job to process events now
 */
export async function handleProcessSlateQueue(
  _req: Request,
  res: Response
): Promise<void> {
  const startTime = Date.now();

  try {
    console.log('Starting manual slate queue processing...');

    // Get current queue size
    const queueSize = await getEventQueueSize();
    console.log(`Current slate queue size: ${queueSize}`);

    if (queueSize === 0) {
      console.log('Slate queue is empty, nothing to process');
      res.json({
        showToast: 'Slate event queue is empty - nothing to process',
      });
      return;
    }

    // First, try to process events directly to see if there are any immediate issues
    console.log('Attempting direct processing first...');
    const directResult = await processSlateEvents(10); // Process a small batch first
    console.log(`Direct processing result:`, directResult);

    if (directResult.processed === 0 && queueSize > 0) {
      console.error(
        'Direct processing failed - no events were processed despite queue having events'
      );
      res.status(500).json({
        showToast: `Failed to process events directly. Queue size: ${queueSize}, Processed: ${directResult.processed}`,
      });
      return;
    }

    // If direct processing worked, trigger the scheduler job for remaining events
    console.log('Triggering scheduler job for remaining events...');

    try {
      const jobResult = await scheduler.runJob({
        name: 'SLATE_AGGREGATOR',
        data: {
          batchSize: 100,
          isInitialJob: true,
        },
      });

      console.log('Scheduler job triggered successfully:', jobResult);

      // Validate the job was actually scheduled
      // The scheduler.runJob returns a job ID string, not an object
      if (!jobResult || typeof jobResult !== 'string') {
        console.error('Scheduler job returned invalid result:', jobResult);
        res.status(500).json({
          showToast: 'Scheduler job failed to start properly',
        });
        return;
      }
    } catch (schedulerError) {
      console.error('Failed to trigger scheduler job:', schedulerError);
      res.status(500).json({
        showToast: `Scheduler job failed: ${schedulerError instanceof Error ? schedulerError.message : String(schedulerError)}`,
      });
      return;
    }

    const duration = Date.now() - startTime;
    res.json({
      showToast: `Started processing ${queueSize} events. Direct processed: ${directResult.processed}, Duration: ${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(`Error processing slate queue after ${duration}ms:`, {
      error: errorMessage,
      stack: errorStack,
      queueSize: await getEventQueueSize().catch(() => 'unknown'),
    });

    res.status(500).json({
      showToast: `Failed to process slate queue: ${errorMessage}`,
    });
  }
}
