import express from 'express';
import {
  createServer,
  context,
  getServerPort,
  reddit,
  realtime,
} from '@devvit/web/server';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';

import { setupPixelary } from './services/setup';
import {
  getWordCommandComment,
  removeWordFromDictionary,
  addBannedWord,
  removeWordCommandComment,
  getBannedWords,
} from './services/dictionary';
import {
  initializeCommandSystem,
  isCommand,
} from './services/comment-commands';
import {
  firstSolveComment,
  userLeveledUp,
  updateDrawingPinnedComment,
  newDrawingPinnedComment,
  createPinnedPostComment,
} from './jobs';
import {
  handlePostCreate,
  handleEditDictionary,
  handleBannedWords,
  handleRevealWord,
} from './menu-actions';
import { handlePinnedPostSubmit } from './forms/pinned-post-submit';
import { handlePostTypeSelect } from './forms/post-type-select';
import { handleDictionarySubmit } from './forms/dictionary-submit';
import { handleBannedWordsSubmit } from './forms/banned-words-submit';

const app = express();

// Request logging middleware
app.use((req, _res, next) => {
  // Skip logging for internal app upgrade endpoint
  if (req.url !== '/internal/on-app-upgrade') {
    console.log(`[SERVER] ${req.method} ${req.url}`);
  }
  next();
});

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

router.post('/internal/on-app-install', async (_req, res): Promise<void> => {
  try {
    // Run setup for the subreddit
    await setupPixelary(context.subredditName);

    res.json({
      status: 'success',
      message: `Pixelary installed in subreddit ${context.subredditName}`,
    });
  } catch (error) {
    console.error(`Error installing Pixelary: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to install Pixelary',
    });
  }
});

router.post('/internal/on-app-upgrade', async (_req, res): Promise<void> => {
  try {
    // Run setup for the subreddit (idempotent)
    await setupPixelary(context.subredditName);

    res.json({
      status: 'success',
      message: `App upgraded for subreddit ${context.subredditName}`,
    });
  } catch (error) {
    console.error(`Error upgrading app: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to upgrade app',
    });
  }
});

router.post('/internal/menu/post-create', handlePostCreate);

router.post('/internal/form/post-type-select', handlePostTypeSelect);

router.post('/internal/form/pinned-post-submit', handlePinnedPostSubmit);

router.post('/internal/form/dictionary-submit', handleDictionarySubmit);

router.post('/internal/form/banned-words-submit', handleBannedWordsSubmit);

router.post('/internal/menu/edit-dictionary', handleEditDictionary);

router.post('/internal/menu/banned-words', handleBannedWords);

router.post('/internal/menu/reveal-word', handleRevealWord);

router.post('/internal/on-comment-create', async (req, res): Promise<void> => {
  const startTime = Date.now();

  try {
    const { comment, author, subreddit } = req.body;

    if (!comment || !author || author.name === context.appName) {
      res.json({ status: 'ignored' });
      return;
    }

    // Check for banned words
    const commentText = comment.body.toLowerCase();
    const bannedWords = await getBannedWords(subreddit.name);
    const isSpam = bannedWords.some((bannedWord) =>
      commentText.includes(bannedWord.toLowerCase())
    );

    if (isSpam) {
      // TODO: Remove and lock comment
      console.log(`Spam comment detected: ${comment.id}`);
    }

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
        './services/comment-commands'
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
});

// Command system monitoring endpoint
router.get('/internal/command-stats', async (_req, res): Promise<void> => {
  try {
    const { CommandMonitor, CommandManager } = await import(
      './services/comment-commands'
    );

    const healthStatus = await CommandMonitor.getHealthStatus();
    const commandStats = await CommandManager.getCommandStats();

    res.json({
      status: 'success',
      health: healthStatus,
      stats: commandStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get command stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve command statistics',
    });
  }
});

// Comment Delete Trigger
router.post('/internal/on-comment-delete', async (req, res): Promise<void> => {
  try {
    const { postId, commentId, subreddit } = req.body;

    if (!postId || !commentId) {
      res.json({ status: 'ignored' });
      return;
    }

    // Check if this was a word command comment
    const commandData = await getWordCommandComment(subreddit.name, commentId);

    if (commandData) {
      console.log(
        `Processing deleted word command: ${commandData.command} for word "${commandData.word}"`
      );

      if (commandData.command === 'add') {
        // Auto-remove word from dictionary and add to denylist
        const removed = await removeWordFromDictionary(
          subreddit.name,
          commandData.word
        );
        const banned = await addBannedWord(subreddit.name, commandData.word);

        console.log(
          `Auto-removed word "${commandData.word}" from dictionary: ${removed}`
        );
        console.log(
          `Auto-added word "${commandData.word}" to denylist: ${banned}`
        );
      }

      // Clean up command tracking
      await removeWordCommandComment(subreddit.name, commentId);
    }

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
});

// Test endpoint for realtime
router.post('/internal/test-realtime', async (req, res): Promise<void> => {
  try {
    const { postId } = req.body;
    if (!postId) {
      res.status(400).json({ status: 'error', message: 'postId required' });
      return;
    }

    console.log(`Sending test realtime message to post-${postId}-guesses`);
    await realtime.send(`post-${postId}-guesses`, {
      type: 'test_message',
      postId,
      message: 'This is a test message',
      timestamp: Date.now(),
    });
    console.log('Test message sent successfully');

    res.json({ status: 'success', message: 'Test message sent' });
  } catch (error) {
    console.error(`Error sending test message: ${error}`);
    res
      .status(400)
      .json({ status: 'error', message: 'Failed to send test message' });
  }
});

// Test endpoint for scheduler
router.post('/internal/test-scheduler', async (req, res): Promise<void> => {
  try {
    const { postId, authorUsername, word } = req.body;
    if (!postId || !authorUsername || !word) {
      res.status(400).json({
        status: 'error',
        message: 'postId, authorUsername, and word required',
      });
      return;
    }

    console.log(
      `Testing scheduler with postId: ${postId}, authorUsername: ${authorUsername}, word: ${word}`
    );

    // Test the scheduler endpoint directly
    const response = await fetch(
      `http://localhost:${getServerPort()}/internal/scheduler/new-drawing-pinned-comment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId, authorUsername, word }),
      }
    );

    if (response.ok) {
      res.json({ status: 'success', message: 'Scheduler test completed' });
    } else {
      res
        .status(500)
        .json({ status: 'error', message: 'Scheduler test failed' });
    }
  } catch (error) {
    console.error(`Error testing scheduler: ${error}`);
    res.status(500).json({ status: 'error', message: 'Scheduler test failed' });
  }
});

// Scheduler job endpoints
router.post(
  '/internal/scheduler/new-drawing-pinned-comment',
  async (req, res): Promise<void> => {
    try {
      console.log('Received NEW_DRAWING_PINNED_COMMENT job:', req.body);

      // Extract data from the scheduler payload
      const jobData = req.body.data || req.body;
      const { postId, authorUsername, word } = jobData;

      console.log(
        `Extracted data - postId: ${postId}, authorUsername: ${authorUsername}, word: ${word}`
      );

      await newDrawingPinnedComment({ postId, authorUsername, word });
      console.log(
        `Successfully processed NEW_DRAWING_PINNED_COMMENT job for post ${postId}`
      );
      res.json({ status: 'success' });
    } catch (error) {
      console.error(`Error in new drawing pinned comment job: ${error}`);
      res.status(500).json({ status: 'error', message: 'Job failed' });
    }
  }
);

router.post(
  '/internal/scheduler/update-drawing-pinned-comment',
  async (req, res): Promise<void> => {
    try {
      console.log('Received UPDATE_DRAWING_PINNED_COMMENT job:', req.body);

      // Extract data from the scheduler payload (same pattern as new-drawing-pinned-comment)
      const jobData = req.body.data || req.body;
      const { postId } = jobData;

      console.log(`Extracted postId: ${postId}`);

      if (!postId) {
        console.error('PostId is missing from request body:', req.body);
        res
          .status(400)
          .json({ status: 'error', message: 'PostId is required' });
        return;
      }

      await updateDrawingPinnedComment({ postId });
      console.log(
        `Successfully processed UPDATE_DRAWING_PINNED_COMMENT job for post ${postId}`
      );
      res.json({ status: 'success' });
    } catch (error) {
      console.error(`Error in update drawing pinned comment job: ${error}`);
      res.status(500).json({ status: 'error', message: 'Job failed' });
    }
  }
);

router.post(
  '/internal/scheduler/first-solve-comment',
  async (req, res): Promise<void> => {
    try {
      const { postId, solverUsername, word, authorUsername } = req.body;
      await firstSolveComment({ postId, solverUsername, word, authorUsername });
      res.json({ status: 'success' });
    } catch (error) {
      console.error(`Error in first solve comment job: ${error}`);
      res.status(500).json({ status: 'error', message: 'Job failed' });
    }
  }
);

router.post(
  '/internal/scheduler/user-level-up',
  async (req, res): Promise<void> => {
    try {
      const { username, score, prevLevel, newLevel } = req.body;
      await userLeveledUp({ username, score, prevLevel, newLevel });
      res.json({ status: 'success' });
    } catch (error) {
      console.error(`Error in user level up job: ${error}`);
      res.status(500).json({ status: 'error', message: 'Job failed' });
    }
  }
);

router.post(
  '/internal/scheduler/create-pinned-post-comment',
  async (req, res): Promise<void> => {
    try {
      const { postId } = req.body;
      await createPinnedPostComment({ postId });
      res.json({ status: 'success' });
    } catch (error) {
      console.error(`Error in create pinned post comment job: ${error}`);
      res.status(500).json({ status: 'error', message: 'Job failed' });
    }
  }
);

// Use router middleware
app.use(router);

// Mount tRPC with minimal logging
app.use(
  '/api/trpc',
  (req, _res, next) => {
    console.log(`[tRPC] ${req.method} ${req.url}`);
    next();
  },
  createExpressMiddleware({ router: appRouter, createContext })
);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);

// Initialize the command system
initializeCommandSystem().catch((error) => {
  console.error('Failed to initialize command system:', error);
});
