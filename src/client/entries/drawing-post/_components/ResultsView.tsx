import { Button } from '@components/Button';
import { Drawing } from '@components/Drawing';
import { Lightbox } from '@components/Lightbox';
import { trpc } from '@client/trpc/client';
import { abbreviateNumber } from '@shared/utils/numbers';
import type { DrawingData } from '@shared/schema/drawing';
import { Text } from '@components/PixelFont';
import { CyclingMessage } from '@components/CyclingMessage';
import { AUTHOR_REWARD_SUBMIT } from '@shared/constants';
import { useState, useEffect, useRef } from 'react';
import { useToastHelpers } from '@components/ToastManager';
import type { PostGuesses } from '@shared/schema/pixelary';
import { useTelemetry } from '@client/hooks/useTelemetry';
import {
  requestExpandedMode,
  addWebViewModeListener,
  removeWebViewModeListener,
  navigateTo,
  context,
} from '@devvit/web/client';

type ResultsViewProps = {
  drawing: DrawingData;
  word: string;
  authorUsername?: string | undefined;
  dictionary?: string | undefined;
  currentSubreddit?: string | undefined;
  stats?: PostGuesses | null;
  isLoading?: boolean;
  postId?: string;
};

export function ResultsView({
  drawing,
  word,
  authorUsername,
  dictionary,
  currentSubreddit,
  stats,
  isLoading,
  postId,
}: ResultsViewProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const { success } = useToastHelpers();
  const { track } = useTelemetry();
  const utils = trpc.useUtils();

  // Track results view on mount
  useEffect(() => {
    void track('view_results');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warm editor caches on mount for instant editor open
  useEffect(() => {
    void utils.app.user.getProfile.prefetch();
    void utils.app.rewards.getEffectiveBonuses.prefetch();
    void utils.app.user.colors.getRecent.prefetch();
    // dictionary slate is anonymous; still helpful to warm
    void utils.app.dictionary.getCandidates.prefetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPendingNavigation = trpc.app.user.getPendingNavigation.useMutation();
  const navigationInProgressRef = useRef(false);
  const getPendingNavigationRef = useRef(getPendingNavigation);

  // Keep ref in sync with mutation
  useEffect(() => {
    getPendingNavigationRef.current = getPendingNavigation;
  }, [getPendingNavigation]);

  // Listen for expanded mode closing to handle navigation
  useEffect(() => {
    if (!context.userId) return;

    const listener = (mode: 'inline' | 'expanded') => {
      if (mode === 'inline' && !navigationInProgressRef.current) {
        navigationInProgressRef.current = true;
        void (async () => {
          try {
            const result = await getPendingNavigationRef.current.mutateAsync();
            if (result.url) {
              navigateTo(result.url);
            }
          } finally {
            // Reset after a short delay to allow navigation to complete
            setTimeout(() => {
              navigationInProgressRef.current = false;
            }, 1000);
          }
        })();
      }
    };
    addWebViewModeListener(listener);
    return () => {
      removeWebViewModeListener(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mutation for revealing guesses
  const revealGuess = trpc.app.post.revealGuess.useMutation();

  const handleGuessRowClick = async (guess: string) => {
    // Don't proceed if postId is missing
    if (!postId) {
      return;
    }

    try {
      // Send the obfuscated guess as-is (it's already in the correct format from the server)
      const trimmedGuess = guess.trim();
      if (!trimmedGuess) {
        return;
      }

      const result = await revealGuess.mutateAsync({
        postId,
        guess: trimmedGuess,
      });

      // Show toast if server revealed the guess
      if (result?.revealed && result.guess) {
        success(result.guess, { duration: 2000 });
      }
    } catch (error) {
      // Server will handle permission checks, so we can ignore errors silently
      // Log for debugging in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Error revealing guess:', error);
      }
    }
  };

  const guesses: Record<string, number> = stats?.guesses ?? {};
  const guessCount = stats?.guessCount ?? 0;
  const playerCount = stats?.playerCount ?? 0;

  // Sort guesses by count (descending) and take top 5
  const topGuesses = Object.entries(guesses)
    .filter(([, count]) => typeof count === 'number' && count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <main className="absolute inset-0 flex flex-col items-center justify-center h-full p-6 gap-6">
      {/* Header */}
      <header className="flex flex-row items-center justify-center gap-4">
        <Drawing
          data={drawing}
          size={64}
          onClick={() => {
            setIsLightboxOpen(true);
          }}
        />
        <div className="flex flex-col items-start justify-center gap-1.5">
          {/* Word */}
          <Text>{word}</Text>
          {/* Author */}
          <Text className="text-secondary">{`By u/${authorUsername}`}</Text>
        </div>
      </header>
      {/* Guess and Player Count */}
      {!isLoading ? (
        <Text>
          {`${abbreviateNumber(guessCount)} guess${guessCount !== 1 ? 'es' : ''} by ${abbreviateNumber(playerCount)} player${
            playerCount !== 1 ? 's' : ''
          }`}
        </Text>
      ) : (
        <div className="w-72 h-[14px] skeleton" />
      )}
      {/* Guesses */}
      <div className="w-full max-w-lg flex flex-col gap-2 h-full flex-1">
        {Array.from({ length: 5 }, (_, index) => {
          const guessData = topGuesses[index];
          if (guessData) {
            const [guess, count] = guessData;
            if (typeof guess === 'string' && typeof count === 'number') {
              const percentage =
                guessCount > 0 ? Math.round((count / guessCount) * 100) : 0;
              return (
                <GuessRow
                  key={`guess-${guess}-${index}`}
                  guess={guess}
                  count={count}
                  percentage={percentage}
                  onGuessClick={handleGuessRowClick}
                />
              );
            }
          }
          return <GuessRow key={`blank-${index}`} />;
        })}
      </div>
      {/* Secondary CTA */}
      <CyclingMessage
        messages={[
          'See comments for more',
          `Draw for ${AUTHOR_REWARD_SUBMIT} points`,
          'Join r/Pixelary today',
        ]}
      />
      {/* Primary CTA */}
      <Button
        onClick={async (e) => {
          try {
            await requestExpandedMode(e, 'editor');
          } catch (error) {
            console.error('Could not enter expanded mode:', error);
          }
        }}
        size="large"
        telemetryEvent="click_draw_something"
      >
        DRAW SOMETHING
      </Button>
      {/* Lightbox */}
      <Lightbox
        isOpen={isLightboxOpen}
        onClose={() => {
          setIsLightboxOpen(false);
        }}
        drawing={drawing}
        word={word}
        author={authorUsername}
      />
    </main>
  );
}

type GuessRowProps = {
  guess?: string;
  count?: number;
  percentage?: number;
  onGuessClick?: (guess: string) => void;
};

function GuessRow(props: GuessRowProps) {
  const { guess, count, percentage, onGuessClick } = props;

  // Check if this is an empty row (no data provided)
  if (guess === undefined || count === undefined || percentage === undefined) {
    return <div className="w-full h-1/5 bg-white/25" />;
  }

  const handleClick = () => {
    if (onGuessClick && guess) {
      onGuessClick(guess);
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-3 justify-between w-full h-1/5 bg-white/25 relative"
      onClick={handleClick}
    >
      <div
        className="absolute inset-y-0 left-0 bg-white transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />

      <Text className="relative">{guess}</Text>

      <div className="relative flex items-center gap-3">
        <Text className="text-tertiary">{abbreviateNumber(count)}</Text>
        <Text className="text-secondary">{`${percentage}%`}</Text>
      </div>
    </div>
  );
}
