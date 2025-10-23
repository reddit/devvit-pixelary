import type { Request, Response } from 'express';
import { getAllWords } from '../services/dictionary';
import { context } from '@devvit/web/server';

/**
 * Menu action handler for editing dictionary
 * Shows a form for editing the community dictionary
 */
export async function handleEditDictionary(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    console.log('Edit dictionary menu action called');
    console.log('Context subreddit name:', context.subredditName);

    const words = await getAllWords();
    console.log('Retrieved words:', words);

    res.json({
      showForm: {
        name: 'editDictionaryForm',
        form: {
          title: 'Community dictionary',
          description:
            'The list of drawing prompts available to Pixelary players',
          fields: [
            {
              type: 'paragraph',
              name: 'words',
              label: 'Drawing prompts',
              lineHeight: 8,
              required: true,
              defaultValue: words.join(', '),
              placeholder: 'Apple, Banana, Cherry, ...',
              helpText: 'Separate by commas',
            },
          ],
          acceptLabel: 'Save',
          cancelLabel: 'Cancel',
        },
      },
    });
  } catch (error) {
    console.error(`Error loading dictionary: ${error}`);
    res.json({
      showToast: {
        text: 'Failed to load dictionary',
        appearance: 'error',
      },
    });
  }
}
