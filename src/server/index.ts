import express from 'express';
import { createServer, getServerPort } from '@devvit/web/server';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';

// Import menu actions
import {
  handlePostCreate,
  handleEditDictionary,
  handleBannedWords,
  handleRevealWord,
  handleSetMyFlair,
  handleUpdateComment,
  handleLogTelemetryKey,
  handleClearDailyTelemetry,
  handleSlateEventsCount,
  handleSlateEventsProcess,
  handleSlateEventsClear,
} from './menu-actions';

// Import form handlers
import {
  handlePinnedPostSubmit,
  handlePostTypeSelect,
  handleWordsUpdate,
  handleBannedWordsUpdate,
} from './forms';

// Import scheduler handlers
import {
  handleNewDrawingPinnedComment,
  handleUpdateDrawingPinnedComment,
  handleUserLevelUp,
  handleCreatePinnedPostComment,
  handleSetUserFlair,
  handleSlateAggregator,
} from './scheduler';

// Import trigger handlers
import {
  handleAppInstall,
  handleAppUpgrade,
  handleCommentCreate,
  handleCommentDelete,
  handleTestRealtime,
  handleTestScheduler,
} from './triggers';

const app = express();

// Middleware
app.use(express.json()); // JSON body parsing
app.use(express.urlencoded({ extended: true })); // URL-encoded body parsing
app.use(express.text()); // plain text body parsing

const router = express.Router();

// ============================================================================
// TRIGGERS
// ============================================================================

router.post('/internal/trigger/app-install', handleAppInstall);
router.post('/internal/trigger/app-upgrade', handleAppUpgrade);
router.post('/internal/trigger/comment-create', handleCommentCreate);
router.post('/internal/trigger/comment-delete', handleCommentDelete);
router.post('/internal/trigger/test-realtime', handleTestRealtime);
router.post('/internal/trigger/test-scheduler', handleTestScheduler);

// ============================================================================
// SCHEDULER
// ============================================================================

router.post(
  '/internal/scheduler/new-drawing-pinned-comment',
  handleNewDrawingPinnedComment
);
router.post(
  '/internal/scheduler/update-drawing-pinned-comment',
  handleUpdateDrawingPinnedComment
);
router.post('/internal/scheduler/user-level-up', handleUserLevelUp);
router.post(
  '/internal/scheduler/create-pinned-post-comment',
  handleCreatePinnedPostComment
);
router.post('/internal/scheduler/set-user-flair', handleSetUserFlair);
router.post('/internal/scheduler/slate-aggregator', handleSlateAggregator);

// ============================================================================
// MENU ACTIONS
// ============================================================================

router.post('/internal/menu/post-create', handlePostCreate);
router.post('/internal/menu/edit-dictionary', handleEditDictionary);
router.post('/internal/menu/banned-words', handleBannedWords);
router.post('/internal/menu/reveal-word', handleRevealWord);
router.post('/internal/menu/set-my-flair', handleSetMyFlair);
router.post('/internal/menu/update-comment', handleUpdateComment);
router.post('/internal/menu/log-daily-telemetry', handleLogTelemetryKey);
router.post('/internal/menu/clear-daily-telemetry', handleClearDailyTelemetry);
router.post('/internal/menu/slate-events-count', handleSlateEventsCount);
router.post('/internal/menu/slate-events-process', handleSlateEventsProcess);
router.post('/internal/menu/slate-events-clear', handleSlateEventsClear);

// ============================================================================
// FORM HANDLERS
// ============================================================================

router.post('/internal/form/post-type-select', handlePostTypeSelect);
router.post('/internal/form/pinned-post-submit', handlePinnedPostSubmit);
router.post('/internal/form/words-update', handleWordsUpdate);
router.post('/internal/form/banned-words-update', handleBannedWordsUpdate);

// Use router middleware
app.use(router);

// Mount tRPC
app.use(
  '/api/trpc',
  createExpressMiddleware({ router: appRouter, createContext })
);

// Get port, create, and start the server
const port = getServerPort();
const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
