import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import { getUsername } from '@server/core/user';

/**
 * Menu action handler for getting user points
 * Shows a form for entering username
 */

export async function showGetUserPointsForm(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    // Get current username
    const { userId } = context;
    let defaultUsername = '';

    if (userId) {
      try {
        defaultUsername = await getUsername(userId);
      } catch (error) {
        console.error(`Error getting username: ${error}`);
      }
    }

    res.json({
      showForm: {
        name: 'getUserPointsForm',
        form: {
          title: 'User points',
          description: "View a user's points",
          fields: [
            {
              type: 'string',
              name: 'username',
              label: 'Username',
              placeholder: 'Enter a username',
              required: true,
              helpText: 'No u/ prefix',
              defaultValue: defaultUsername,
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
