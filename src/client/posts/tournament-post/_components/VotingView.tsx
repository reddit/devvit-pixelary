import { useState, useEffect, useRef, useCallback } from 'react';
import { trpc } from '@client/trpc/client';
import { Drawing } from '@components/Drawing';
import { Button } from '@components/Button';
import { PixelFont } from '@components/PixelFont';
import { CyclingMessage } from '@components/CyclingMessage';
import { IconButton } from '@components/IconButton';
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

  const submitVote = trpc.app.tournament.submitVote.useMutation();

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

  // Handle transition from exit to entry animation
  useEffect(() => {
    if (animationState === 'exiting') {
      // Wait for exit animation to complete (500ms), then start entry
      const transitionTimeout = setTimeout(() => {
        // Move to next pair
        setCurrentPairIndex((prev) => {
          const nextIndex = prev + 1;

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

        // Start entering animation
        setAnimationState('entering');
        const enterTimeout = setTimeout(() => {
          setAnimationState('idle');
          setWinnerSide(null);
        }, 500);
        timeoutRefs.current.push(enterTimeout);
      }, 500); // Wait for exit slide-out to complete
      timeoutRefs.current.push(transitionTimeout);
    }
  }, [animationState, pairsQueue.length, hasEnoughSubmissions, prefetchPairs]);

  const fetchInitialPairs = useCallback(async () => {
    if (!hasEnoughSubmissions) return;
    try {
      const result = await fetchPairs();
      if (result.data) {
        setPairsQueue(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch pairs:', error);
    }
  }, [fetchPairs, hasEnoughSubmissions]);

  // Get current pair from queue
  const currentPair = pairsQueue[currentPairIndex];
  const [leftDrawing, rightDrawing] = currentPair || [];

  // Fetch initial pairs only when there are enough submissions
  useEffect(() => {
    if (hasEnoughSubmissions) {
      void fetchInitialPairs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasEnoughSubmissions]);

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

    // Stage 1: Highlight winner (300ms)
    setAnimationState('highlighting');
    const highlightTimeout = setTimeout(() => {
      setAnimationState('exiting');
    }, 300);
    timeoutRefs.current.push(highlightTimeout);

    // Submit vote after highlight starts (non-blocking)
    void submitVote.mutateAsync({
      postId,
      winnerCommentId: winnerId,
      loserCommentId: loserId,
    });
  };

  // Don't show loading if we're animating - keep old content visible
  const isLoading = animationState === 'idle' && !leftDrawing && !rightDrawing;

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
    <div className="flex flex-col gap-6 items-center w-full">
      {/* Gallery toggle button */}
      <div className="absolute top-4 right-4">
        <IconButton onClick={onToggleView} symbol="menu" />
      </div>

      <div className="flex flex-col gap-2 items-center justify-center">
        <PixelFont scale={4}>{tournamentData?.word || ''}</PixelFont>
        <CyclingMessage
          messages={[
            'Drawing Challenge',
            stats && hasEnoughSubmissions
              ? formatStatsLine(stats.submissionCount, stats.playerCount)
              : 'No drawings yet',
          ]}
          className="text-tertiary"
          intervalMs={3000}
        />
      </div>

      <PixelFont scale={2.5}>Which is better?!</PixelFont>

      <div className="flex gap-6 items-center justify-center">
        {/* Left drawing */}
        <div
          className={`flex flex-col gap-3 items-center ${
            animationState === 'highlighting' && winnerSide === 'left'
              ? 'animate-pixel-winner-highlight'
              : animationState === 'highlighting' && winnerSide === 'right'
                ? 'animate-pixel-loser-fadeout'
                : ''
          } ${
            animationState === 'exiting'
              ? winnerSide === 'right'
                ? 'animate-slide-out-left-loser'
                : 'animate-slide-out-left'
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
              submitVote.isPending ||
              isLoading ||
              animationState !== 'idle' ||
              !hasEnoughSubmissions
            }
            className="w-full"
            variant="primary"
          >
            VOTE
          </Button>
        </div>

        {/* Right drawing */}
        <div
          className={`flex flex-col gap-3 items-center ${
            animationState === 'highlighting' && winnerSide === 'right'
              ? 'animate-pixel-winner-highlight'
              : animationState === 'highlighting' && winnerSide === 'left'
                ? 'animate-pixel-loser-fadeout'
                : ''
          } ${
            animationState === 'exiting'
              ? winnerSide === 'left'
                ? 'animate-slide-out-right-loser'
                : 'animate-slide-out-right'
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
              submitVote.isPending ||
              isLoading ||
              animationState !== 'idle' ||
              !hasEnoughSubmissions
            }
            className="w-full"
            variant="primary"
          >
            VOTE
          </Button>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex gap-3 items-center">
        <Button onClick={onDraw} size="large" variant="secondary">
          DRAW THE WORD
        </Button>
      </div>
    </div>
  );
}
