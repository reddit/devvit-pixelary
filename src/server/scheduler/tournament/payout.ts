import type { Request, Response } from 'express';
import { assertT3 } from '@devvit/shared-types/tid.js';
import { redis } from '@devvit/web/server';
import { REDIS_KEYS, acquireLock, releaseLock } from '@server/core/redis';
import { awardTournamentRewards } from '@server/services/posts/tournament/award';
import { buildTournamentPayoutSummary } from '@server/services/posts/tournament/summary';
import { replyToPinnedComment } from '@server/services/comments/pinned';

/**
 * Job handler for running a tournament payout snapshot.
 * Ensures idempotency per dayIndex via a ledger + lightweight lock.
 */

export async function handleTournamentPayoutSnapshot(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const jobData = req.body.data ?? req.body;
    const { postId, dayIndex } = jobData;

    // Validate postId and dayIndex
    try {
      assertT3(postId);
    } catch {
      res.status(400).json({ status: 'error', message: 'postId is required' });
      return;
    }
    const day = Number(dayIndex);
    if (!Number.isFinite(day) || day < 1) {
      res.status(400).json({ status: 'error', message: 'dayIndex is invalid' });
      return;
    }

    const ledgerKey = REDIS_KEYS.tournamentPayoutLedger(postId);
    const lockKey = REDIS_KEYS.tournamentPayoutLock(postId, day);

    // Acquire short-lived lock to dedupe concurrent scheduler calls
    const gotLock = await acquireLock(lockKey, 120);
    if (!gotLock) {
      res.json({ status: 'skipped', reason: 'lock held' });
      return;
    }

    try {
      // Idempotency check
      const alreadyRan = await redis.hGet(ledgerKey, String(day));
      if (alreadyRan) {
        res.json({ status: 'skipped', reason: 'already ran' });
        return;
      }

      // Execute snapshot payout
      await awardTournamentRewards(postId, {
        dayIndex: day,
      });

      // Build and post summary reply
      const summary = await buildTournamentPayoutSummary(postId, {
        dayIndex: day,
      });
      try {
        await replyToPinnedComment(postId, summary);
      } catch {
        // non-fatal
      }

      // Mark ledger
      await redis.hSet(ledgerKey, { [String(day)]: '1' });

      res.json({ status: 'success' });
    } finally {
      try {
        await releaseLock(lockKey);
      } catch {
        // best effort
      }
    }
  } catch {
    res.status(500).json({ status: 'error', message: 'Job failed' });
  }
}
