import type { Request, Response } from 'express';
import { updateWordScores } from '@server/services/words/slate';

/**
 * Job handler for updating word scores. Runs every hour.
 */

export async function handleUpdateWords(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    await updateWordScores();
    res.json({
      status: 'success',
      message: 'Word scores updated',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Word scores update job failed',
    });
  }
}
