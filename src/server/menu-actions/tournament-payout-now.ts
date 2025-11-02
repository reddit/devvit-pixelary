import type { Request, Response } from 'express';
import { context, redis } from '@devvit/web/server';
import type { T3 } from '@devvit/shared-types/tid.js';
import { getTournament } from '@server/services/posts/tournament/post';
import { awardTournamentRewards } from '@server/services/posts/tournament/award';
// no direct comment posting here; handled in award service when notify=true
import { REDIS_KEYS } from '@server/core/redis';

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

    await awardTournamentRewards(postId, { manual: true });

    res.json({ showToast: 'Payout complete' });
  } catch (error) {
    console.error('Manual tournament payout failed:', error);
    res.status(500).json({ showToast: 'Failed to run payout' });
  }
}
