import { useState, useEffect } from 'react';
import { trpc } from '@client/trpc/client';
import { getPostData } from '@client/utils/context';
import { DrawingEditor } from '@components/Editor/Editor';
import type { TournamentPostData } from '@src/shared/schema';
import { VotingView } from './_components/VotingView';
import { PixelFont } from '@components/PixelFont';
import { Button } from '@components/Button';
import { useToastHelpers } from '@components/ToastManager';
import { CyclingMessage } from '@components/CyclingMessage';

type TournamentState = 'loading' | 'browsing' | 'drawing' | 'submitted';

export function TournamentPost() {
  const postData = getPostData<TournamentPostData>();
  const [state, setState] = useState<TournamentState>('loading');
  const [showEditor, setShowEditor] = useState(false);
  const { success: showSuccessToast } = useToastHelpers();

  const { data: tournamentData, isLoading: isLoadingTournament } =
    trpc.app.tournament.getTournament.useQuery(
      { date: postData?.date || '' },
      { enabled: !!postData?.date }
    );

  const { data: userSubmission } =
    trpc.app.tournament.getUserSubmission.useQuery(
      {
        postId: tournamentData?.postId || '',
      },
      {
        enabled: !!tournamentData?.postId,
      }
    );

  const { data: stats } = trpc.app.tournament.getStats.useQuery(
    { postId: tournamentData?.postId || '' },
    {
      enabled: !!tournamentData?.postId,
    }
  );

  const formatStatsLine = (submissionCount: number, playerCount: number) => {
    const drawingText = submissionCount === 1 ? 'drawing' : 'drawings';
    const playerText = playerCount === 1 ? 'player' : 'players';
    return `${submissionCount} ${drawingText} by ${playerCount} ${playerText}`;
  };

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

  const hasEnoughSubmissions = (stats?.submissionCount || 0) >= 2;

  // Show word and voting UI
  return (
    <div className="absolute flex flex-col gap-6 items-center justify-center h-full w-full p-6">
      <div className="flex flex-col gap-2 items-center justify-center">
        <CyclingMessage
          messages={[
            'Word of the Day',
            'Drawing Challenge',
            new Date(tournamentData?.date || '').toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            }),
          ]}
          className="text-secondary"
          intervalMs={3000}
        />
        <PixelFont scale={4}>{tournamentData?.word}</PixelFont>
      </div>

      <PixelFont scale={3}>Which is Better?</PixelFont>

      {!hasEnoughSubmissions || !stats ? (
        <div className="flex flex-col gap-4 items-center">
          <PixelFont>Not enough submissions yet</PixelFont>
          <Button onClick={handleDrawSomething} size="large">
            DRAW WORD
          </Button>
        </div>
      ) : (
        <>
          <VotingView postId={tournamentData?.postId || ''} />
          <PixelFont scale={2} className="text-tertiary">
            {formatStatsLine(stats.submissionCount, stats.playerCount)}
          </PixelFont>
          <Button onClick={handleDrawSomething} size="large">
            DRAW WORD
          </Button>
        </>
      )}
    </div>
  );
}
