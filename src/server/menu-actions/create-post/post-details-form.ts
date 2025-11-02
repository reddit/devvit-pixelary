import type { Request, Response } from 'express';
import { getRandomWords } from '@server/services/words/dictionary';
import {
  DEFAULT_COLLECTION_POST_LABEL,
  DEFAULT_COLLECTION_POST_NUMBER_OF_DAYS,
  DEFAULT_COLLECTION_POST_NUMBER_OF_DRAWINGS,
  DEFAULT_COLLECTION_POST_TITLE,
  DEFAULT_PINNED_POST_TITLE,
  TOURNAMENT_FALLBACK_WORD,
} from '@shared/constants';

/**
 * Form handler for post type selection
 * Returns form configuration based on selected post type
 */

export async function showPostDetailsForm(
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
        formTitle = 'Pinned post';
        formFields = [
          {
            type: 'string',
            name: 'title',
            label: 'Post title',
            placeholder: 'Enter post title...',
            defaultValue: DEFAULT_PINNED_POST_TITLE,
            required: true,
          },
        ];
        break;
      case 'collection':
        formName = 'collectionPostForm';
        formTitle = 'Collection post';
        formFields = [
          {
            type: 'paragraph',
            name: 'postTitle',
            label: 'Post title',
            lineHeight: 2,
            placeholder: 'Post title',
            defaultValue: DEFAULT_COLLECTION_POST_TITLE,
            required: true,
          },
          {
            type: 'paragraph',
            name: 'label',
            label: 'Label',
            lineHeight: 2,
            placeholder: 'Shown above drawings',
            defaultValue: DEFAULT_COLLECTION_POST_LABEL,
            required: true,
            helpText: 'Max 2 lines. No word wrapping.',
          },
          {
            type: 'number',
            name: 'numberOfDays',
            label: 'Number of days',
            defaultValue: DEFAULT_COLLECTION_POST_NUMBER_OF_DAYS.toString(),
            min: 1,
            max: 365,
            required: true,
          },
          {
            type: 'select',
            name: 'numberOfDrawings',
            label: 'Number of drawings',
            defaultValue: [
              DEFAULT_COLLECTION_POST_NUMBER_OF_DRAWINGS.toString(),
            ],
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
        formTitle = 'Drawing tournament';
        formDescription =
          'Players compete to make the best drawing for a given word. You get to pick the word, or leave it blank for a random one.';

        const candidateWords = await getRandomWords(1);
        const word = candidateWords[0] || TOURNAMENT_FALLBACK_WORD;

        formFields = [
          {
            type: 'string',
            name: 'word',
            label: 'Word',
            placeholder: 'Using a random word',
            defaultValue: word,
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
