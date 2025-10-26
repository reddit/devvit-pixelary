import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import { getUsername } from '../services/redis';
import type { T2 } from '@devvit/shared-types/tid.js';

/**
 * Menu action handler for getting user points
 * Shows a form for entering username
 */

export async function handleGetUserPoints(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    // Get current username
    const { userId } = context;
    let defaultUsername = '';

    if (userId) {
      try {
        defaultUsername = await getUsername(userId as T2);
      } catch (error) {
        console.error(`Error getting username: ${error}`);
      }
    }

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
