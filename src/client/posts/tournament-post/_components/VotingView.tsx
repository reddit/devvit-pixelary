import { useState, useEffect, useRef, useCallback } from 'react';
import { trpc } from '@client/trpc/client';
import { Drawing } from '@components/Drawing';
import { Button } from '@components/Button';
import { PixelFont } from '@components/PixelFont';
import { CyclingMessage } from '@components/CyclingMessage';
import { IconButton } from '@components/IconButton';
import { Collision } from '@components/Collision';
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
  word: string;
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
  word,
  onToggleView,
}: VotingViewProps) {
  const [animationState, setAnimationState] = useState<AnimationState>('idle');
  const [winnerSide, setWinnerSide] = useState<'left' | 'right' | null>(null);
  const [pairsQueue, setPairsQueue] = useState<Pair[]>([]);
  const [currentPairIndex, setCurrentPairIndex] = useState(0);
  const [showCollision, setShowCollision] = useState(false);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isPrefetching = useRef(false);
  const trackedViews = useRef<Set<string>>(new Set());

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
  const incrementViews = trpc.app.tournament.incrementViews.useMutation();

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

        // Trigger collision effect mid-way when cards meet
        const collisionTimeout = setTimeout(() => {
          setShowCollision(true);
          // Auto-hide after effect completes
          const hideTimeout = setTimeout(() => setShowCollision(false), 2500);
          timeoutRefs.current.push(hideTimeout);
        }, 250); // 50% of 500ms - midpoint of animation
        timeoutRefs.current.push(collisionTimeout);

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

  // Track views when drawings are displayed (only once per pair)
  useEffect(() => {
    if (leftDrawing && rightDrawing && animationState === 'idle') {
      // Track views for both drawings when they're first displayed
      if (!trackedViews.current.has(leftDrawing.commentId)) {
        trackedViews.current.add(leftDrawing.commentId);
        void incrementViews.mutateAsync({ commentId: leftDrawing.commentId });
      }
      if (!trackedViews.current.has(rightDrawing.commentId)) {
        trackedViews.current.add(rightDrawing.commentId);
        void incrementViews.mutateAsync({ commentId: rightDrawing.commentId });
      }
    }
  }, [leftDrawing, rightDrawing, animationState, incrementViews]);

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
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 w-full h-full">
        <div className="flex flex-col items-center justify-center gap-2">
          <PixelFont scale={3}>Error</PixelFont>
          <PixelFont className="text-secondary">
            {pairsError.message || 'Failed to load submissions'}
          </PixelFont>
        </div>
        <Button
          size="large"
          onClick={() => void fetchPairs()}
          disabled={isFetchingPairs}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 w-full h-full">
      {/* Gallery toggle button */}
      <div className="absolute top-4 right-4">
        <IconButton onClick={onToggleView} symbol="menu" />
      </div>

      <div className="flex flex-col gap-2 items-center justify-center">
        <PixelFont scale={4}>{word}</PixelFont>
        <CyclingMessage
          messages={[
            'Drawing Tournament',
            stats && hasEnoughSubmissions
              ? formatStatsLine(stats.submissionCount, stats.playerCount)
              : 'Waiting for entries',
          ]}
          className="text-tertiary"
          intervalMs={3000}
        />
      </div>

      <PixelFont scale={2.5}>Which is better?</PixelFont>

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
            PICK
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
            PICK
          </Button>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex gap-3 items-center">
        <Button onClick={onDraw} size="large" variant="secondary">
          DRAW THE WORD
        </Button>
      </div>

      {/* Collision effect overlay */}
      {showCollision && <Collision />}
    </div>
  );
}
