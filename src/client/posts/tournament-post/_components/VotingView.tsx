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

type DrawingCardProps = {
  drawing: PairDrawing | undefined;
  side: 'left' | 'right';
  animationState: AnimationState;
  winnerSide: 'left' | 'right' | null;
  onVote: () => void;
  isDisabled: boolean;
};

function DrawingCard({
  drawing,
  side,
  animationState,
  winnerSide,
  onVote,
  isDisabled,
}: DrawingCardProps) {
  // State machine states: idle -> highlighting -> exiting -> entering -> idle

  // Determine card state based on state machine
  const cardState = (() => {
    if (animationState === 'idle') return 'idle';
    if (animationState === 'highlighting') {
      return winnerSide === side ? 'highlighting-winner' : 'highlighting-loser';
    }
    if (animationState === 'exiting') {
      return winnerSide === side ? 'exiting-winner' : 'exiting-loser';
    }
    if (animationState === 'entering') return 'entering';
    return 'idle';
  })();

  // Map state to animation classes
  const getAnimationClasses = (state: string) => {
    const classes: string[] = [];

    // Side class
    classes.push(`side-${side}`);

    // State-specific classes
    switch (state) {
      case 'idle':
        // No animations
        break;

      case 'highlighting-winner':
        classes.push('is-highlighting', 'is-winner');
        classes.push('tournaments-animate-winner-highlight');
        break;

      case 'highlighting-loser':
        classes.push('is-highlighting', 'is-loser');
        classes.push('tournaments-animate-loser-fadeout');
        break;

      case 'exiting-winner':
        classes.push('is-sliding-out', 'is-winner-sliding-out');
        classes.push(
          side === 'left'
            ? 'tournaments-animate-slide-out-left'
            : 'tournaments-animate-slide-out-right'
        );
        break;

      case 'exiting-loser':
        classes.push('is-sliding-out', 'is-loser-sliding-out');
        classes.push(
          side === 'left'
            ? 'tournaments-animate-slide-out-left-loser'
            : 'tournaments-animate-slide-out-right-loser'
        );
        break;

      case 'entering':
        classes.push('is-sliding-in');
        classes.push(
          side === 'left'
            ? 'tournaments-animate-slide-in-from-left'
            : 'tournaments-animate-slide-in-from-right'
        );
        break;
    }

    return classes;
  };

  const classes = [
    'flex flex-col gap-3 items-center',
    ...getAnimationClasses(cardState),
  ].join(' ');

  return (
    <div className={classes} style={{ willChange: 'transform' }}>
      {drawing ? (
        <Drawing data={drawing.drawing} size={128} />
      ) : (
        <div className="w-32 h-32 bg-white-25" />
      )}
      <Button
        onClick={onVote}
        disabled={isDisabled}
        className="w-full"
        variant="primary"
      >
        PICK
      </Button>
    </div>
  );
}

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

        const enterTimeout = setTimeout(() => {
          setAnimationState('idle');
          setWinnerSide(null);
        }, 500);
        timeoutRefs.current.push(enterTimeout);
      }, 500); // Wait for exit slide-out to complete
      timeoutRefs.current.push(transitionTimeout);
    }
  }, [animationState, hasEnoughSubmissions, prefetchPairs]);

  // Trigger collision effect when entering the entering state
  useEffect(() => {
    if (animationState === 'entering') {
      // Trigger collision effect mid-way when cards meet (250ms = midpoint of 500ms animation)
      const collisionTimeout = setTimeout(() => {
        setShowCollision(true);
        // Auto-hide after 1.75 seconds total (0.25s delay + 1.5s collision = 1.75s)
        const hideTimeout = setTimeout(() => setShowCollision(false), 1750);
        timeoutRefs.current.push(hideTimeout);
      }, 250);
      timeoutRefs.current.push(collisionTimeout);
    }
  }, [animationState]);

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

  // Determine if buttons should be disabled
  const isButtonDisabled =
    submitVote.isPending ||
    isLoading ||
    animationState !== 'idle' ||
    !hasEnoughSubmissions;

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
      <div className="absolute flex flex-row gap-4 items-center top-4 right-4">
        {/* <IconButton onClick={onToggleView} symbol="menu" /> */}

        {/* Drawing */}
        {/* <button
          onClick={onToggleView}
          className="w-8 h-8 flex items-center justify-center cursor-pointer opacity-70 hover:opacity-100 filter grayscale-50 hover:grayscale-0 transition-all duration-300 hover:scale-115"
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 10V9H10V3H9V2H3V3H2V9H3V10H9ZM10 11H2V10H1V2H2V1H10V2H11V10H10V11Z"
              fill="#FAECD1"
            />
            <path d="M9 4H7V3H9V4Z" fill="#E1BB48" />
            <path
              d="M10 12H2V11H10V12ZM2 11H1V10H2V11ZM11 11H10V10H11V11ZM1 10H0V2H1V10ZM9 10H3V9H9V10ZM12 10H11V2H12V10ZM3 6H4V7H3V9H2V3H3V6ZM10 9H9V8H8V7H9V3H10V9ZM8 7H7V6H8V7ZM5 6H4V5H5V6ZM7 6H6V5H7V6ZM6 5H5V4H6V5ZM9 3H3V2H9V3ZM2 2H1V1H2V2ZM11 2H10V1H11V2ZM10 1H2V0H10V1Z"
              fill="black"
              fill-opacity="0.8"
            />
            <path d="M6 6H7V7H8V8H9V9H3V7H4V6H5V5H6V6Z" fill="#27AE60" />
            <path d="M7 4H9V7H8V6H7V5H6V4H5V5H4V6H3V3H7V4Z" fill="#2F80ED" />
            <path
              d="M2 2V1H4V2H3V3H2V6H1V2H2ZM9 6H8V5H9V6ZM4 4H3V3H4V4Z"
              fill="white"
              fill-opacity="0.5"
            />
            <path
              d="M11 10H10V11H2V9H3V10H9V9H10V3H9V2H11V10ZM9 9H8V8H9V9ZM8 8H7V7H8V8ZM7 7H6V6H7V7ZM6 6H5V5H6V6Z"
              fill="black"
              fill-opacity="0.3"
            />
          </svg>
        </button> */}

        {/* Gold Trophy */}
        <button
          onClick={onToggleView}
          className="w-8 h-8 flex items-center justify-center cursor-pointer opacity-70 hover:opacity-100 filter grayscale-70 hover:grayscale-0 transition-all duration-300 hover:scale-115"
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 11H3V10H9V11ZM7 9H5V7H7V9ZM9 5H8V6H4V5H3V1H9V5ZM2 4H1V2H2V4ZM11 4H10V2H11V4Z"
              fill="#F2C94C"
            />
            <path
              d="M3 11H9V10H10V12H2V10H3V11ZM10 1H12V4H11V2H10V4H11V5H10V6H9V7H8V9H9V10H3V9H4V7H3V6H2V5H1V4H2V2H1V4H0V1H2V0H10V1ZM5 9H7V7H5V9ZM3 5H4V6H8V5H9V1H3V5Z"
              fill="black"
              fill-opacity="0.8"
            />
            <path d="M5 3H4V1H5V3Z" fill="white" fill-opacity="0.5" />
            <path
              d="M9 11H7V10H9V11ZM7 9H6V7H7V9ZM8 6H7V5H8V6ZM9 5H8V1H9V5ZM11 4H10V2H11V4Z"
              fill="black"
              fill-opacity="0.3"
            />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-2 items-center justify-center">
        <PixelFont scale={3}>{word}</PixelFont>
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

      <PixelFont scale={2} className="text-primary">
        Which is better?
      </PixelFont>

      <div className="flex gap-6 items-center justify-center">
        <DrawingCard
          drawing={leftDrawing}
          side="left"
          animationState={animationState}
          winnerSide={winnerSide}
          onVote={() =>
            handleVote(
              leftDrawing?.commentId || '',
              rightDrawing?.commentId || ''
            )
          }
          isDisabled={isButtonDisabled}
        />
        <DrawingCard
          drawing={rightDrawing}
          side="right"
          animationState={animationState}
          winnerSide={winnerSide}
          onVote={() =>
            handleVote(
              rightDrawing?.commentId || '',
              leftDrawing?.commentId || ''
            )
          }
          isDisabled={isButtonDisabled}
        />
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
