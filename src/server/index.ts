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

import { countWords, seedWords } from './services/redis';
import { WORDS } from '../shared/words';
import { createPostWithType } from './core/post';
import { setupPixelary } from './services/setup';

// Wrapper function for weekly leaderboard creation
async function createWeeklyLeaderboard(timeframe: string, _limit: number) {
  return await createPostWithType(
    'weekly-leaderboard',
    `Weekly Leaderboard - ${timeframe}`
  );
}
import {
  getDictionary,
  updateDictionary,
  getBannedWords,
  updateBannedWords,
  getWordCommandComment,
  removeWordFromDictionary,
  addBannedWord,
  removeWordCommandComment,
} from './services/dictionary';
import { getDrawingPost } from './services/drawing-post';
import { createWeeklyCollection } from './services/collection-post';
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
  createWeeklyCollection as createWeeklyCollectionJob,
} from './jobs';

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

    // Seed dictionary if empty
    const total = await countWords();
    if (total === 0) {
      await seedWords(WORDS);
    }

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

    // Seed dictionary if empty (automatic seeding on upgrade)
    const total = await countWords();
    if (total === 0) {
      await seedWords(WORDS);
    }

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

router.post('/internal/menu/post-create', async (_req, res): Promise<void> => {
  try {
    // Return a form for selecting post type only
    res.json({
      showForm: {
        name: 'postTypeForm',
        form: {
          title: 'Create New Post',
          fields: [
            {
              type: 'select',
              name: 'postType',
              label: 'Post Type',
              options: [
                { label: 'Drawing Post', value: 'drawing' },
                { label: 'Pinned Post', value: 'pinned' },
                { label: 'Weekly Leaderboard', value: 'weekly-leaderboard' },
                { label: 'Weekly Collection', value: 'weekly-collection' },
              ],
              defaultValue: ['pinned'],
              required: true,
            },
          ],
          submitLabel: 'Next',
        },
      },
    });
  } catch (error) {
    console.error(`Error showing post creation form: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to show post creation form',
    });
  }
});

router.post(
  '/internal/form/post-type-select',
  async (req, res): Promise<void> => {
    try {
      const { postType } = req.body;

      if (!postType) {
        res.status(400).json({
          status: 'error',
          message: 'Post type is required',
        });
        return;
      }

      // Handle both string and array inputs from form fields
      const postTypeValue = Array.isArray(postType) ? postType[0] : postType;

      // Show post-specific form based on selected type
      let formName: string;
      let formTitle: string;
      let formFields: Array<{
        type: string;
        name: string;
        label: string;
        placeholder?: string;
        defaultValue?: string;
        required?: boolean;
        options?: Array<{ label: string; value: string }>;
        min?: number;
        max?: number;
      }> = [];

      switch (postTypeValue) {
        case 'pinned':
          formName = 'pinnedPostForm';
          formTitle = 'Create Pinned Post';
          formFields = [
            {
              type: 'string',
              name: 'title',
              label: 'Post Title',
              placeholder: 'Enter post title...',
              defaultValue: "Let's play Pixelary!",
              required: true,
            },
          ];
          break;
        case 'drawing':
          formName = 'drawingPostForm';
          formTitle = 'Create Drawing Post';
          formFields = [
            {
              type: 'string',
              name: 'title',
              label: 'Post Title',
              placeholder: 'Enter post title...',
              required: true,
            },
          ];
          break;
        case 'weekly-leaderboard':
          formName = 'weeklyLeaderboardForm';
          formTitle = 'Create Weekly Leaderboard';
          formFields = [
            {
              type: 'string',
              name: 'title',
              label: 'Post Title',
              placeholder: 'Enter post title...',
              required: true,
            },
          ];
          break;
        case 'weekly-collection':
          formName = 'weeklyCollectionForm';
          formTitle = 'Create Weekly Collection';
          formFields = [
            {
              type: 'select',
              name: 'timeframe',
              label: 'Timeframe',
              options: [
                { label: 'Last Week', value: 'week' },
                { label: 'Last Month', value: 'month' },
                { label: 'All Time', value: 'all' },
              ],
              defaultValue: 'week',
              required: true,
            },
            {
              type: 'number',
              name: 'limit',
              label: 'Number of Drawings',
              placeholder: '20',
              defaultValue: '20',
              min: 1,
              max: 50,
              required: true,
            },
          ];
          break;
        default:
          res.status(400).json({
            status: 'error',
            message: 'Invalid post type',
          });
          return;
      }

      res.json({
        showForm: {
          name: formName,
          form: {
            title: formTitle,
            fields: formFields,
            submitLabel: 'Create Post',
          },
        },
      });
    } catch (error) {
      console.error(`Error showing post-specific form: ${error}`);
      res.status(400).json({
        status: 'error',
        message: 'Failed to show post-specific form',
      });
    }
  }
);

router.post(
  '/internal/form/pinned-post-submit',
  async (req, res): Promise<void> => {
    try {
      console.log('Creating pinned post with body:', req.body);
      const { title } = req.body;

      if (!title) {
        console.log('No title provided in request');
        res.status(400).json({
          status: 'error',
          message: 'Post title is required',
        });
        return;
      }

      console.log(`Creating pinned post with title: "${title}"`);
      const post = await createPostWithType('pinned', title);
      console.log(`Successfully created pinned post: ${post.id}`);

      res.json({
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
      });
    } catch (error) {
      console.error(`Error creating pinned post: ${error}`);
      res.status(400).json({
        status: 'error',
        message: 'Failed to create pinned post',
      });
    }
  }
);

router.post(
  '/internal/form/weekly-leaderboard-submit',
  async (req, res): Promise<void> => {
    try {
      const { timeframe, limit } = req.body;

      if (!timeframe || !limit) {
        res.status(400).json({
          status: 'error',
          message: 'Timeframe and limit are required',
        });
        return;
      }

      const result = await createWeeklyLeaderboard(
        Array.isArray(timeframe) ? timeframe[0] : timeframe,
        Array.isArray(limit) ? limit[0] : limit
      );

      res.json({
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${result.id}`,
      });
    } catch (error) {
      console.error(`Error creating weekly leaderboard: ${error}`);
      res.status(400).json({
        status: 'error',
        message: 'Failed to create weekly leaderboard',
      });
    }
  }
);

router.post(
  '/internal/form/weekly-collection-submit',
  async (req, res): Promise<void> => {
    try {
      const { timeframe, limit } = req.body;

      if (!timeframe || !limit) {
        res.status(400).json({
          status: 'error',
          message: 'Timeframe and limit are required',
        });
        return;
      }

      const result = await createWeeklyCollection(
        context.subredditName,
        timeframe,
        parseInt(limit),
        {
          reddit: {
            getTopPosts: async (params: {
              subredditName: string;
              timeframe: string;
              limit: number;
              pageSize: number;
            }) => {
              const posts = await reddit.getTopPosts({
                subredditName: params.subredditName,
                timeframe: params.timeframe as
                  | 'week'
                  | 'month'
                  | 'all'
                  | 'hour'
                  | 'day'
                  | 'year',
                limit: params.limit,
                pageSize: params.pageSize,
              });
              return posts.children.map((post) => ({
                id: post.id,
                score: post.score,
              }));
            },
            submitPost: async (params: {
              title: string;
              subredditName: string;
              preview: string;
            }) => {
              const post = await reddit.submitPost({
                title: params.title,
                subredditName: params.subredditName,
              });
              return { id: post.id as `t3_${string}` };
            },
            submitComment: async (params: { id: string; text: string }) => {
              const comment = await reddit.submitComment({
                id: params.id,
                text: params.text,
              });
              return { id: comment.id };
            },
          },
        }
      );

      if (!result.success) {
        res.status(400).json({
          status: 'error',
          message: 'No posts found to create collection',
        });
        return;
      }

      res.json({
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${result.postId}`,
      });
    } catch (error) {
      console.error(`Error creating weekly collection: ${error}`);
      res.status(400).json({
        status: 'error',
        message: 'Failed to create weekly collection',
      });
    }
  }
);

// Edit Dictionary Form Submit
router.post(
  '/internal/form/edit-dictionary-submit',
  async (req, res): Promise<void> => {
    try {
      const { words } = req.body;

      if (!words) {
        res.status(400).json({
          status: 'error',
          message: 'Words are required',
        });
        return;
      }

      // Parse and clean words
      const wordList = words
        .split(',')
        .map((word: string) => word.trim())
        .filter((word: string) => word.length > 0)
        .map(
          (word: string) =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .sort();

      await updateDictionary(context.subredditName, wordList);

      res.json({
        showToast: 'Dictionary updated successfully!',
      });
    } catch (error) {
      console.error(`Error updating dictionary: ${error}`);
      res.status(400).json({
        status: 'error',
        message: 'Failed to update dictionary',
      });
    }
  }
);

// Banned Words Form Submit
router.post(
  '/internal/form/banned-words-submit',
  async (req, res): Promise<void> => {
    try {
      const { words } = req.body;

      if (!words) {
        res.status(400).json({
          status: 'error',
          message: 'Words are required',
        });
        return;
      }

      // Parse and clean words
      const wordList = words
        .split(',')
        .map((word: string) => word.trim())
        .filter((word: string) => word.length > 0)
        .map(
          (word: string) =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .sort();

      await updateBannedWords(context.subredditName, wordList);

      res.json({
        showToast: 'Banned words updated successfully!',
      });
    } catch (error) {
      console.error(`Error updating banned words: ${error}`);
      res.status(400).json({
        status: 'error',
        message: 'Failed to update banned words',
      });
    }
  }
);

// Edit Dictionary Menu
router.post(
  '/internal/menu/edit-dictionary',
  async (_req, res): Promise<void> => {
    try {
      const dictionary = await getDictionary(context.subredditName);

      if (!dictionary) {
        res.status(404).json({
          status: 'error',
          message: 'No dictionary found',
        });
        return;
      }

      res.json({
        showForm: {
          name: 'editDictionaryForm',
          form: {
            title: 'Community dictionary',
            description:
              'The list of drawing prompts available to Pixelary players',
            fields: [
              {
                type: 'paragraph',
                name: 'words',
                label: 'Drawing prompts',
                lineHeight: 8,
                required: true,
                defaultValue: dictionary.words.join(', '),
                placeholder: 'Apple, Banana, Cherry, ...',
                helpText: 'Separate by commas',
              },
            ],
            acceptLabel: 'Save',
            cancelLabel: 'Cancel',
          },
        },
      });
    } catch (error) {
      console.error(`Error loading dictionary: ${error}`);
      res.status(400).json({
        status: 'error',
        message: 'Failed to load dictionary',
      });
    }
  }
);

// Banned Words Menu
router.post('/internal/menu/banned-words', async (_req, res): Promise<void> => {
  try {
    const bannedWords = await getBannedWords(context.subredditName);

    res.json({
      showForm: {
        name: 'bannedWordsForm',
        form: {
          title: 'Banned words',
          description:
            'Prevent certain words from being added to the dictionary.',
          fields: [
            {
              type: 'paragraph',
              name: 'words',
              label: 'Banned words',
              lineHeight: 8,
              required: true,
              defaultValue: bannedWords.join(', '),
              placeholder: 'Meatloaf, Meat loaf, ...',
              helpText: 'Separate by commas',
            },
          ],
          acceptLabel: 'Save',
          cancelLabel: 'Cancel',
        },
      },
    });
  } catch (error) {
    console.error(`Error loading banned words: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to load banned words',
    });
  }
});

// Reveal Word Menu (Post)
router.post('/internal/menu/reveal-word', async (req, res): Promise<void> => {
  try {
    const { postId } = req.body;

    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'Post ID is required',
      });
      return;
    }

    const drawingPost = await getDrawingPost(postId);

    if (!drawingPost) {
      res.status(404).json({
        status: 'error',
        message: 'Drawing post not found',
      });
      return;
    }

    res.json({
      showToast: drawingPost.word,
    });
  } catch (error) {
    console.error(`Error revealing word: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to reveal word',
    });
  }
});

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

router.post(
  '/internal/scheduler/create-weekly-collection',
  async (req, res): Promise<void> => {
    try {
      const { subredditName, timeframe, limit } = req.body;
      await createWeeklyCollectionJob({ subredditName, timeframe, limit });
      res.json({ status: 'success' });
    } catch (error) {
      console.error(`Error in create weekly collection job: ${error}`);
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
