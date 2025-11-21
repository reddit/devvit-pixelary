import { useState, useEffect, useRef, useCallback } from 'react';
import { trpc } from '@client/trpc/client';
import { Drawing } from '@components/Drawing';
import { Button } from '@components/Button';
import { Text } from '@components/PixelFont';
import { CyclingMessage } from '@components/CyclingMessage';
import { requestExpandedMode } from '@devvit/web/client';
import { Collision } from '@components/Collision';
import type { DrawingData } from '@shared/schema/drawing';
import { ActiveEffectsBadge } from '@components/ActiveEffectsBadge';
import { Drawings, Trophy } from '@components/illustrations';

type VotingViewProps = {
  postId: string;
  stats:
    | {
        submissionCount: number;
        playerCount: number;
      }
    | undefined;
  hasEnoughSubmissions: boolean;
  word: string;
  onToggleGallery: () => void;
  onToggleTrophy: () => void;
};

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
    switch (animationState) {
      case 'idle':
        return 'idle';
      case 'highlighting':
        return winnerSide === side
          ? 'highlighting-winner'
          : 'highlighting-loser';
      case 'exiting':
        return winnerSide === side ? 'exiting-winner' : 'exiting-loser';
      case 'entering':
        return 'entering';
      default:
        return 'idle';
    }
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
    'drawing-card flex flex-col gap-3 items-center',
    ...getAnimationClasses(cardState),
  ].join(' ');

  return (
    <div className={classes} style={{ willChange: 'transform' }}>
      {drawing ? (
        <Drawing
          data={drawing.drawing}
          size={136}
          className={
            animationState === 'idle' ? 'tournaments-animate-attract' : ''
          }
          {...(!isDisabled ? { onClick: onVote } : {})}
        />
      ) : (
        <div className="w-34 h-34 skeleton" />
      )}
    </div>
  );
}

export function VotingView({
  postId,
  stats,
  hasEnoughSubmissions,
  word,
  onToggleGallery,
  onToggleTrophy,
}: VotingViewProps) {
  const [animationState, setAnimationState] = useState<AnimationState>('idle');
  const [winnerSide, setWinnerSide] = useState<'left' | 'right' | null>(null);
  const [pairsQueue, setPairsQueue] = useState<Pair[]>([]);
  const [currentPairIndex, setCurrentPairIndex] = useState<number>(0);
  const [showCollision, setShowCollision] = useState(false);
  const timeoutRefs = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const isPrefetching = useRef(false);
  const trackedViews = useRef<Set<string>>(new Set());

  const {
    refetch: fetchPairs,
    error: pairsError,
    isFetching: isFetchingPairs,
  } = trpc.app.tournament.getDrawingPairs.useQuery(
    { postId, count: 5 },
    { enabled: false }
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
      }, 500);
      timeoutRefs.current.push(transitionTimeout);
    }
  }, [animationState, hasEnoughSubmissions, prefetchPairs, pairsQueue.length]);

  // Trigger collision effect when entering the entering state
  useEffect(() => {
    if (animationState === 'entering') {
      const collisionTimeout = setTimeout(() => {
        setShowCollision(true);
        const hideTimeout = setTimeout(() => {
          setShowCollision(false);
        }, 1750);
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
  const [leftDrawing, rightDrawing] = currentPair ?? [];

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

  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      timeoutRefs.current = [];
    };
  }, []);

  const handleVote = (winnerId: string, loserId: string) => {
    if (animationState !== 'idle' || !leftDrawing || !rightDrawing) return;
    const isLeftWinner = leftDrawing.commentId === winnerId;
    setWinnerSide(isLeftWinner ? 'left' : 'right');
    setAnimationState('highlighting');
    const highlightTimeout = setTimeout(() => {
      setAnimationState('exiting');
    }, 300);
    timeoutRefs.current.push(highlightTimeout);
    void submitVote.mutateAsync({
      postId,
      winnerCommentId: winnerId,
      loserCommentId: loserId,
    });
  };

  const isLoading = animationState === 'idle' && !leftDrawing && !rightDrawing;
  const isButtonDisabled =
    submitVote.isPending ||
    isLoading ||
    animationState !== 'idle' ||
    !hasEnoughSubmissions;

  if (pairsError) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 w-full h-full">
        <div className="flex flex-col items-center justify-center gap-2">
          <Text scale={3}>Error</Text>
          <Text className="text-secondary">
            {pairsError.message || 'Failed to load submissions'}
          </Text>
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
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 w-full h-full">
      <ActiveEffectsBadge />
      <div className="absolute flex flex-row gap-4 items-center top-4 right-4">
        <button
          onClick={onToggleGallery}
          className="w-8 h-8 flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-115 active:scale-90"
        >
          <Drawings size={24} />
        </button>
        <button
          onClick={onToggleTrophy}
          className="w-8 h-8 flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-115 active:scale-90"
        >
          <Trophy size={24} variant="gold" />
        </button>
      </div>

      <div className="flex flex-col gap-2 items-center justify-center">
        <Text scale={3}>{word}</Text>
        <CyclingMessage
          messages={[
            'Drawing tournament',
            stats && hasEnoughSubmissions
              ? formatStatsLine(stats.submissionCount, stats.playerCount)
              : 'Waiting for entries',
          ]}
          className="text-secondary"
          intervalMs={2000}
        />
      </div>

      <div className="tournaments-attract-group flex gap-6 items-center justify-center">
        <DrawingCard
          drawing={leftDrawing}
          side="left"
          animationState={animationState}
          winnerSide={winnerSide}
          onVote={() => {
            handleVote(
              leftDrawing?.commentId ?? '',
              rightDrawing?.commentId ?? ''
            );
          }}
          isDisabled={isButtonDisabled}
        />
        <DrawingCard
          drawing={rightDrawing}
          side="right"
          animationState={animationState}
          winnerSide={winnerSide}
          onVote={() => {
            handleVote(
              rightDrawing?.commentId ?? '',
              leftDrawing?.commentId ?? ''
            );
          }}
          isDisabled={isButtonDisabled}
        />
      </div>

      <div className="flex flex-col gap-3 items-center">
        <Text scale={2} className="text-secondary">
          {hasEnoughSubmissions
            ? 'Pick the best, or ...'
            : 'Wait for entries, or ...'}
        </Text>
        <Button
          onClick={async (e) => {
            void requestExpandedMode(e, 'editor');
          }}
          size="large"
          variant="primary"
        >
          ADD A DRAWING
        </Button>
      </div>

      {showCollision && <Collision />}
    </div>
  );
}
