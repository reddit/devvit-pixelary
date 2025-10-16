import { Request, Response } from 'express';
import { updateDictionary } from '../services/dictionary';
import { context } from '@devvit/web/server';

/**
 * Form handler for dictionary update
 * Updates the community dictionary with new words
 */
export async function handleDictionarySubmit(
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

    await updateDictionary(context.subredditName, wordList);

    res.json({
      showToast: 'Dictionary updated successfully!',
    });
  } catch (error) {
    console.error(`Error updating dictionary: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to update dictionary',
    });
  }
}
