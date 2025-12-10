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
  handleRunTournamentPayout,
  showEditMigrationForm,
  handleEditMigration,
  handleShowMigrationStatus,
  handleUpdateWordScores,
} from './menu-actions';

// Import scheduler handlers
import {
  handleUpdateDrawingPinnedComment,
  handleUserLevelUp,
  handleUserLevelClaimed,
  handleSetUserFlair,
  handleUpdateWords,
  handleTournamentScheduler,
  handleTournamentPayoutSnapshot,
  handleMigrationBatch,
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

router.post('/internal/triggers/app/install', handleAppInstall);
router.post('/internal/triggers/app/upgrade', handleAppUpgrade);
router.post('/internal/triggers/comments/create', handleCommentCreate);
router.post('/internal/triggers/comments/delete', handleCommentDelete);
router.post('/internal/triggers/comments/update', handleCommentUpdate);
router.post('/internal/triggers/test/realtime', handleTestRealtime);
router.post('/internal/triggers/test/scheduler', handleTestScheduler);

// ============================================================================
// SCHEDULER
// ============================================================================

router.post(
  '/internal/scheduler/drawings/pinned-comment/update',
  handleUpdateDrawingPinnedComment
);
router.post('/internal/scheduler/users/level-up', handleUserLevelUp);
router.post('/internal/scheduler/users/level-claimed', handleUserLevelClaimed);
router.post(
  '/internal/scheduler/tournaments/payout',
  handleTournamentPayoutSnapshot
);
router.post('/internal/scheduler/users/flair/set', handleSetUserFlair);
router.post('/internal/scheduler/words/scores/update', handleUpdateWords);
router.post('/internal/scheduler/tournaments/run', handleTournamentScheduler);
router.post('/internal/scheduler/migration/batch', handleMigrationBatch);

// ============================================================================
// MENU ACTIONS
// ============================================================================

router.post('/internal/menu-actions/posts/create', showPostSelectForm);
router.post('/internal/menu-actions/words/edit', showEditWordsForm);
router.post(
  '/internal/menu-actions/banned-words/edit',
  showEditBannedWordsForm
);
router.post(
  '/internal/menu-actions/tournaments/prompts/edit',
  showTournamentHopperForm
);
router.post('/internal/menu-actions/words/reveal', handleRevealWord);
router.post('/internal/menu-actions/users/flair/update', handleUpdateUserFlair);
router.post(
  '/internal/menu-actions/posts/pinned-comment/update',
  handleUpdatePinnedComment
);
router.post('/internal/menu-actions/telemetry/log', handleTelemetryLog);
router.post('/internal/menu-actions/telemetry/clear', handleTelemetryClear);
router.post(
  '/internal/menu-actions/slate-bandit/edit',
  showEditSlateBanditForm
);
router.post('/internal/menu-actions/users/points/set', showSetUserPointsForm);
router.post('/internal/menu-actions/users/points/get', showGetUserPointsForm);
router.post(
  '/internal/menu-actions/legacy-users/manage',
  showEditLegacyUsersForm
);
router.post(
  '/internal/menu-actions/tournaments/payout-now',
  handleRunTournamentPayout
);
router.post('/internal/menu-actions/migration/edit', showEditMigrationForm);
router.post(
  '/internal/menu-actions/migration/status',
  handleShowMigrationStatus
);
router.post(
  '/internal/menu-actions/words/scores/update',
  handleUpdateWordScores
);

// ============================================================================
// FORM HANDLERS
// ============================================================================

router.post('/internal/forms/posts/type/select', showPostDetailsForm);
router.post('/internal/forms/posts/pinned/submit', handleCreatePinnedPost);
router.post('/internal/forms/words/update', handleEditWords);
router.post('/internal/forms/banned-words/update', handleEditBannedWords);
router.post('/internal/forms/tournaments/prompts/edit', handleTournamentHopper);
router.post('/internal/forms/slate-bandit/update', handleEditSlateBandit);
router.post('/internal/forms/words/edit', handleEditWords);
router.post(
  '/internal/forms/posts/collection/submit',
  handleCreateCollectionPost
);
router.post('/internal/forms/users/points/set', handleSetUserPoints);
router.post('/internal/forms/users/points/get', handleGetUserPoints);
router.post('/internal/forms/legacy-users/update', handleEditLegacyUsers);
router.post('/internal/forms/migration/edit', handleEditMigration);
router.post(
  '/internal/forms/posts/tournament/submit',
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
  console.error('server error;', error);
});
server.listen(port);
