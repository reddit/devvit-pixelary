import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import { updateWordScores } from '@server/services/words/slate';

/**
 * Job handler for updating word scores. Runs every hour.
 */

export async function handleUpdateWords(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Try to get subredditName from request body (for scheduled jobs with data)
    // or fall back to context
    const jobData = req.body.data ?? req.body;
    const subredditName =
      jobData.subredditName ?? context.subredditName ?? undefined;

    if (!subredditName) {
      res.status(400).json({
        status: 'error',
        message: 'subredditName is required',
      });
      return;
    }

    await updateWordScores(subredditName);
    res.json({
      status: 'success',
      message: 'Word scores updated',
    });
  } catch (error) {
    console.error('Error updating word scores:', error);
    res.status(500).json({
      status: 'error',
      message: 'Word scores update job failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
