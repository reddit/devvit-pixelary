import type { Request, Response } from 'express';
import { context, reddit } from '@devvit/web/server';
import {
  CommandContext,
  isCommand,
  parseCommand,
  handleCommentEdit,
  processCommand,
} from '../services/comments/commands/comment-commands';
import { getBackedWord, removeBacker } from '../services/words/word-backing';
import { banWord } from '../services/words/dictionary';
import {
  removeTournamentEntry,
  getTournamentEntry,
} from '../services/tournament/post';

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
        runAs: 'APP',
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

export async function handleCommentUpdate(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { comment, author, subreddit, previousBody } = req.body;

    if (!comment || !author || author.name === context.appName) {
      res.json({ status: 'ignored' });
      return;
    }

    // Create command context
    const commandContext: Omit<CommandContext, 'commentId'> = {
      authorName: author.name,
      authorId: author.id,
      subredditName: subreddit.name,
      subredditId: subreddit.id,
      postId: comment.postId,
      timestamp: Date.now(),
    };

    // Process comment edit
    const result = await handleCommentEdit(
      comment.id,
      previousBody,
      comment.body,
      commandContext
    );

    // Check if this is a tournament submission
    const tournamentEntry = await getTournamentEntry(comment.id);
    if (tournamentEntry && commandContext.postId) {
      // It's a tournament submission - remove it
      await removeTournamentEntry(commandContext.postId, comment.id);

      // Reply to the comment
      await reddit.submitComment({
        text: 'Comment edited. Submission removed.',
        id: comment.id,
        runAs: 'APP',
      });
    } else if (result.success && result.response) {
      // Reply to the comment
      await reddit.submitComment({
        text: result.response,
        id: comment.id,
        runAs: 'APP',
      });
    }

    res.json({ status: 'processed' });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Failed to process comment update',
    });
  }
}

export async function handleCommentDelete(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { postId, commentId, source } = req.body;

    if (!postId || !commentId) {
      res.status(400).json({
        status: 'error',
        message: 'postId and commentId are required',
      });
      return;
    }

    const [backedWord] = await Promise.all([
      getBackedWord(commentId),
      removeTournamentEntry(postId, commentId),
    ]);

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
