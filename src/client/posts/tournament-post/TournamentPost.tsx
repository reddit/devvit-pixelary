import { useState, useEffect } from 'react';
import { trpc } from '@client/trpc/client';
import { DrawingEditor } from '@components/Editor/Editor';
import { VotingView } from './_components/VotingView';
import { GalleryView } from './_components/GalleryView';
import { useToastHelpers } from '@components/ToastManager';
import { Shimmer } from '@components/Shimmer';
import { getPostData } from '@client/utils/context';
import { context } from '@devvit/web/client';
import type { TournamentPostData } from '@shared/schema';

type ViewMode = 'voting' | 'gallery';

export function TournamentPost() {
  const [showEditor, setShowEditor] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('voting');
  const { success: showSuccessToast } = useToastHelpers();

  // Still fetch from server for validation, but don't block rendering
  const { data: tournamentData } = trpc.app.tournament.getTournament.useQuery();

  // Get data from context immediately (no loading state)
  const postData = getPostData<TournamentPostData>();
  const word = tournamentData?.word || postData?.word || '';
  const currentPostId = tournamentData?.postId || context.postId || '';

  const { data: stats } = trpc.app.tournament.getStats.useQuery(
    { postId: currentPostId },
    {
      enabled: !!currentPostId,
    }
  );

  // Prefetch user level (lightweight) so editor opens instantly
  const utils = trpc.useUtils();
  useEffect(() => {
    void utils.app.user.getLevel.prefetch();
    // Also prefetch full profile in background
    void utils.app.user.getProfile.prefetch();
  }, [utils]);

  const handleDrawSomething = () => {
    setShowEditor(true);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
  };

  const handleEditorSuccess = () => {
    setShowEditor(false);
    showSuccessToast('Submitted!', { duration: 3000 });
  };

  // Drawing state
  if (showEditor) {
    return (
      <DrawingEditor
        onClose={handleCloseEditor}
        onSuccess={handleEditorSuccess}
        mode="tournament-comment"
        tournamentPostId={currentPostId}
        tournamentWord={word}
      />
    );
  }

  // Show gallery/voting UI
  return (
    <>
      {/* Voting view - preserve state when hidden */}
      <div className={viewMode === 'voting' ? 'absolute inset-0' : 'hidden'}>
        <div className="absolute flex flex-col gap-6 items-center justify-center h-full w-full p-6">
          <VotingView
            postId={currentPostId}
            stats={stats}
            onDraw={handleDrawSomething}
            hasEnoughSubmissions={(stats?.submissionCount || 0) >= 2}
            word={word}
            onToggleView={() => setViewMode('gallery')}
          />

          {/* Timed shimmer overlay */}
          <Shimmer />
        </div>
      </div>

      {/* Gallery view - preserve state when hidden */}
      <div className={viewMode === 'gallery' ? 'absolute inset-0' : 'hidden'}>
        <GalleryView
          postId={currentPostId}
          onToggleView={() => setViewMode('voting')}
        />
      </div>
    </>
  );
}
