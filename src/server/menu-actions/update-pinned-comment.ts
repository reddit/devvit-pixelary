import { context } from '@devvit/web/server';
import type { Request, Response } from 'express';
import {
  saveLastCommentUpdate,
  clearNextScheduledJobId,
} from '../services/posts/drawing';
import { getPinnedCommentId } from '../services/comments/pinned';
import { updatePinnedPostComment } from '../services/posts/pinned';
import { updatePinnedComment } from '../services/comments/pinned';
import { getTournament } from '../services/posts/tournament/post';
import { generateTournamentCommentText } from '../services/posts/tournament/comments';
import {
  generateDrawingCommentText,
  getDrawingCommentData,
} from '../services/posts/drawing';
import type { PostType } from '@shared/schema/index';

/**
 * Menu action handler for updating the pinned comment for a drawing post or pinned post
 */
export async function handleUpdatePinnedComment(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const postId = context.postId;

    if (!postId) {
      res.status(400).json({
        showToast: 'Post ID is required',
      });
      return;
    }

    // Get the pinned comment ID for this post
    const pinnedCommentId = await getPinnedCommentId(postId);
    if (!pinnedCommentId) {
      res.json({
        showToast: 'No comment found',
      });
      return;
    }

    // Determine post type from UI request
    const postType = (req.body?.postType as PostType | undefined) ?? undefined;
    if (!postType) {
      res.status(400).json({ showToast: 'postType is required' });
      return;
    }

    if (postType === 'pinned') {
      // For pinned posts, use the dedicated update method (static text)
      await updatePinnedPostComment(postId);
    } else {
      // For drawing/tournament, build text directly
      if (postType === 'drawing') {
        const stats = await getDrawingCommentData(postId);
        const text = generateDrawingCommentText(stats);
        await updatePinnedComment(postId, text);
      } else if (postType === 'tournament') {
        const data = await getTournament(postId);
        const text = await generateTournamentCommentText(data.word);
        await updatePinnedComment(postId, text);
      } else {
        res.json({ showToast: 'Unsupported post type' });
        return;
      }
    }

    // Update timestamp and clear any scheduled jobs (only for drawing posts)
    if (postType === 'drawing') {
      await Promise.all([
        saveLastCommentUpdate(postId, Date.now()),
        clearNextScheduledJobId(postId),
      ]);
    }

    res.json({
      showToast: 'Comment updated',
      appearance: 'success',
    });
  } catch (error) {
    console.error(`Error updating comment: ${error}`);
    res.status(500).json({
      showToast: 'Failed to update',
    });
  }
}
