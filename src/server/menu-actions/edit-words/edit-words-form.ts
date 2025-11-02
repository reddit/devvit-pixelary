import type { Request, Response } from 'express';
import { getWords } from '@server/services/words/dictionary';
import { context } from '@devvit/web/server';

/**
 * Menu action handler for showing a form to view and edit the word list
 */

export async function showEditWordsForm(
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
          description: `This is the Pixelary community dictionary for ${context.subredditName}. It controls what players see when they draw.`,
          fields: [
            {
              type: 'paragraph',
              name: 'words',
              label: 'Words',
              lineHeight: 8,
              required: true,
              defaultValue: words.join(', '),
              placeholder: 'Apple, Banana, Meat Loaf, ...',
              helpText:
                'Separate by commas. Case insensitive. Max 12 characters.',
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
