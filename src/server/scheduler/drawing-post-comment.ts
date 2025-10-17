import { reddit } from '@devvit/web/server';
import type { Request, Response } from 'express';
import {
  getDrawing,
  getDrawingCommentData,
  saveLastCommentUpdate,
  savePinnedCommentId,
  clearNextScheduledJobId,
} from '../services/drawing';

/**
 * Job handler for creating a new drawing pinned comment
 * Creates a contextual comment for drawing posts
 */

export async function handleNewDrawingPinnedComment(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Extract data from the scheduler payload
    const jobData = req.body.data || req.body;
    const { postId, authorName, word } = jobData;

    // Validate required parameters
    if (!postId) {
      console.error('PostId missing in handleNewDrawingPinnedComment job');
      res.status(400).json({ status: 'error', message: 'PostId is required' });
      return;
    }
    if (!authorName) {
      console.error('AuthorName missing in handleNewDrawingPinnedComment job');
      res
        .status(400)
        .json({ status: 'error', message: 'AuthorName is required' });
      return;
    }
    if (!word) {
      console.error('Word missing in handleNewDrawingPinnedComment job');
      res.status(400).json({ status: 'error', message: 'Word is required' });
      return;
    }

    const commentText = `Pixelary is a community drawing game. Submit your guess in the post above!

Comment commands:
- \`!words\` - See dictionary
- \`!add <word>\` - Add word to dictionary
- \`!show <word>\` - Check guess stats
- \`!help\` - All commands

Good luck and thanks for playing!`;

    const comment = await reddit.submitComment({
      text: commentText,
      id: postId as `t3_${string}`,
    });

    // Pin the comment and save ID
    await comment.distinguish(true);
    await savePinnedCommentId(postId, comment.id);
    await saveLastCommentUpdate(postId, Date.now());

    res.json({ status: 'success' });
  } catch (error) {
    console.error(`Error in new drawing pinned comment job: ${error}`);
    res.status(500).json({ status: 'error', message: 'Job failed' });
  }
}

/**
 * Job handler for updating drawing pinned comment with live stats
 * Updates comment with comprehensive stats and guess distribution
 */

export async function handleUpdateDrawingPinnedComment(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const jobData = req.body.data || req.body;
    const { postId } = jobData;

    if (!postId) {
      console.error('PostId is missing from request body:', req.body);
      res.status(400).json({ status: 'error', message: 'PostId is required' });
      return;
    }

    // Get post data and stats
    const postData = await getDrawing(postId);
    if (!postData) {
      console.error(`Post data not found for ${postId}`);
      res.status(400).json({ status: 'error', message: 'Post data not found' });
      return;
    }

    const stats = await getDrawingCommentData(postId);

    // Calculate difficulty metrics
    const difficultyScore =
      stats.playerCount > 0
        ? Math.round((stats.guessCount / stats.playerCount) * 10) / 10
        : 0;
    const difficultyLevel =
      difficultyScore < 2
        ? '🟢 Easy'
        : difficultyScore < 4
          ? '🟡 Medium'
          : difficultyScore < 6
            ? '🟠 Hard'
            : '🔴 Expert';

    const commentText = `Pixelary is a community drawing game. Submit your guess in the post above!

Difficulty: ${difficultyLevel} (${difficultyScore}/10)

Live stats:
- ${stats.playerCount} unique players guessed
- ${stats.guessCount} total guesses (avg ${Math.round((stats.guessCount / stats.playerCount) * 10) / 10} per player)
- ${stats.wordCount} unique words guessed
- ${stats.skips} skips (${stats.skipPercentage}% skip rate)
- ${stats.solves} solves (${stats.solvedPercentage}% solved rate)

Comment commands:
- \`!words\` - See dictionary
- \`!add <word>\` - Add word to dictionary
- \`!show <word>\` - Check guess stats
- \`!help\` - All commands

Good luck and thanks for playing!`;

    // Update or create comment
    // Get the existing comment and edit it with new content
    const comment = await reddit.getCommentById(
      postData.pinnedCommentId as `t1_${string}`
    );
    await comment.edit({ text: commentText });

    // Update timestamp
    await saveLastCommentUpdate(postId, Date.now());

    // Clear the scheduled job ID since we've executed the update
    await clearNextScheduledJobId(postId);

    res.json({ status: 'success' });
  } catch (error) {
    console.error(`Error in update drawing pinned comment job: ${error}`);
    res.status(500).json({ status: 'error', message: 'Job failed' });
  }
}
