import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import { updateWordScores } from '../services/words/slate';

/**
 * Menu action handler for manually updating word scores
 * Triggers the word score calculation and update process
 */

export async function handleUpdateWordScores(
  _req: Request,
  res: Response
): Promise<void> {
  const startTime = Date.now();

  try {
    const subredditName = context.subredditName;

    if (!subredditName) {
      console.error(
        '[Menu Action] Update Word Scores - No subreddit name in context'
      );
      res.status(400).json({
        showToast: {
          text: 'Subreddit not found. Please try again.',
          appearance: 'neutral',
        },
      });
      return;
    }

    console.log('[Menu Action] Update Word Scores - Starting', {
      subredditName,
      timestamp: new Date().toISOString(),
    });

    await updateWordScores(subredditName);

    const duration = Date.now() - startTime;
    console.log('[Menu Action] Update Word Scores - Completed successfully', {
      subredditName,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });

    res.json({
      showToast: {
        text: `Word scores updated successfully (${duration}ms)`,
        appearance: 'success',
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to update word scores';

    console.error('[Menu Action] Update Word Scores - Error:', {
      error: errorMessage,
      durationMs: duration,
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const isLockError =
      errorMessage.includes('already in progress') ||
      errorMessage.includes('Lock acquisition failed');
    const isDataError =
      errorMessage.includes('Failed to fetch data') ||
      errorMessage.includes('Invalid config');

    let userMessage = 'Failed to update word scores';
    if (isLockError) {
      userMessage =
        'Update already in progress. Please wait a few minutes and try again.';
    } else if (isDataError) {
      userMessage = 'Data error occurred. Please check server logs.';
    }

    res.status(isLockError ? 409 : 500).json({
      showToast: {
        text: userMessage,
        appearance: 'neutral',
      },
    });
  }
}
