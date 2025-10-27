import { useState, useEffect } from 'react';
import { trpc } from '@client/trpc/client';
import { getPostData } from '@client/utils/context';
import { DrawingEditor } from '@components/Editor/Editor';
import type { TournamentPostData } from '@src/shared/schema';
import { VotingView } from './_components/VotingView';
import { GalleryView } from './_components/GalleryView';
import { PixelFont } from '@components/PixelFont';
import { useToastHelpers } from '@components/ToastManager';
import { Shimmer } from '@components/Shimmer';

type TournamentState = 'loading' | 'browsing' | 'drawing' | 'submitted';
type ViewMode = 'voting' | 'gallery';

export function TournamentPost() {
  const postData = getPostData<TournamentPostData>();
  const [state, setState] = useState<TournamentState>('loading');
  const [showEditor, setShowEditor] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('voting');
  const { success: showSuccessToast } = useToastHelpers();

  const { data: tournamentData, isLoading: isLoadingTournament } =
    trpc.app.tournament.getTournament.useQuery(
      { date: postData?.date || '' },
      { enabled: !!postData?.date }
    );

  const { data: stats } = trpc.app.tournament.getStats.useQuery(
    { postId: tournamentData?.postId || '' },
    {
      enabled: !!tournamentData?.postId,
    }
  );

  useEffect(() => {
    if (isLoadingTournament) {
      setState('loading');
    } else {
      setState('browsing');
    }
  }, [isLoadingTournament]);

  const handleDrawSomething = () => {
    setShowEditor(true);
    setState('drawing');
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setState('browsing');
  };

  const handleEditorSuccess = () => {
    setShowEditor(false);
    setState('browsing');
    showSuccessToast('Submitted!', { duration: 3000 });
  };

  // Loading state
  if (state === 'loading' || !tournamentData) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <PixelFont>Loading...</PixelFont>
      </div>
    );
  }

  // Drawing state
  if (state === 'drawing' || showEditor) {
    return (
      <DrawingEditor
        onClose={handleCloseEditor}
        onSuccess={handleEditorSuccess}
        mode="tournament-comment"
        tournamentPostId={tournamentData?.postId || ''}
        tournamentWord={tournamentData?.word || ''}
      />
    );
  }

  // Show gallery/voting UI
  return (
    <div className="absolute flex flex-col gap-6 items-center justify-center h-full w-full p-6">
      {/* Conditional content */}
      {viewMode === 'voting' ? (
        <VotingView
          postId={tournamentData?.postId || ''}
          stats={stats}
          onDraw={handleDrawSomething}
          hasEnoughSubmissions={(stats?.submissionCount || 0) >= 2}
          tournamentData={tournamentData}
          onToggleView={() => setViewMode('gallery')}
        />
      ) : (
        <GalleryView
          postId={tournamentData?.postId || ''}
          stats={stats}
          onDraw={handleDrawSomething}
          onToggleView={() => setViewMode('voting')}
        />
      )}

      {/* Timed shimmer overlay */}
      <Shimmer />
    </div>
  );
}
