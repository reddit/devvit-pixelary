import type { Request, Response } from 'express';
import { updateBannedWords } from '../services/dictionary';
import { context } from '@devvit/web/server';

/**
 * Form handler for banned words update
 * Updates the banned words list in Redis
 */

export async function handleBannedWordsUpdate(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { words } = req.body;

    if (!words) {
      res.status(400).json({
        status: 'error',
        message: 'Words are required',
      });
      return;
    }

    // Parse and clean words
    const wordList = words
      .split(',')
      .map((word: string) => word.trim())
      .filter((word: string) => word.length > 0)
      .map(
        (word: string) =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .sort();

    await updateBannedWords(context.subredditId, wordList);

    res.json({
      showToast: 'Updated!',
    });
  } catch (error) {
    console.error(`Error updating banned words: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to update',
    });
  }
}
