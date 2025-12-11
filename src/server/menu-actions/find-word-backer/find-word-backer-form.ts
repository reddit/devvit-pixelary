import type { Request, Response } from 'express';

/**
 * Menu action handler for finding word backer
 * Shows a form for entering a word
 */

export async function showFindWordBackerForm(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    res.json({
      showForm: {
        name: 'findWordBackerForm',
        form: {
          title: 'Find word backer',
          description:
            'Enter a word to find and navigate to its backer comment (if it exists)',
          fields: [
            {
              type: 'string',
              name: 'word',
              label: 'Word',
              placeholder: 'Meatloaf',
              required: true,
              helpText: 'Case insensitive',
            },
          ],
          acceptLabel: 'Find',
          cancelLabel: 'Cancel',
        },
      },
    });
  } catch (error) {
    console.error('Error loading find word backer form:', error);
    res.json({
      showToast: 'Failed to load form',
    });
  }
}
