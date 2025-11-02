import type { Request, Response } from 'express';
import { context, reddit, redis } from '@devvit/web/server';
import type { T1, T3 } from '@devvit/shared-types/tid.js';
import { getTournament } from '@server/services/posts/tournament/post';
import { awardTournamentRewards } from '@server/services/posts/tournament/award';
import { replyToPinnedComment } from '@server/services/comments/pinned';
import { REDIS_KEYS } from '@server/core/redis';
import { getUsername } from '@server/core/user';
import {
  TOURNAMENT_PAYOUT_TOP_PERCENT,
  TOURNAMENT_PAYOUT_REWARD_TOP_PERCENT,
  TOURNAMENT_PAYOUT_LADDER_FIRST,
  TOURNAMENT_PAYOUT_LADDER_SECOND,
  TOURNAMENT_PAYOUT_LADDER_THIRD,
} from '@shared/constants';
import { getTournamentEntry } from '@server/services/posts/tournament/post';

async function buildManualPayoutSummary(postId: T3): Promise<string> {
  // Import redis lazily to play nice with test mocks
  let entryCount = 0;
  let entries: { member: string; score: number }[] = [];
  try {
    entryCount = await redis.zCard(REDIS_KEYS.tournamentEntries(postId));
    entries = await redis.zRange(REDIS_KEYS.tournamentEntries(postId), 0, -1, {
      by: 'score',
      reverse: true,
    });
  } catch {
    // If redis is unavailable in test mocks, provide a minimal message
    return 'Manual payout executed.';
  }
  const percent = Math.max(0, Math.min(100, TOURNAMENT_PAYOUT_TOP_PERCENT));
  const cutoff = Math.max(1, Math.floor((entryCount * percent) / 100));
  const entryData = await Promise.all(
    entries
      .slice(0, cutoff)
      .map(async (e) => getTournamentEntry(e.member as T1))
  );
  const top3 = entryData
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .slice(0, 3);
  const names = await Promise.all(top3.map((d) => getUsername(d.userId)));
  const parts: string[] = [];
  parts.push(`Manual payout: paid top ${percent}% (${cutoff})`);
  if (TOURNAMENT_PAYOUT_REWARD_TOP_PERCENT > 0) {
    parts.push(` +${TOURNAMENT_PAYOUT_REWARD_TOP_PERCENT} each`);
  }
  if (names[0] && TOURNAMENT_PAYOUT_LADDER_FIRST > 0)
    parts.push(` | 1st +${TOURNAMENT_PAYOUT_LADDER_FIRST} (u/${names[0]})`);
  if (names[1] && TOURNAMENT_PAYOUT_LADDER_SECOND > 0)
    parts.push(`, 2nd +${TOURNAMENT_PAYOUT_LADDER_SECOND} (u/${names[1]})`);
  if (names[2] && TOURNAMENT_PAYOUT_LADDER_THIRD > 0)
    parts.push(`, 3rd +${TOURNAMENT_PAYOUT_LADDER_THIRD} (u/${names[2]})`);
  return parts.join('');
}

/**
 * Menu action: Manually trigger a one-off tournament payout.
 * No-op (with toast) if not a tournament post.
 */
export async function handleRunTournamentPayout(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const rawPostId = context.postId;
    if (!rawPostId) {
      res.status(400).json({ showToast: 'Post ID is required' });
      return;
    }
    const postId = (
      String(rawPostId).startsWith('t3_')
        ? String(rawPostId)
        : `t3_${rawPostId}`
    ) as T3;

    // Check post type by reading tournament metadata (best-effort)
    let isTournament = false;
    try {
      const info = await getTournament(postId);
      isTournament = info.type === 'tournament';
    } catch {
      // ignore
    }

    // Fallback: treat as tournament if there are any tournament entries
    if (!isTournament) {
      try {
        const count = await redis.zCard(REDIS_KEYS.tournamentEntries(postId));
        if (count > 0) {
          isTournament = true;
        }
      } catch {
        // ignore
      }
    }

    if (!isTournament) {
      res.json({ showToast: 'Not a tournament post' });
      return;
    }

    await awardTournamentRewards(postId);

    // Build a detailed summary for the comment
    const summary = await buildManualPayoutSummary(postId);

    // Best-effort comment: try replying to pinned; if missing, fallback
    // to a top-level APP comment. Do not create a pinned comment here.
    try {
      await replyToPinnedComment(postId, summary);
    } catch {
      try {
        await reddit.submitComment({
          text: summary,
          id: postId,
          runAs: 'APP',
        });
      } catch {
        // Final fallback: swallow; payout already executed
      }
    }

    res.json({ showToast: 'Payout complete' });
  } catch (error) {
    console.error('Manual tournament payout failed:', error);
    res.status(500).json({ showToast: 'Failed to run payout' });
  }
}
