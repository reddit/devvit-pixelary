import { useState, useEffect, useRef, useCallback } from 'react';
import { trpc } from '@client/trpc/client';
import { Drawing } from '@components/Drawing';
import { Button } from '@components/Button';
import { PixelFont } from '@components/PixelFont';
import { CyclingMessage } from '@components/CyclingMessage';
import type { DrawingData } from '@shared/schema/drawing';

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
  tournamentData: { word: string; postId: string } | undefined;
  onToggleView: () => void;
}

type AnimationState = 'idle' | 'highlighting' | 'exiting' | 'entering';

type PairDrawing = {
  commentId: string;
  drawing: DrawingData;
  userId: string;
  postId: string;
};

type Pair = [PairDrawing, PairDrawing];

export function VotingView({
  postId,
  stats,
  onDraw,
  hasEnoughSubmissions,
  tournamentData,
  onToggleView,
}: VotingViewProps) {
  const [animationState, setAnimationState] = useState<AnimationState>('idle');
  const [winnerSide, setWinnerSide] = useState<'left' | 'right' | null>(null);
  const [pairsQueue, setPairsQueue] = useState<Pair[]>([]);
  const [currentPairIndex, setCurrentPairIndex] = useState(0);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isPrefetching = useRef(false);

  const {
    refetch: fetchPairs,
    error: pairsError,
    isFetching: isFetchingPairs,
  } = trpc.app.tournament.getDrawingPairs.useQuery(
    { postId, count: 5 },
    {
      enabled: false,
    }
  );

  const submitVote = trpc.app.tournament.submitVote.useMutation({
    onSuccess: () => {
      // Move to next pair
      setCurrentPairIndex((prev) => {
        const nextIndex = prev + 1;

        // Trigger entering animation
        const startEnterTimeout = setTimeout(() => {
          setAnimationState('entering');
          const enterTimeout = setTimeout(() => {
            setAnimationState('idle');
            setWinnerSide(null);
          }, 800);
          timeoutRefs.current.push(enterTimeout);
        }, 100);
        timeoutRefs.current.push(startEnterTimeout);

        // Refill queue if getting low
        if (
          nextIndex >= pairsQueue.length - 2 &&
          hasEnoughSubmissions &&
          !isPrefetching.current
        ) {
          void prefetchPairs();
        }

        return nextIndex;
      });
    },
  });

  const formatStatsLine = (submissionCount: number, playerCount: number) => {
    const drawingText = submissionCount === 1 ? 'drawing' : 'drawings';
    const playerText = playerCount === 1 ? 'player' : 'players';
    return `${submissionCount} ${drawingText} by ${playerCount} ${playerText}`;
  };

  const prefetchPairs = useCallback(async () => {
    if (isPrefetching.current) return;
    isPrefetching.current = true;

    try {
      const result = await fetchPairs();
      if (result.data) {
        setPairsQueue((prev) => [...prev, ...result.data]);
      }
    } catch (error) {
      console.error('Failed to prefetch pairs:', error);
    } finally {
      isPrefetching.current = false;
    }
  }, [fetchPairs]);

  const fetchInitialPairs = useCallback(async () => {
    try {
      const result = await fetchPairs();
      if (result.data) {
        setPairsQueue(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch pairs:', error);
    }
  }, [fetchPairs]);

  // Get current pair from queue
  const currentPair = pairsQueue[currentPairIndex];
  const [leftDrawing, rightDrawing] = currentPair || [];

  // Fetch initial pairs
  useEffect(() => {
    void fetchInitialPairs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
      timeoutRefs.current = [];
    };
  }, []);

  const handleVote = (winnerId: string, loserId: string) => {
    if (animationState !== 'idle' || !leftDrawing || !rightDrawing) return;

    // Determine winner side
    const isLeftWinner = leftDrawing.commentId === winnerId;
    setWinnerSide(isLeftWinner ? 'left' : 'right');

    // Stage 1: Highlight winner (500ms)
    setAnimationState('highlighting');
    const highlightTimeout = setTimeout(() => {
      setAnimationState('exiting');

      // Submit vote right when exit starts
      void submitVote.mutateAsync({
        postId,
        winnerCommentId: winnerId,
        loserCommentId: loserId,
      });
    }, 500);
    timeoutRefs.current.push(highlightTimeout);
  };

  // Don't show loading if we're animating - keep old content visible
  const isLoading = animationState === 'idle' && !leftDrawing && !rightDrawing;

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

  // Show error message if fetching pairs failed
  if (pairsError) {
    return (
      <div className="flex flex-col gap-4 items-center">
        <PixelFont className="text-red-500">
          {pairsError.message || 'Failed to load submissions'}
        </PixelFont>
        <Button onClick={() => void fetchPairs()} disabled={isFetchingPairs}>
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
            'Tournament',
            'Drawing Challenge',
            'Vote for Your Favorite',
          ]}
          className="text-tertiary"
          intervalMs={3000}
        />
        <PixelFont scale={4}>{tournamentData?.word || ''}</PixelFont>
      </div>

      <PixelFont scale={3}>Which is Better?</PixelFont>

      <div className="flex gap-3 items-end justify-center">
        {/* Left drawing */}
        <div
          className={`flex flex-col gap-3 items-center ${
            animationState === 'highlighting' && winnerSide === 'left'
              ? 'animate-pixel-winner-highlight'
              : ''
          } ${
            animationState === 'exiting'
              ? 'animate-slide-out-left'
              : animationState === 'entering'
                ? 'animate-slide-in-from-left'
                : ''
          }`}
          style={{ willChange: 'transform' }}
        >
          {leftDrawing ? (
            <Drawing data={leftDrawing.drawing} size={128} />
          ) : (
            <div className="w-32 h-32 bg-white-25" />
          )}
          <Button
            onClick={() =>
              handleVote(
                leftDrawing?.commentId || '',
                rightDrawing?.commentId || ''
              )
            }
            disabled={
              submitVote.isPending || isLoading || animationState !== 'idle'
            }
            className="w-full"
            variant="secondary"
          >
            VOTE
          </Button>
        </div>

        {/* "or" text */}
        <PixelFont className="text-secondary mb-[13px]">or</PixelFont>

        {/* Right drawing */}
        <div
          className={`flex flex-col gap-3 items-center ${
            animationState === 'highlighting' && winnerSide === 'right'
              ? 'animate-pixel-winner-highlight'
              : ''
          } ${
            animationState === 'exiting'
              ? 'animate-slide-out-right'
              : animationState === 'entering'
                ? 'animate-slide-in-from-right'
                : ''
          }`}
          style={{ willChange: 'transform' }}
        >
          {rightDrawing ? (
            <Drawing data={rightDrawing.drawing} size={128} />
          ) : (
            <div className="w-32 h-32 bg-white-25" />
          )}
          <Button
            onClick={() =>
              handleVote(
                rightDrawing?.commentId || '',
                leftDrawing?.commentId || ''
              )
            }
            disabled={
              submitVote.isPending || isLoading || animationState !== 'idle'
            }
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
