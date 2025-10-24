import type { Request, Response } from 'express';
import { getBannedWords } from '../services/dictionary';

/**
 * Menu action handler for showing a form to view and edit the banned words list
 */

export async function handleEditBannedWords(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const { words: bannedWords } = await getBannedWords();

    res.json({
      showForm: {
        name: 'editBannedWordsForm',
        form: {
          title: 'Edit banned words',
          description:
            'These words can not be added to the word list or appear in the guesses shown.',
          fields: [
            {
              type: 'paragraph',
              name: 'words',
              label: 'Banned words',
              lineHeight: 8,
              required: true,
              defaultValue: bannedWords.join(', '),
              placeholder: 'Apple, Banana, Meat Loaf, ...',
              helpText: 'Separate by commas. Case insensitive.',
            },
          ],
          acceptLabel: 'Save',
          cancelLabel: 'Cancel',
        },
      },
    });
  } catch (error) {
    console.error(`Error loading banned words: ${error}`);
    res.json({
      showToast: {
        text: 'Failed to load banned words',
        appearance: 'error',
      },
    });
  }
}
