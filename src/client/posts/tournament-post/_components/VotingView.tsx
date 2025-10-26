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

  const { refetch: refetchPair } = trpc.app.tournament.getRandomPair.useQuery(
    { postId },
    {
      enabled: false,
      onSuccess: (data) => {
        setPair(data as [string, string]);
      },
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

  return (
    <div className="flex flex-col gap-4 items-center w-full max-w-2xl">
      <div className="grid grid-cols-2 gap-4 w-full">
        {/* Left drawing */}
        <div className="flex flex-col gap-2 items-center">
          <div className="border-2 border-gray-300 rounded p-4 aspect-square flex items-center justify-center bg-white">
            {leftDrawingData ? (
              <Drawing data={leftDrawingData.drawing} size={200} />
            ) : (
              <div className="w-full h-full bg-white-25" />
            )}
          </div>
          <Button
            onClick={() => handleVote(pair?.[0] || '', pair?.[1] || '')}
            disabled={submitVote.isPending || isLoading}
          >
            THIS ONE
          </Button>
        </div>

        {/* Right drawing */}
        <div className="flex flex-col gap-2 items-center">
          <div className="border-2 border-gray-300 rounded p-4 aspect-square flex items-center justify-center bg-white">
            {rightDrawingData ? (
              <Drawing data={rightDrawingData.drawing} size={200} />
            ) : (
              <div className="w-full h-full bg-white-25" />
            )}
          </div>
          <Button
            onClick={() => handleVote(pair?.[1] || '', pair?.[0] || '')}
            disabled={submitVote.isPending || isLoading}
          >
            THIS ONE
          </Button>
        </div>
      </div>
    </div>
  );
}
