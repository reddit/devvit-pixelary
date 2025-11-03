import { Button } from '@components/Button';
import { Icon } from '@components/PixelFont';
import { Drawing } from '@components/Drawing';
import { Lightbox } from '@components/Lightbox';
import { trpc } from '@client/trpc/client';
import { abbreviateNumber } from '@shared/utils/numbers';
import type { DrawingData } from '@shared/schema/drawing';
import { Text } from '@components/PixelFont';
import { CyclingMessage } from '@components/CyclingMessage';
import { AUTHOR_REWARD_SUBMIT } from '@shared/constants';
import { titleCase } from '@shared/utils/string';
import { useState, useEffect } from 'react';
import { useToastHelpers } from '@components/ToastManager';
import type { PostGuesses } from '@shared/schema/pixelary';
import { useTelemetry } from '@client/hooks/useTelemetry';

type ResultsViewProps = {
  drawing: DrawingData;
  word: string;
  authorUsername?: string | undefined;
  dictionary?: string | undefined;
  currentSubreddit?: string | undefined;
  onDrawSomething: () => void;
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
  onDrawSomething,
  stats,
  isLoading,
  postId,
}: ResultsViewProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const { success } = useToastHelpers();
  const { track } = useTelemetry();

  // Track results view on mount
  useEffect(() => {
    void track('view_results');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mutation for revealing guesses
  const revealGuess = trpc.app.post.revealGuess.useMutation();

  const handleGuessRowClick = async (guess: string) => {
    try {
      // Fire event for all users, server will decide if they get the reveal
      const normalizedGuess = titleCase(guess.trim());
      const result = await revealGuess.mutateAsync({
        postId: postId ?? '',
        guess: normalizedGuess,
      });

      // Show toast if server revealed the guess
      if (result.revealed) {
        success(result.guess ?? normalizedGuess, { duration: 2000 });
      }
    } catch (error) {
      // Server will handle permission checks, so we can ignore errors silently
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

  // Rendering flags
  const showTag =
    dictionary &&
    dictionary !== 'main' &&
    dictionary !== `r/${currentSubreddit}`;

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
          {/* Dictionary Tag */}
          {showTag && (
            <div className="flex items-center gap-2 text-secondary">
              <Icon type="clock" />
              <Text>{`${dictionary} event`}</Text>
            </div>
          )}
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
        onClick={onDrawSomething}
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
        author={authorUsername}
      >
        <Text scale={3}>{word}</Text>
      </Lightbox>
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
    return <div className="w-full h-1/5 bg-white-25" />;
  }

  const handleClick = () => {
    if (onGuessClick && guess) {
      onGuessClick(guess);
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-3 justify-between w-full h-1/5 bg-white-25 relative"
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
