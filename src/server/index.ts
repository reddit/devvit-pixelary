import express from 'express';
import { createServer, getServerPort } from '@devvit/web/server';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';

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

// Import trigger handlers
import { handleAppInstall, handleAppUpgrade } from './triggers/app-lifecycle';
import {
  handleCommentCreate,
  handleCommentDelete,
} from './triggers/comment-triggers';
import {
  handleNewDrawingPinnedComment,
  handleUpdateDrawingPinnedComment,
  handleFirstSolveComment,
  handleUserLevelUp,
  handleCreatePinnedPostComment,
} from './triggers/scheduler-triggers';
import {
  handleTestRealtime,
  handleTestScheduler,
} from './triggers/test-triggers';

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
router.post('/internal/scheduler/first-solve-comment', handleFirstSolveComment);
router.post('/internal/scheduler/user-level-up', handleUserLevelUp);
router.post(
  '/internal/scheduler/create-pinned-post-comment',
  handleCreatePinnedPostComment
);

// ============================================================================
// MENU ACTIONS
// ============================================================================

router.post('/internal/menu/post-create', handlePostCreate);
router.post('/internal/menu/edit-dictionary', handleEditDictionary);
router.post('/internal/menu/banned-words', handleBannedWords);
router.post('/internal/menu/reveal-word', handleRevealWord);

// ============================================================================
// FORM HANDLERS
// ============================================================================

router.post('/internal/form/post-type-select', handlePostTypeSelect);
router.post('/internal/form/pinned-post-submit', handlePinnedPostSubmit);
router.post('/internal/form/dictionary-submit', handleDictionarySubmit);
router.post('/internal/form/banned-words-submit', handleBannedWordsSubmit);

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
