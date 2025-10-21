import type { Request, Response } from 'express';
import { scheduler } from '@devvit/web/server';
import { processSlateEvents, getEventQueueSize } from '../services/slate';

/**
 * Job handler for slate event aggregation
 * Processes events in batches and schedules recursive calls until queue is empty
 */
export async function handleSlateAggregator(
  req: Request,
  res: Response
): Promise<void> {
  const jobStartTime = Date.now();
  const jobId = `slate-aggregator-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Extract parameters from request body
    const jobData = req.body.data || req.body;
    const batchSize = jobData.batchSize || 100;
    const isInitialJob = jobData.isInitialJob !== false; // Default to true for first run

    // Get initial queue size for logging
    const initialQueueSize = await getEventQueueSize();

    if (initialQueueSize === 0) {
      res.json({
        status: 'success',
        processed: 0,
        hasMore: false,
        duration: Date.now() - jobStartTime,
        message: 'Queue was empty',
      });
      return;
    }

    console.log(`🔄 Slate Aggregator: Processing ${initialQueueSize} events`, {
      jobId,
      batchSize,
      isInitialJob,
    });
    const result = await processSlateEvents(batchSize);

    const jobDuration = Date.now() - jobStartTime;
    const remainingQueueSize = await getEventQueueSize();
    console.log(
      `✅ Slate Aggregator: Processed ${result.processed}, Remaining: ${remainingQueueSize}`
    );

    if (result.processed === 0 && initialQueueSize > 0) {
      console.error(
        `❌ Slate Aggregator: No events processed despite ${initialQueueSize} in queue`
      );
      res.status(500).json({
        status: 'error',
        message: 'No events were processed despite queue having events',
        processed: result.processed,
        hasMore: result.hasMore,
        duration: jobDuration,
        initialQueueSize,
        remainingQueueSize,
      });
      return;
    }

    // If there are more events and we haven't exceeded time limit, schedule next batch
    if (result.hasMore && jobDuration < 50000) {
      // Leave 10s buffer before 60s timeout
      try {
        await scheduler.runJob({
          name: 'SLATE_AGGREGATOR',
          data: {
            batchSize,
            isInitialJob: false,
          },
        });
      } catch (error) {
        console.error(`Failed to schedule next batch:`, error);
        res.status(500).json({
          status: 'error',
          message: 'Failed to schedule next batch',
          processed: result.processed,
          hasMore: result.hasMore,
          duration: jobDuration,
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    } else if (!result.hasMore) {
      console.log(`[${jobId}] Slate event queue processing complete!`);
    } else {
      console.log(
        `[${jobId}] Job timeout approaching, stopping recursive scheduling`
      );
    }

    res.json({
      status: 'success',
      processed: result.processed,
      hasMore: result.hasMore,
      duration: jobDuration,
      initialQueueSize,
      remainingQueueSize,
      message: result.hasMore ? 'More events remain' : 'All events processed',
    });
  } catch (error) {
    const jobDuration = Date.now() - jobStartTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(
      `[${jobId}] Slate aggregator job failed after ${jobDuration}ms:`,
      {
        error: errorMessage,
        stack: errorStack,
        requestBody: req.body,
      }
    );

    res.status(500).json({
      status: 'error',
      message: 'Job failed',
      duration: jobDuration,
      error: errorMessage,
      jobId,
    });
  }
}
