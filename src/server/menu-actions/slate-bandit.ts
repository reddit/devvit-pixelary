import type { Request, Response } from 'express';
import { getSlateBanditConfig } from '../services/slate';

/**
 * Menu action handler for slate bandit configuration
 * Shows a form for editing the slate bandit parameters
 */

export async function handleSlateBandit(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const config = await getSlateBanditConfig();

    res.json({
      showForm: {
        name: 'slateBanditForm',
        form: {
          title: 'Configure slate bandit',
          description:
            'Configure the non-personalized slate bandit optimizing the word selection',
          fields: [
            {
              type: 'number',
              name: 'explorationRate',
              label: 'Exploration rate (ε)',
              required: true,
              defaultValue: config.explorationRate,
              placeholder: '0.1',
              helpText: 'Chance to explore (0-1)',
            },
            {
              type: 'number',
              name: 'zScoreClamp',
              label: 'Z-score clamp',
              required: true,
              defaultValue: config.zScoreClamp,
              placeholder: '3',
              helpText: 'Maximum z-score before clamping',
            },
            {
              type: 'number',
              name: 'weightPickRate',
              label: 'Pick rate weight',
              required: true,
              defaultValue: config.weightPickRate,
              placeholder: '1',
              helpText: 'Weight for pick rate in word score',
            },
            {
              type: 'number',
              name: 'weightPostRate',
              label: 'Post rate weight',
              required: true,
              defaultValue: config.weightPostRate,
              placeholder: '1',
              helpText: 'Weight for post rate in word score',
            },
          ],
          acceptLabel: 'Save',
          cancelLabel: 'Cancel',
        },
      },
    });
  } catch (error) {
    console.error(`Error loading slate bandit config: ${error}`);
    res.json({
      showToast: {
        text: 'Failed to configuration',
        appearance: 'neutral',
      },
    });
  }
}
