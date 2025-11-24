import { useState, useEffect, useRef } from 'react';
import { trpc } from '@client/trpc/client';
import { VotingView } from './_components/VotingView';
import { GalleryView } from './_components/GalleryView';
import { TrophyView } from './_components/TrophyView';
import { useToastHelpers } from '@components/ToastManager';
import { Shimmer } from '@components/Shimmer';
import { Confetti } from '@components/Confetti';
import { getPostData } from '@client/utils/context';
import {
  context,
  showToast,
  addWebViewModeListener,
  removeWebViewModeListener,
} from '@devvit/web/client';
import type { TournamentPostData } from '@shared/schema';

type ViewMode = 'voting' | 'gallery' | 'trophy';

export function TournamentPost() {
  // Editor launches in expanded mode now; no inline editor state
  const [viewMode, setViewMode] = useState<ViewMode>('voting');
  const [showConfetti, setShowConfetti] = useState(false);
  const showConfettiRef = useRef(false);
  const { success: showSuccessToast } = useToastHelpers();

  // Still fetch from server for validation, but don't block rendering
  const { data: tournamentData } = trpc.app.tournament.getTournament.useQuery();

  // Get data from context immediately (no loading state)
  const postData = getPostData<TournamentPostData>();
  const word = tournamentData?.word ?? postData?.word ?? '';
  const currentPostId = tournamentData?.postId ?? context.postId;

  const { data: stats, refetch: refetchStats } =
    trpc.app.tournament.getStats.useQuery(
      { postId: currentPostId },
      {
        enabled: !!currentPostId,
      }
    );

  // Prefetch user level (lightweight) so editor opens instantly
  const utils = trpc.useUtils();
  useEffect(() => {
    // Prefetch full profile in background
    void utils.app.user.getProfile.prefetch();
  }, [utils]);

  const getPendingTournamentSubmission =
    trpc.app.user.getPendingTournamentSubmission.useMutation();
  const submissionCheckInProgressRef = useRef(false);
  const hasCheckedOnMountRef = useRef(false);

  // Helper function to handle submission success
  const handleSubmissionSuccess = () => {
    if (submissionCheckInProgressRef.current) return;
    submissionCheckInProgressRef.current = true;
    showToast('Submitted!');
    showSuccessToast('Submitted!', { duration: 3000 });
    showConfettiRef.current = true;
    setShowConfetti(true);
    // Delay refetch to allow confetti to start rendering first
    setTimeout(() => {
      void refetchStats();
      submissionCheckInProgressRef.current = false;
    }, 200);
  };

  // Keep confetti visible even if state gets reset by re-renders
  useEffect(() => {
    if (showConfettiRef.current && !showConfetti) {
      setShowConfetti(true);
    }
  }, [showConfetti]);

  // Check for pending submission on mount (handles case when view reloads)
  useEffect(() => {
    if (!context.userId || hasCheckedOnMountRef.current) return;
    hasCheckedOnMountRef.current = true;
    // Small delay to ensure component is fully mounted and flag is available
    const timeoutId = setTimeout(() => {
      void (async () => {
        const result = await getPendingTournamentSubmission.mutateAsync();
        if (result.submitted) {
          handleSubmissionSuccess();
        }
      })();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for expanded mode closing (handles case when view doesn't reload)
  useEffect(() => {
    if (!context.userId) return;

    const listener = (mode: 'inline' | 'expanded') => {
      if (mode === 'inline' && !submissionCheckInProgressRef.current) {
        void (async () => {
          const result = await getPendingTournamentSubmission.mutateAsync();
          if (result.submitted) {
            handleSubmissionSuccess();
          }
        })();
      }
    };

    addWebViewModeListener(listener);
    return () => {
      removeWebViewModeListener(listener);
    };
  }, [getPendingTournamentSubmission]);

  // When there are enough submissions, prefetch initial voting pairs
  useEffect(() => {
    const enough = (stats?.submissionCount ?? 0) >= 2;
    if (enough) {
      void utils.app.tournament.getDrawingPairs.prefetch({
        postId: currentPostId,
        count: 5,
      });
    }
  }, [stats?.submissionCount, currentPostId, utils]);

  // Show gallery/voting UI
  return (
    <>
      {/* Voting view - preserve state when hidden */}
      <div className={viewMode === 'voting' ? 'absolute inset-0' : 'hidden'}>
        <div className="absolute flex flex-col gap-6 items-center justify-center h-full w-full p-6">
          <VotingView
            postId={currentPostId}
            stats={stats}
            hasEnoughSubmissions={(stats?.submissionCount ?? 0) >= 2}
            word={word}
            onToggleGallery={() => {
              setViewMode('gallery');
            }}
            onToggleTrophy={() => {
              setViewMode('trophy');
            }}
          />

          {/* Timed shimmer overlay */}
          <Shimmer />
        </div>
      </div>

      {/* Gallery view - preserve state when hidden */}
      <div className={viewMode === 'gallery' ? 'absolute inset-0' : 'hidden'}>
        <GalleryView
          postId={currentPostId}
          onToggleView={() => {
            setViewMode('voting');
          }}
          word={word}
        />
      </div>

      {/* Trophy view - preserve state when hidden */}
      <div className={viewMode === 'trophy' ? 'absolute inset-0' : 'hidden'}>
        <TrophyView
          postId={currentPostId}
          onToggleView={() => {
            setViewMode('voting');
          }}
          word={word}
        />
      </div>

      {showConfetti && <Confetti />}
    </>
  );
}
