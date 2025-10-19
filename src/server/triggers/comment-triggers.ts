import type { Request, Response } from 'express';
import { context, reddit } from '@devvit/web/server';
import { isCommand } from '../services/comment-commands';
import {
  findChampionCommentByCommentId,
  removeChampionComment,
} from '../services/champion-comments';
import { banWord } from '../services/dictionary';

/**
 * Comment trigger handlers
 * Handles comment creation and deletion events
 */

export async function handleCommentCreate(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { comment, author, subreddit } = req.body;

    if (!comment || !author || author.name === context.appName) {
      res.json({ status: 'ignored' });
      return;
    }

    // TODO: Check for banned words when subreddit ID is available

    // if (isSpam) {
    //   // TODO: Remove and lock comment
    //   console.log(`Spam comment detected: ${comment.id}`);
    // }

    // Check for commands using new system
    // Processing comment
    if (isCommand(comment.body)) {
      // Command detected

      if (!subreddit.name) {
        console.error('Subreddit name is undefined:', {
          comment: comment.id,
          subreddit,
        });
        res.json({ status: 'error', message: 'Subreddit name not available' });
        return;
      }

      // Import simplified command system
      const { processCommand } = await import('../services/comment-commands');

      // Parse command and arguments
      const commandParts = comment.body.trim().split(' ');
      const command = commandParts[0].toLowerCase();
      const args = commandParts.slice(1);

      // Create command context
      const commandContext = {
        commentId: comment.id,
        authorName: author.name,
        authorId: author.id,
        subredditName: subreddit.name,
        subredditId: subreddit.id as `t5_${string}`,
        postId: comment.postId as `t3_${string}`,
        timestamp: Date.now(),
        source: 'http' as const,
      };

      // Process command through simplified system
      const result = await processCommand(command, args, commandContext);

      // Command processed

      if (result.success && result.response) {
        // Reply to the comment
        try {
          await reddit.submitComment({
            text: result.response,
            id: comment.id as `t1_${string}`,
          });
          // Reply sent
        } catch (replyError) {
          console.error(
            `❌ Failed to reply to comment ${comment.id}:`,
            replyError
          );
        }
      } else if (!result.success) {
        // Command failed
      }
    } else {
      // Not a command
    }

    res.json({ status: 'processed' });
  } catch (error) {
    console.error(`Error processing comment create: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to process comment',
    });
  }
}

export async function handleCommentDelete(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { postId, commentId, subredditName } = req.body;

    if (!postId || !commentId) {
      res.json({ status: 'ignored' });
      return;
    }

    // Check if this deleted comment was a champion comment
    const championData = await findChampionCommentByCommentId(commentId);

    if (championData) {
      // Champion comment deleted

      // Remove champion comment reference
      await removeChampionComment(
        championData.subredditName,
        championData.word
      );

      // Ban the word as enforcement
      if (subredditName) {
        await banWord(subredditName, championData.word);
        // Word banned
      }
    }

    // TODO: Implement command comment cleanup when command system is updated
    // TODO: Remove guess comment from Redis
    // Comment deleted

    res.json({ status: 'processed' });
  } catch (error) {
    console.error(`Error processing comment delete: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to process comment deletion',
    });
  }
}
