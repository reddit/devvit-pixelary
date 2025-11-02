import express from 'express';
import { createServer, getServerPort } from '@devvit/web/server';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';

// Import menu actions and associated handlers
import {
  showPostSelectForm,
  showPostDetailsForm,
  handleCreateCollectionPost,
  handleCreatePinnedPost,
  handleCreateTournamentPost,
  handleEditBannedWords,
  showEditBannedWordsForm,
  handleEditLegacyUsers,
  showEditLegacyUsersForm,
  handleEditSlateBandit,
  showEditSlateBanditForm,
  handleEditWords,
  showEditWordsForm,
  handleTournamentHopper,
  showTournamentHopperForm,
  handleUpdatePinnedComment,
  handleGetUserPoints,
  showGetUserPointsForm,
  handleSetUserPoints,
  showSetUserPointsForm,
  handleRevealWord,
  handleTelemetryClear,
  handleTelemetryLog,
  handleUpdateUserFlair,
} from './menu-actions';

// Import scheduler handlers
import {
  handleNewDrawingPinnedComment,
  handleUpdateDrawingPinnedComment,
  handleUserLevelUp,
  handleUserLevelClaimed,
  handleCreatePinnedPostComment,
  handleSetUserFlair,
  handleUpdateWords,
  handleCreateTournamentPostComment,
  handleTournamentScheduler,
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
router.post('/internal/scheduler/user-level-claimed', handleUserLevelClaimed);
router.post(
  '/internal/scheduler/create-pinned-post-comment',
  handleCreatePinnedPostComment
);
router.post(
  '/internal/scheduler/create-tournament-post-comment',
  handleCreateTournamentPostComment
);
router.post('/internal/scheduler/set-user-flair', handleSetUserFlair);
router.post('/internal/scheduler/update-word-scores', handleUpdateWords);
router.post(
  '/internal/scheduler/run-tournament-scheduler',
  handleTournamentScheduler
);

// ============================================================================
// MENU ACTIONS
// ============================================================================

router.post('/internal/menu/create-post', showPostSelectForm);
router.post('/internal/menu/edit-words', showEditWordsForm);
router.post('/internal/menu/edit-banned-words', showEditBannedWordsForm);
router.post('/internal/menu/edit-tournament-prompts', showTournamentHopperForm);
router.post('/internal/menu/reveal-word', handleRevealWord);
router.post('/internal/menu/update-user-flair', handleUpdateUserFlair);
router.post('/internal/menu/update-pinned-comment', handleUpdatePinnedComment);
router.post('/internal/menu/telemetry-log', handleTelemetryLog);
router.post('/internal/menu/telemetry-clear', handleTelemetryClear);
router.post('/internal/menu/slate-bandit', showEditSlateBanditForm);
router.post('/internal/menu/set-user-points', showSetUserPointsForm);
router.post('/internal/menu/get-user-points', showGetUserPointsForm);
router.post('/internal/menu/legacy-users', showEditLegacyUsersForm);

// ============================================================================
// FORM HANDLERS
// ============================================================================

router.post('/internal/form/post-type-select', showPostDetailsForm);
router.post('/internal/form/pinned-post-submit', handleCreatePinnedPost);
router.post('/internal/form/words-update', handleEditWords);
router.post('/internal/form/banned-words-update', handleEditBannedWords);
router.post('/internal/form/edit-tournament-prompts', handleTournamentHopper);
router.post('/internal/form/slate-bandit-update', handleEditSlateBandit);
router.post('/internal/form/edit-words', handleEditWords);
router.post(
  '/internal/form/collection-post-submit',
  handleCreateCollectionPost
);
router.post('/internal/form/set-user-points', handleSetUserPoints);
router.post('/internal/form/get-user-points', handleGetUserPoints);
router.post('/internal/form/legacy-users-update', handleEditLegacyUsers);
router.post(
  '/internal/form/tournament-post-submit',
  handleCreateTournamentPost
);

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
