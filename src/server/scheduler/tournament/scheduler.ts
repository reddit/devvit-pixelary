import type { Request, Response } from 'express';
import { context, redis } from '@devvit/web/server';
import { REDIS_KEYS, acquireLock } from '@server/core/redis';
import {
  peekNextHopperPrompt,
  removeHopperPrompt,
} from '@server/services/posts/tournament/hopper';
import { createTournament } from '@server/services/posts/tournament/post';

export async function handleTournamentScheduler(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const subName = context.subredditName;
    const enabledStr = await redis.get(
      REDIS_KEYS.tournamentSchedulerEnabled(subName)
    );
    const enabled = enabledStr === '1' || enabledStr === 'true';
    if (!enabled) {
      res.json({ status: 'skipped', reason: 'scheduler disabled' });
      return;
    }
    const lockKey = REDIS_KEYS.tournamentSchedulerLock(subName);

    // Lightweight lock to avoid duplicate work (atomic)
    const gotLock = await acquireLock(lockKey, 120);
    if (!gotLock) {
      res.json({ status: 'skipped', reason: 'lock held' });
      return;
    }

    try {
      const prompt = await peekNextHopperPrompt();
      if (!prompt) {
        res.json({ status: 'skipped', reason: 'no prompt available' });
        return;
      }

      await createTournament(prompt);
      await removeHopperPrompt(prompt);

      res.json({ status: 'success', prompt });
    } finally {
      try {
        await redis.del(lockKey);
      } catch {
        // Best effort cleanup; TTL will expire
      }
    }
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Scheduler failed' });
  }
}
