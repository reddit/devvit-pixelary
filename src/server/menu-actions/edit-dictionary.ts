import { Request, Response } from 'express';
import { getDictionary } from '../services/dictionary';
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
    const dictionary = await getDictionary(context.subredditName);

    if (!dictionary) {
      res.status(404).json({
        status: 'error',
        message: 'No dictionary found',
      });
      return;
    }

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
              defaultValue: dictionary.words.join(', '),
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
    res.status(400).json({
      status: 'error',
      message: 'Failed to load dictionary',
    });
  }
}
