import type { Request, Response } from 'express';
import { getWords } from '../services/dictionary';

/**
 * Menu action handler for showing a form to view and edit the word list
 */

export async function handleEditWords(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const { words } = await getWords();
    res.json({
      showForm: {
        name: 'editWordsForm',
        form: {
          title: 'Edit word list',
          description:
            'The list of words available for Pixelary players to draw',
          fields: [
            {
              type: 'paragraph',
              name: 'words',
              label: 'Words',
              lineHeight: 8,
              required: true,
              defaultValue: words.join(', '),
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
    console.error(`Error loading words: ${error}`);
    res.json({
      showToast: {
        text: 'Failed to load words',
        appearance: 'error',
      },
    });
  }
}
