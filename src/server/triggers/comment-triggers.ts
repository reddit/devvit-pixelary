import type { Request, Response } from 'express';
import { context, reddit } from '@devvit/web/server';
import {
  CommandContext,
  isCommand,
  parseCommand,
} from '../services/comment-commands';
import { getBackedWord, removeBacker } from '../services/word-backing';
import { processCommand } from '../services/comment-commands';
import { banWord } from '../services/dictionary';

// EventSource enum values from Reddit API
enum EventSource {
  UNKNOWN_EVENT_SOURCE = 0,
  USER = 1,
  ADMIN = 2,
  MODERATOR = 3,
  UNRECOGNIZED = -1,
}

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
    const { commentId, source } = req.body;

    if (!commentId) {
      res.status(400).json({
        status: 'error',
        message: 'Comment ID is required',
      });
      return;
    }

    const backedWord = await getBackedWord(commentId);
    const deletedByUser = source === EventSource.USER;

    if (backedWord && deletedByUser) {
      // The user deleted their own comment. Let's assume positive intent and only remove the backing so that another user can back it again later.
      await removeBacker(backedWord);
    }

    if (backedWord && !deletedByUser) {
      // A moderator, admin, or an unknown source deleted the comment, so we assume the word is bad and ban it from being added again.
      await Promise.all([removeBacker(backedWord), banWord(backedWord)]);
    }

    res.json({ status: 'processed' });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Failed to process comment deletion',
    });
  }
}
