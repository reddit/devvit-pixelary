import type { Request, Response } from 'express';
import { getLegacyUsersCount } from '@server/services/legacy';

/**
 * Menu action handler to manage legacy users set
 */

export async function showEditLegacyUsersForm(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const count = await getLegacyUsersCount();

    res.json({
      showForm: {
        name: 'editLegacyUsersForm',
        form: {
          title: 'Edit legacy users',
          description: `Add or remove usernames from the legacy users set. There are ${count} legacy users in the set.`,
          fields: [
            {
              type: 'select',
              name: 'action',
              label: 'Action',
              options: [
                { label: 'Add users', value: 'add' },
                { label: 'Remove users', value: 'remove' },
              ],
              defaultValue: ['add'],
              required: true,
            },
            {
              type: 'paragraph',
              name: 'usernames',
              label: 'Usernames',
              lineHeight: 8,
              required: false,
              defaultValue: '',
              placeholder: 'username1, username2, username3',
              helpText: 'Comma separated. Case insensitive.',
            },
          ],
          acceptLabel: 'Submit',
          cancelLabel: 'Cancel',
        },
      },
    });
  } catch (error) {
    console.error('Error loading legacy users form:', error);
    res.json({
      showToast: {
        text: 'Failed to load legacy users form',
        appearance: 'error',
      },
    });
  }
}
