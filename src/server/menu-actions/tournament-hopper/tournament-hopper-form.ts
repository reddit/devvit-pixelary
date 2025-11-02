import type { Request, Response } from 'express';
import { redis, context } from '@devvit/web/server';
import { getHopperPrompts } from '@server/services/posts/tournament/hopper';
import { REDIS_KEYS } from '@server/core/redis';

/**
 * Menu action handler to view and edit the tournament prompt hopper
 */

export async function showTournamentHopperForm(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const { prompts } = await getHopperPrompts(0, 10000);
    const subName = context.subredditName;
    const enabledStr = await redis.get(
      REDIS_KEYS.tournamentSchedulerEnabled(subName)
    );
    const enabled = enabledStr === '1' || enabledStr === 'true';

    res.json({
      showForm: {
        name: 'tournamentHopperForm',
        form: {
          title: 'Tournament hopper',
          description:
            'Queued tournament prompts. Keep the prompts short and sweet. No more than 12 characters.',
          fields: [
            {
              type: 'boolean',
              name: 'enabled',
              label: 'Auto-post daily',
              defaultValue: enabled,
            },
            {
              type: 'paragraph',
              name: 'prompts',
              label: 'Drawing prompts',
              lineHeight: 8,
              required: false,
              defaultValue: prompts.join(', '),
              placeholder: 'Meatloaf, Cat Pants, Bird with Arms, ...',
              helpText: 'Separate by commas. Case insensitive.',
            },
          ],
          acceptLabel: 'Save',
          cancelLabel: 'Cancel',
        },
      },
    });
  } catch (error) {
    console.error(`Error loading tournament prompts: ${error}`);
    res.json({
      showToast: {
        text: 'Failed to load tournament prompts',
        appearance: 'error',
      },
    });
  }
}
