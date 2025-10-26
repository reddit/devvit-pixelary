import express from 'express';
import { createServer, getServerPort } from '@devvit/web/server';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';

// Import menu actions
import {
  handleCreatePost,
  handleEditWords,
  handleEditBannedWords,
  handleRevealWord,
  handleUpdateUserFlair,
  handleUpdatePinnedComment,
  handleTelemetryLog,
  handleTelemetryClear,
  handleSlateBandit,
  handleSetUserPoints,
  handleGetUserPoints,
} from './menu-actions';

// Import form handlers
import {
  handlePinnedPostSubmit,
  handlePostTypeSelect,
  handleWordsUpdate,
  handleBannedWordsUpdate,
  handleSlateBanditUpdate,
  handleEditWordsForm,
  handleCollectionPostSubmit,
  handleSetUserPointsForm,
  handleGetUserPointsForm,
} from './forms';

// Import scheduler handlers
import {
  handleNewDrawingPinnedComment,
  handleUpdateDrawingPinnedComment,
  handleUserLevelUp,
  handleCreatePinnedPostComment,
  handleSetUserFlair,
  handleUpdateWords,
} from './scheduler';

// Import trigger handlers
import {
  handleAppInstall,
  handleAppUpgrade,
  handleCommentCreate,
  handleCommentDelete,
  handleCommentUpdate,
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
router.post('/internal/trigger/comment-update', handleCommentUpdate);
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
router.post('/internal/scheduler/update-word-scores', handleUpdateWords);

// ============================================================================
// MENU ACTIONS
// ============================================================================

router.post('/internal/menu/create-post', handleCreatePost);
router.post('/internal/menu/edit-words', handleEditWords);
router.post('/internal/menu/edit-banned-words', handleEditBannedWords);
router.post('/internal/menu/reveal-word', handleRevealWord);
router.post('/internal/menu/update-user-flair', handleUpdateUserFlair);
router.post('/internal/menu/update-pinned-comment', handleUpdatePinnedComment);
router.post('/internal/menu/telemetry-log', handleTelemetryLog);
router.post('/internal/menu/telemetry-clear', handleTelemetryClear);
router.post('/internal/menu/slate-bandit', handleSlateBandit);
router.post('/internal/menu/set-user-points', handleSetUserPoints);
router.post('/internal/menu/get-user-points', handleGetUserPoints);

// ============================================================================
// FORM HANDLERS
// ============================================================================

router.post('/internal/form/post-type-select', handlePostTypeSelect);
router.post('/internal/form/pinned-post-submit', handlePinnedPostSubmit);
router.post('/internal/form/words-update', handleWordsUpdate);
router.post('/internal/form/banned-words-update', handleBannedWordsUpdate);
router.post('/internal/form/slate-bandit-update', handleSlateBanditUpdate);
router.post('/internal/form/edit-words', handleEditWordsForm);
router.post(
  '/internal/form/collection-post-submit',
  handleCollectionPostSubmit
);
router.post('/internal/form/set-user-points', handleSetUserPointsForm);
router.post('/internal/form/get-user-points', handleGetUserPointsForm);

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
server.on('error', (error) => {
  // Server error handling
  console.error(`server error; ${error}`);
});
server.listen(port);
