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
          title: 'Slate Bandit Configuration',
          description:
            'Configure the non-personalized slate bandit optimizing the dictionary',
          fields: [
            {
              type: 'number',
              name: 'explorationRate',
              label: 'Exploration Rate (ε)',
              required: true,
              defaultValue: config.explorationRate,
              placeholder: '0.1',
              helpText: 'Probability of exploring uncertain words (0.0-1.0)',
            },
            {
              type: 'number',
              name: 'zScoreClamp',
              label: 'Z-Score Clamp',
              required: true,
              defaultValue: config.zScoreClamp,
              placeholder: '3',
              helpText: 'Maximum absolute z-score before clamping',
            },
            {
              type: 'number',
              name: 'weightPickRate',
              label: 'Pick Rate Weight',
              required: true,
              defaultValue: config.weightPickRate,
              placeholder: '1',
              helpText: 'Weight for pick rate in drawer score calculation',
            },
            {
              type: 'number',
              name: 'weightPostRate',
              label: 'Post Rate Weight',
              required: true,
              defaultValue: config.weightPostRate,
              placeholder: '1',
              helpText: 'Weight for post rate in drawer score calculation',
            },
          ],
          acceptLabel: 'Save',
          cancelLabel: 'Cancel',
        },
      },
    });
  } catch (error) {
    console.error(`Error loading slate bandit config: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to load configuration',
    });
  }
}
