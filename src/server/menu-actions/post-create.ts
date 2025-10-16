import type { Request, Response } from 'express';

/**
 * Menu action handler for creating new posts
 * Shows a form for selecting post type
 */
export async function handlePostCreate(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    // Return a form for selecting post type only
    res.json({
      showForm: {
        name: 'postTypeForm',
        form: {
          title: 'Create New Post',
          fields: [
            {
              type: 'select',
              name: 'postType',
              label: 'Post Type',
              options: [
                { label: 'Drawing Post', value: 'drawing' },
                { label: 'Pinned Post', value: 'pinned' },
              ],
              defaultValue: ['pinned'],
              required: true,
            },
          ],
          submitLabel: 'Next',
        },
      },
    });
  } catch (error) {
    console.error(`Error showing post creation form: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to show post creation form',
    });
  }
}
