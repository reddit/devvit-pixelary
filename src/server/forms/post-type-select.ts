import type { Request, Response } from 'express';
import { getRandomWords } from '../services/words/dictionary';

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
    let formDescription: string | undefined;
    let formFields: Array<{
      type: string;
      name: string;
      label: string;
      placeholder?: string;
      defaultValue?: string | string[];
      required?: boolean;
      options?: Array<{ label: string; value: string }>;
      min?: number;
      max?: number;
      helpText?: string;
      lineHeight?: number;
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
      case 'collection':
        formName = 'collectionPostForm';
        formTitle = 'Create collection post';
        formFields = [
          {
            type: 'paragraph',
            name: 'postTitle',
            label: 'Post title',
            lineHeight: 2,
            placeholder: 'Post title',
            defaultValue: 'Top drawings this week!',
            required: true,
          },
          {
            type: 'paragraph',
            name: 'label',
            label: 'Label',
            lineHeight: 2,
            placeholder: 'Shown above drawings',
            defaultValue: 'Top drawings\nthis week!',
            required: true,
            helpText: 'Max 2 lines. No word wrapping.',
          },
          {
            type: 'number',
            name: 'numberOfDays',
            label: 'Number of days',
            defaultValue: '7',
            min: 1,
            max: 365,
            required: true,
          },
          {
            type: 'select',
            name: 'numberOfDrawings',
            label: 'Number of drawings',
            defaultValue: ['6'],
            options: [
              { label: '3 drawings', value: '3' },
              { label: '6 drawings', value: '6' },
              { label: '9 drawings', value: '9' },
            ],
            required: true,
          },
        ];
        break;
      case 'tournament': {
        formName = 'tournamentPostForm';
        formTitle = 'Create drawing tournament';
        formDescription =
          'Start a community drawing tournament where players compete to draw the best drawing for a given word. You get to pick the word, or leave it blank for a random one.';

        // Generate a candidate word for the default value
        const candidateWords = await getRandomWords(1);
        const candidateWord = candidateWords[0] || 'Meatloaf';

        formFields = [
          {
            type: 'string',
            name: 'word',
            label: 'Word',
            placeholder: 'Using a random word',
            defaultValue: candidateWord,
            helpText: 'Case insensitive',
          },
        ];
        break;
      }
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
          ...(formDescription && { description: formDescription }),
          fields: formFields,
          acceptLabel: 'Create',
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
