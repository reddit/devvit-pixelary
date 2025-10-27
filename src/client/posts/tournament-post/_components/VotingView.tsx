import { useState, useEffect } from 'react';
import { trpc } from '@client/trpc/client';
import { Drawing } from '@components/Drawing';
import { Button } from '@components/Button';
import { PixelFont } from '@components/PixelFont';

interface VotingViewProps {
  postId: string;
}

export function VotingView({ postId }: VotingViewProps) {
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
    <div className="flex flex-col gap-4 items-center w-full max-w-2xl">
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
    </div>
  );
}
