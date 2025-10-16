import type { Request, Response } from 'express';
import { context, reddit } from '@devvit/web/server';
import { isCommand } from '../services/comment-commands';

/**
 * Comment trigger handlers
 * Handles comment creation and deletion events
 */

export async function handleCommentCreate(
  req: Request,
  res: Response
): Promise<void> {
  const startTime = Date.now();

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
    console.log(`Processing comment: "${comment.body}" from ${author.name}`);
    if (isCommand(comment.body)) {
      console.log(`Command detected: ${comment.body}`);

      if (!subreddit.name) {
        console.error('Subreddit name is undefined:', {
          comment: comment.id,
          subreddit,
        });
        res.json({ status: 'error', message: 'Subreddit name not available' });
        return;
      }

      // Import new command system
      const { CommandManager, CommandMonitor } = await import(
        '../services/comment-commands'
      );

      // Parse command and arguments
      const commandParts = comment.body.trim().split(' ');
      const command = commandParts[0].toLowerCase();
      const args = commandParts.slice(1);

      // Create command context
      const commandContext = {
        commentId: comment.id,
        authorName: author.name,
        subredditName: subreddit.name,
        timestamp: Date.now(),
        source: 'http' as const,
      };

      // Process command through new system
      const result = await CommandManager.processCommand(
        command,
        args,
        commandContext
      );

      // Record metrics
      await CommandMonitor.recordCommandExecution({
        command,
        subredditName: subreddit.name,
        success: result.success,
        responseTime: Date.now() - startTime,
        ...(result.error && { error: result.error }),
      });

      console.log(`Command result: ${result.success ? 'SUCCESS' : 'FAILED'}`);

      if (result.success && result.response) {
        // Reply to the comment
        try {
          await reddit.submitComment({
            text: result.response,
            id: comment.id as `t1_${string}`,
          });
          console.log(`✅ Successfully replied to comment ${comment.id}`);
        } catch (replyError) {
          console.error(
            `❌ Failed to reply to comment ${comment.id}:`,
            replyError
          );
        }
      } else if (!result.success) {
        console.log(`Command failed: ${result.error}`);
      }
    } else {
      console.log(`Not a command: ${comment.body}`);
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
    const { postId, commentId } = req.body;

    if (!postId || !commentId) {
      res.json({ status: 'ignored' });
      return;
    }

    // TODO: Implement command comment cleanup when command system is updated
    // TODO: Remove guess comment from Redis
    console.log(`Comment deleted: ${commentId} from post ${postId}`);

    res.json({ status: 'processed' });
  } catch (error) {
    console.error(`Error processing comment delete: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to process comment deletion',
    });
  }
}
