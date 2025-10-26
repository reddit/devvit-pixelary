import type { Request, Response } from 'express';

/**
 * Menu action handler for setting user points
 * Shows a form for entering username and points
 */

export async function handleSetUserPoints(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    res.json({
      showForm: {
        name: 'setUserPointsForm',
        form: {
          title: 'Set User Points',
          description: 'Set the exact number of points for a specific user',
          fields: [
            {
              type: 'string',
              name: 'username',
              label: 'Username',
              placeholder: 'Enter username (without u/)',
              required: true,
              helpText: 'Username without u/ prefix',
            },
            {
              type: 'number',
              name: 'points',
              label: 'Points',
              placeholder: '1000',
              required: true,
              helpText: 'The exact number of points to set',
            },
          ],
          acceptLabel: 'Set Points',
          cancelLabel: 'Cancel',
        },
      },
    });
  } catch (error) {
    console.error(`Error loading set user points form: ${error}`);
    res.json({
      showToast: {
        text: 'Failed to load form',
        appearance: 'error',
      },
    });
  }
}
