import type { Request, Response } from 'express';
import { assertT3 } from '@devvit/shared-types/tid.js';
import { redis } from '@devvit/web/server';
import { REDIS_KEYS, acquireLock, releaseLock } from '@server/core/redis';
import { awardTournamentRewards } from '@server/services/posts/tournament/award';
import {
  TOURNAMENT_PAYOUT_SNAPSHOT_COUNT,
  TOURNAMENT_PAYOUT_TOP_PERCENT,
  TOURNAMENT_PAYOUT_REWARD_TOP_PERCENT,
  TOURNAMENT_PAYOUT_LADDER_FIRST,
  TOURNAMENT_PAYOUT_LADDER_SECOND,
  TOURNAMENT_PAYOUT_LADDER_THIRD,
} from '@shared/constants';
import { replyToPinnedComment } from '@server/services/comments/pinned';
import type { T1 } from '@devvit/shared-types/tid.js';
import { getUsername } from '@server/core/user';
import { getTournamentEntry } from '@server/services/posts/tournament/post';

/**
 * Job handler for running a tournament payout snapshot.
 * Ensures idempotency per dayIndex via a ledger + lightweight lock.
 */

export async function handleTournamentPayoutSnapshot(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const jobData = req.body.data || req.body;
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
      await awardTournamentRewards(postId);

      // Mark ledger
      await redis.hSet(ledgerKey, { [String(day)]: '1' });

      // Build and post a brief payout summary reply
      try {
        const entryCount = await redis.zCard(
          REDIS_KEYS.tournamentEntries(postId)
        );
        const percent = Math.max(
          0,
          Math.min(100, TOURNAMENT_PAYOUT_TOP_PERCENT)
        );
        const cutoff = Math.max(1, Math.floor((entryCount * percent) / 100));
        const entries = await redis.zRange(
          REDIS_KEYS.tournamentEntries(postId),
          0,
          cutoff - 1,
          { by: 'score', reverse: true }
        );
        const entryData = await Promise.all(
          entries.map(async (e) => getTournamentEntry(e.member as T1))
        );
        const top3 = entryData
          .filter((d): d is NonNullable<typeof d> => Boolean(d))
          .slice(0, 3);
        const names = await Promise.all(top3.map((d) => getUsername(d.userId)));
        const parts: string[] = [];
        parts.push(
          `Day ${day}/${TOURNAMENT_PAYOUT_SNAPSHOT_COUNT}: paid top ${percent}% (${cutoff})`
        );
        if (TOURNAMENT_PAYOUT_REWARD_TOP_PERCENT > 0) {
          parts.push(`+${TOURNAMENT_PAYOUT_REWARD_TOP_PERCENT} each`);
        }
        if (names[0] && TOURNAMENT_PAYOUT_LADDER_FIRST > 0)
          parts.push(
            ` | 1st +${TOURNAMENT_PAYOUT_LADDER_FIRST} (u/${names[0]})`
          );
        if (names[1] && TOURNAMENT_PAYOUT_LADDER_SECOND > 0)
          parts.push(
            `, 2nd +${TOURNAMENT_PAYOUT_LADDER_SECOND} (u/${names[1]})`
          );
        if (names[2] && TOURNAMENT_PAYOUT_LADDER_THIRD > 0)
          parts.push(
            `, 3rd +${TOURNAMENT_PAYOUT_LADDER_THIRD} (u/${names[2]})`
          );
        await replyToPinnedComment(postId, parts.join(''));
      } catch {
        // Non-fatal if summary fails
      }

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
