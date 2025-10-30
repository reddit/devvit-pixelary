import type { Request, Response } from 'express';
import { updateWordsPreservingScores } from '../services/words/dictionary';
import { context } from '@devvit/web/server';

/**
 * Form handler for words replacement
 * Replaces the community dictionary with new words
 */

export async function handleWordsUpdate(
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
    const wordList = words.split(',').map((word: string) => word.trim());
    await updateWordsPreservingScores(wordList);

    res.json({
      showToast: 'Updated!',
    });
  } catch (error) {
    console.error(`Error updating dictionary: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to update',
    });
  }
}
