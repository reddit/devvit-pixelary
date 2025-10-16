import { Request, Response } from 'express';
import { getBannedWords } from '../services/dictionary';
import { context } from '@devvit/web/server';

/**
 * Menu action handler for banned words management
 * Shows a form for editing banned words
 */
export async function handleBannedWords(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const bannedWords = await getBannedWords(context.subredditName);

    res.json({
      showForm: {
        name: 'bannedWordsForm',
        form: {
          title: 'Banned words',
          description:
            'Prevent certain words from being added to the dictionary.',
          fields: [
            {
              type: 'paragraph',
              name: 'words',
              label: 'Banned words',
              lineHeight: 8,
              required: true,
              defaultValue: bannedWords.join(', '),
              placeholder: 'Meatloaf, Meat loaf, ...',
              helpText: 'Separate by commas',
            },
          ],
          acceptLabel: 'Save',
          cancelLabel: 'Cancel',
        },
      },
    });
  } catch (error) {
    console.error(`Error loading banned words: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to load banned words',
    });
  }
}
