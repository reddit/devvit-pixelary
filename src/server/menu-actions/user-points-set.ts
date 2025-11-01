import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import { getScore } from '../services/progression';
import { getUsername } from '../core/user';
import type { T2 } from '@devvit/shared-types/tid.js';

/**
 * Menu action handler for setting user points
 * Shows a form for entering username and points
 */

export async function handleSetUserPoints(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    // Get current user info
    const { userId } = context;
    let defaultUsername = '';
    let defaultPoints = 0;

    if (userId) {
      try {
        [defaultUsername, defaultPoints] = await Promise.all([
          getUsername(userId as T2),
          getScore(userId as T2),
        ]);
      } catch (error) {
        console.error(`Error getting user info: ${error}`);
      }
    }

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
              defaultValue: defaultUsername,
            },
            {
              type: 'number',
              name: 'points',
              label: 'Points',
              placeholder: '1000',
              required: true,
              helpText: 'The exact number of points to set',
              defaultValue: defaultPoints,
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
