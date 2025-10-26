import type { Request, Response } from 'express';

/**
 * Menu action handler for creating new posts
 * Shows a form for selecting post type
 */
export async function handleCreatePost(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    // Return a form for selecting post type only
    res.json({
      showForm: {
        name: 'postTypeForm',
        form: {
          title: 'Create Pixelary post',
          description: 'Select a post type to continue.',
          fields: [
            {
              type: 'select',
              name: 'postType',
              label: 'Post type',
              options: [
                { label: 'Pinned post', value: 'pinned' },
                { label: 'Collection post', value: 'collection' },
                { label: 'Drawing post', value: 'drawing' },
              ],
              defaultValue: ['pinned'],
              required: true,
            },
          ],
          acceptLabel: 'Continue',
        },
      },
    });
  } catch (error) {
    console.error(`Error showing post creation form: ${error}`);
    res.json({
      showToast: {
        text: 'Failed to show post creation form',
        appearance: 'error',
      },
    });
  }
}
