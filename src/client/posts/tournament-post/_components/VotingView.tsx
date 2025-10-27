import { useState, useEffect } from 'react';
import { trpc } from '@client/trpc/client';
import { Drawing } from '@components/Drawing';
import { Button } from '@components/Button';
import { PixelFont } from '@components/PixelFont';
import { CyclingMessage } from '@components/CyclingMessage';

interface VotingViewProps {
  postId: string;
  stats:
    | {
        submissionCount: number;
        playerCount: number;
      }
    | undefined;
  onDraw: () => void;
  hasEnoughSubmissions: boolean;
  tournamentData: { word: string; date: string } | undefined;
  onToggleView: () => void;
}

export function VotingView({
  postId,
  stats,
  onDraw,
  hasEnoughSubmissions,
  tournamentData,
  onToggleView,
}: VotingViewProps) {
  const [pair, setPair] = useState<[string, string] | null>(null);

  const {
    refetch: refetchPair,
    error: pairError,
    isFetching: isFetchingPair,
    data: pairData,
  } = trpc.app.tournament.getRandomPair.useQuery(
    { postId },
    {
      enabled: false,
    }
  );

  const submitVote = trpc.app.tournament.submitVote.useMutation({
    onSuccess: () => {
      // Fetch next pair after voting
      void refetchPair();
    },
  });

  const formatStatsLine = (submissionCount: number, playerCount: number) => {
    const drawingText = submissionCount === 1 ? 'drawing' : 'drawings';
    const playerText = playerCount === 1 ? 'player' : 'players';
    return `${submissionCount} ${drawingText} by ${playerCount} ${playerText}`;
  };

  // Fetch drawings for the pair
  const { data: leftDrawingData } =
    trpc.app.tournament.getCommentDrawing.useQuery(
      { commentId: pair?.[0] || '' },
      { enabled: !!pair?.[0] }
    );

  const { data: rightDrawingData } =
    trpc.app.tournament.getCommentDrawing.useQuery(
      { commentId: pair?.[1] || '' },
      { enabled: !!pair?.[1] }
    );

  // Sync pairData to pair state
  useEffect(() => {
    if (pairData && !pair) {
      // Validate that pairData is an array with 2 elements
      if (Array.isArray(pairData) && pairData.length === 2) {
        setPair(pairData as [string, string]);
      }
    }
  }, [pairData, pair]);

  // Fetch initial pair
  useEffect(() => {
    void refetchPair();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVote = (winnerId: string, loserId: string) => {
    if (!pair) return;

    void submitVote.mutateAsync({
      postId,
      winnerCommentId: winnerId,
      loserCommentId: loserId,
    });
  };

  const isLoading = !pair || !leftDrawingData || !rightDrawingData;

  // Show "not enough submissions" state
  if (!hasEnoughSubmissions) {
    return (
      <div className="flex flex-col gap-4 items-center">
        <PixelFont>Not enough submissions yet</PixelFont>
        <Button onClick={onDraw} size="large">
          DRAW THE WORD
        </Button>
      </div>
    );
  }

  // Show error message if fetching pair failed
  if (pairError) {
    return (
      <div className="flex flex-col gap-4 items-center">
        <PixelFont className="text-red-500">
          {pairError.message || 'Failed to load submissions'}
        </PixelFont>
        <Button onClick={() => void refetchPair()} disabled={isFetchingPair}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 items-center w-full max-w-2xl">
      {/* Header with view toggle */}
      <div className="absolute top-6 right-6">
        <Button onClick={onToggleView} size="medium" variant="secondary">
          GALLERY
        </Button>
      </div>

      <div className="flex flex-col gap-2 items-center justify-center">
        <CyclingMessage
          messages={[
            new Date(tournamentData?.date || '').toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            }),
            'Word of the Day',
            'Drawing Challenge',
          ]}
          className="text-tertiary"
          intervalMs={3000}
        />
        <PixelFont scale={4}>{tournamentData?.word || ''}</PixelFont>
      </div>

      <PixelFont scale={3}>Which is Better?</PixelFont>

      <div className="flex gap-3 items-end justify-center">
        {/* Left drawing */}
        <div className="flex flex-col gap-3 items-center">
          {leftDrawingData ? (
            <Drawing data={leftDrawingData.drawing} size={128} />
          ) : (
            <div className="w-32 h-32 bg-white-25" />
          )}
          <Button
            onClick={() => handleVote(pair?.[0] || '', pair?.[1] || '')}
            disabled={submitVote.isPending || isLoading}
            className="w-full"
            variant="secondary"
          >
            VOTE
          </Button>
        </div>

        {/* "or" text */}
        <PixelFont className="text-secondary mb-[13px]">or</PixelFont>

        {/* Right drawing */}
        <div className="flex flex-col gap-3 items-center">
          {rightDrawingData ? (
            <Drawing data={rightDrawingData.drawing} size={128} />
          ) : (
            <div className="w-32 h-32 bg-white-25" />
          )}
          <Button
            onClick={() => handleVote(pair?.[1] || '', pair?.[0] || '')}
            disabled={submitVote.isPending || isLoading}
            className="w-full"
            variant="secondary"
          >
            VOTE
          </Button>
        </div>
      </div>

      {stats !== undefined && (
        <>
          <PixelFont scale={2} className="text-tertiary">
            {formatStatsLine(stats.submissionCount, stats.playerCount)}
          </PixelFont>
          <Button onClick={onDraw} size="large">
            I CAN DO BETTER
          </Button>
        </>
      )}
    </div>
  );
}
