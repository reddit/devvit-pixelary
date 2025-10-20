import type { Request, Response } from 'express';
import { scheduler } from '@devvit/web/server';
import { getEventQueueSize } from '../services/slate';

/**
 * Menu action handler for processing slate event queue immediately
 * Triggers the slate aggregator job to process events now
 */
export async function handleSlateEventsProcess(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    // Get current queue size
    const queueSize = await getEventQueueSize();
    if (queueSize === 0) {
      res.json({
        showToast: 'No slate events',
      });
      return;
    }

    // Trigger the scheduler job to process events
    try {
      const jobResult = await scheduler.runJob({
        name: 'SLATE_AGGREGATOR',
        data: {
          batchSize: 100,
          isInitialJob: true,
        },
        runAt: new Date(),
      });

      // Validate the job was actually scheduled
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

    res.json({
      showToast: `Processing ${queueSize} slate events`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error starting slate processing:', errorMessage);
    res.status(500).json({
      showToast: `Failed to start slate processing: ${errorMessage}`,
    });
  }
}
