import type { Request, Response } from 'express';

/**
 * Menu action handler for getting user points
 * Shows a form for entering username
 */

export async function handleGetUserPoints(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    res.json({
      showForm: {
        name: 'getUserPointsForm',
        form: {
          title: 'Get User Points',
          description: "View a user's points",
          fields: [
            {
              type: 'string',
              name: 'username',
              label: 'Username',
              placeholder: 'Enter username (without u/)',
              required: true,
              helpText: 'Username without u/ prefix',
            },
          ],
          acceptLabel: 'Get Points',
          cancelLabel: 'Cancel',
        },
      },
    });
  } catch (error) {
    console.error(`Error loading get user points form: ${error}`);
    res.json({
      showToast: {
        text: 'Failed to load form',
        appearance: 'error',
      },
    });
  }
}
