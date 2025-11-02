import type { Request, Response } from 'express';
import { updateWordsPreservingScores } from '../../services/words/dictionary';

/**
 * Form handler for editing words
 * Replaces the community word list with new words from the text list
 */
export async function handleEditWords(
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

    // Parse and clean words from comma-separated text
    const wordList = words
      .split(',')
      .map((word: string) => word.trim())
      .filter(Boolean);
    await updateWordsPreservingScores(wordList);

    res.json({
      showToast: {
        text: 'Words updated successfully!',
        appearance: 'success',
      },
    });
  } catch (error) {
    console.error(`Error updating words: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to update words',
    });
  }
}
