import type { Request, Response } from 'express';
import { context, redis } from '@devvit/web/server';
import { replaceHopperPrompts } from '../services/tournament/hopper';
import { REDIS_KEYS } from '../services/redis';
import { parseForm, z } from './_schema';

/**
 * Form handler to update the tournament prompt hopper
 */
export async function handleTournamentHopperForm(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { prompts, enabled } = parseForm(
      z.object({
        prompts: z.string().optional(),
        enabled: z.union([z.string(), z.boolean()]).optional(),
      }),
      req.body
    );

    const list = (prompts || '')
      .split(/[\n,]/)
      .map((x) => x.trim())
      .filter(Boolean);

    await replaceHopperPrompts(list);

    const subName = context.subredditName;
    const isEnabled = enabled === true || enabled === 'true' || enabled === '1';
    await redis.set(
      REDIS_KEYS.tournamentSchedulerEnabled(subName),
      isEnabled ? '1' : '0'
    );

    res.json({
      showToast: {
        text: 'Updated!',
        appearance: 'success',
      },
    });
  } catch (error) {
    console.error(`Error updating tournament prompts: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Something went wrong',
    });
  }
}
