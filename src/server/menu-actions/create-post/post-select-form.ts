import type { Request, Response } from 'express';

/**
 * Menu action handler for creating a Pixelary post
 * Shows a form for selecting post type
 */

export async function showPostSelectForm(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    res.json({
      showForm: {
        name: 'createPostForm',
        form: {
          title: 'Pixelary post types',
          description: 'Select a post type to continue.',
          fields: [
            {
              type: 'select',
              name: 'postType',
              label: 'Post type',
              options: [
                { label: 'Pinned Post', value: 'pinned' },
                { label: 'Collection Post', value: 'collection' },
                { label: 'Tournament Post', value: 'tournament' },
              ],
              defaultValue: ['tournament'],
              required: true,
            },
          ],
          acceptLabel: 'Continue',
        },
      },
    });
  } catch (error) {
    console.error('Error showing post creation form:', error);
    res.json({
      showToast: {
        text: 'Failed to show post creation form',
        appearance: 'error',
      },
    });
  }
}
