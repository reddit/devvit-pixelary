import type { Request, Response } from 'express';
import { context } from '@devvit/web/server';
import type { T3 } from '@devvit/shared-types/tid.js';
import { assertT3 } from '@devvit/shared-types/tid.js';

/**
 * Menu action: Manually trigger a one-off tournament payout.
 * No-op (with toast) if not a tournament post.
 */
export async function handleRunTournamentPayout(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const postId = context.postId;
    if (!postId) {
      res.status(400).json({ showToast: 'Post ID is required' });
      return;
    }
    assertT3(postId);

    // Check post type by reading tournament metadata (best-effort)
    const { getTournament } = await import('../services/posts/tournament/post');
    const info = await getTournament(postId as T3);
    if (info.type !== 'tournament') {
      res.json({ showToast: 'Not a tournament post' });
      return;
    }

    const { awardTournamentRewards } = await import(
      '../services/posts/tournament/award'
    );
    await awardTournamentRewards(postId as T3);

    // Optional: best-effort small reply to pinned comment, without day index
    try {
      const { replyToPinnedComment } = await import(
        '../services/comments/pinned'
      );
      await replyToPinnedComment(
        postId as T3,
        'Manual tournament payout executed.'
      );
    } catch {
      // Non-fatal
    }

    res.json({ showToast: 'Payout complete' });
  } catch (error) {
    console.error('Manual tournament payout failed:', error);
    res.status(500).json({ showToast: 'Failed to run payout' });
  }
}
