import { Request, Response } from 'express';

/**
 * Form handler for post type selection
 * Returns form configuration based on selected post type
 */
export async function handlePostTypeSelect(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { postType } = req.body;

    if (!postType) {
      res.status(400).json({
        status: 'error',
        message: 'Post type is required',
      });
      return;
    }

    // Handle both string and array inputs from form fields
    const postTypeValue = Array.isArray(postType) ? postType[0] : postType;

    // Show post-specific form based on selected type
    let formName: string;
    let formTitle: string;
    let formFields: Array<{
      type: string;
      name: string;
      label: string;
      placeholder?: string;
      defaultValue?: string;
      required?: boolean;
      options?: Array<{ label: string; value: string }>;
      min?: number;
      max?: number;
    }> = [];

    switch (postTypeValue) {
      case 'pinned':
        formName = 'pinnedPostForm';
        formTitle = 'Create Pinned Post';
        formFields = [
          {
            type: 'string',
            name: 'title',
            label: 'Post Title',
            placeholder: 'Enter post title...',
            defaultValue: "Let's play Pixelary!",
            required: true,
          },
        ];
        break;
      case 'drawing':
        formName = 'drawingPostForm';
        formTitle = 'Create Drawing Post';
        formFields = [
          {
            type: 'string',
            name: 'title',
            label: 'Post Title',
            placeholder: 'Enter post title...',
            required: true,
          },
        ];
        break;
      default:
        res.status(400).json({
          status: 'error',
          message: 'Invalid post type',
        });
        return;
    }

    res.json({
      showForm: {
        name: formName,
        form: {
          title: formTitle,
          fields: formFields,
          submitLabel: 'Create Post',
        },
      },
    });
  } catch (error) {
    console.error(`Error showing post-specific form: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to show post-specific form',
    });
  }
}
