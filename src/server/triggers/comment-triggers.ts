import type { Request, Response } from 'express';
import { context, reddit } from '@devvit/web/server';
import {
  CommandContext,
  isCommand,
  parseCommand,
} from '../services/comment-commands';
import { handleChampionDelete } from '../services/champion';
import { processCommand } from '../services/comment-commands';

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

    if (
      !comment ||
      !isCommand(comment.body) ||
      !author ||
      author.name === context.appName
    ) {
      res.json({ status: 'ignored' });
      return;
    }

    // Extract the command and arguments from the comment body
    const { command, args } = parseCommand(comment.body);

    // Create command context
    const commandContext: CommandContext = {
      commentId: comment.id,
      authorName: author.name,
      authorId: author.id,
      subredditName: subreddit.name,
      subredditId: subreddit.id,
      postId: comment.postId,
      timestamp: Date.now(),
    };

    // Process command
    const result = await processCommand(command, args, commandContext);

    if (result.success && result.response) {
      // Reply to the comment
      await reddit.submitComment({
        text: result.response,
        id: comment.id,
      });
    } else if (!result.success) {
      // Command failed
    }

    res.json({ status: 'processed' });
  } catch (error) {
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
    const { commentId } = req.body;

    if (!commentId) {
      res.status(400).json({
        status: 'error',
        message: 'Comment ID is required',
      });
      return;
    }

    await handleChampionDelete(commentId);

    res.json({ status: 'processed' });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Failed to process comment deletion',
    });
  }
}
