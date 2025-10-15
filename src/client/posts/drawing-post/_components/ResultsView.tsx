import { Button } from '@components/Button';
import { PixelSymbol } from '@components/PixelSymbol';
import { Drawing } from '@components/Drawing';
import { Lightbox } from '@components/Lightbox';
import { LevelProgressAttachment } from '@components/LevelProgressAttachment';
import { trpc } from '../../../trpc/client';
import { abbreviateNumber } from '@shared/utils/math';
import { DrawingData } from '../../../../shared/schema/drawing';
import { PixelFont } from '@components/PixelFont';
import { obfuscateString } from '@shared/utils/string';
import { useState, useEffect } from 'react';
import { useToastHelpers } from '@components/ToastManager';
import type { PostGuesses } from '../../../../shared/schema/pixelary';

interface ResultsViewProps {
  drawing: DrawingData;
  word: string;
  authorUsername?: string | undefined;
  dictionaryName?: string | undefined;
  currentSubreddit?: string | undefined;
  onDrawSomething: () => void;
  earnedPoints?: number | null;
  stats?: PostGuesses;
  isLoading?: boolean;
}

export function ResultsView({
  drawing,
  word,
  authorUsername,
  dictionaryName,
  currentSubreddit,
  onDrawSomething,
  earnedPoints,
  stats,
  isLoading,
}: ResultsViewProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const { success } = useToastHelpers();

  // Get current user profile for level progress calculation
  const { data: userProfile } = trpc.app.user.getProfile.useQuery();

  // Early return if essential data is missing
  if (!drawing || !word) {
    return (
      <main className="fixed inset-0 flex flex-col items-center justify-center h-full p-6 gap-6">
        <div className="w-full h-[14px] skeleton" />
        <div className="w-72 h-[14px] skeleton" />
        <div className="w-full max-w-lg flex flex-col gap-2 h-full flex-1">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={`loading-${index}`}
              className="w-full h-1/5 bg-white/25"
            />
          ))}
        </div>
        <div className="w-[200px] h-[14px] skeleton" />
        <div className="w-[200px] h-[40px] skeleton" />
      </main>
    );
  }

  // Show points toast when component mounts with earned points
  useEffect(() => {
    if (earnedPoints && earnedPoints > 0 && userProfile) {
      const attachment = (
        <LevelProgressAttachment
          newScore={userProfile.score}
          earnedPoints={earnedPoints}
        />
      );

      success(`+${earnedPoints} points!`, {
        duration: 2500,
        attachment,
      });
    }
  }, [earnedPoints, success, userProfile]);

  const { data: featuredCommunity, error: featuredCommunityError } =
    trpc.app.dictionary.featured.get.useQuery();

  const guesses = stats?.guesses || {};
  const guessCount = stats?.guessCount || 0;
  const playerCount = stats?.playerCount || 0;

  // Sort guesses by count (descending) and take top 5
  const topGuesses = Object.entries(guesses)
    .filter(([, count]) => typeof count === 'number' && count > 0)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5);

  // Debug logging
  if (featuredCommunityError) {
    console.error('Featured community query error:', featuredCommunityError);
  }

  // Rendering flags
  const showTag =
    dictionaryName &&
    dictionaryName !== 'main' &&
    dictionaryName !== `r/${currentSubreddit}`;

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center h-full p-6 gap-6">
      {/* Header */}
      <header className="flex flex-row items-center justify-center gap-4">
        <Drawing
          data={drawing}
          size={64}
          onClick={() => setIsLightboxOpen(true)}
        />
        <div className="flex flex-col items-start justify-center gap-1.5">
          {/* Word */}
          <PixelFont>{word}</PixelFont>
          {/* Author */}
          <PixelFont className="text-[var(--color-brand-secondary)]">
            {`By u/${authorUsername}`}
          </PixelFont>
          {/* Dictionary Tag */}
          {showTag && (
            <div className="flex items-center gap-2 text-[var(--color-brand-secondary)]">
              <PixelSymbol type="clock" />
              <PixelFont>
                {`${dictionaryName} ${
                  dictionaryName?.startsWith('r/') && featuredCommunity
                    ? 'takeover'
                    : 'event'
                }`}
              </PixelFont>
            </div>
          )}
        </div>
      </header>

      {/* Guess and Player Count */}
      {!isLoading ? (
        <PixelFont>
          {`${abbreviateNumber(guessCount)} guess${guessCount !== 1 ? 'es' : ''} by ${abbreviateNumber(playerCount)} player${
            playerCount !== 1 ? 's' : ''
          }`}
        </PixelFont>
      ) : (
        <div className="w-72 h-[14px] skeleton" />
      )}

      {/* Guesses */}
      <div className="w-full max-w-lg flex flex-col gap-2 h-full flex-1">
        {Array.from({ length: 5 }, (_, index) => {
          const guessData = topGuesses[index];
          if (guessData && guessData.length >= 2) {
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
                />
              );
            }
          }
          return <GuessRow key={`blank-${index}`} />;
        })}
      </div>

      {/* Secondary CTA */}
      <PixelFont>See comments for more!</PixelFont>

      {/* Primary CTA */}
      <Button onClick={onDrawSomething} size="large">
        DRAW SOMETHING
      </Button>

      {/* Lightbox */}
      <Lightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        drawing={drawing}
        word={word}
        author={authorUsername}
      />
    </main>
  );
}

interface GuessRowProps {
  guess?: string;
  count?: number;
  percentage?: number;
  obfuscate?: boolean;
}

function GuessRow(props: GuessRowProps) {
  const { guess, count, percentage, obfuscate = false } = props;

  // Check if this is an empty row (no data provided)
  if (guess === undefined || count === undefined || percentage === undefined) {
    return <div className="w-full h-1/5 bg-white/25" />;
  }

  return (
    <div className="flex items-center gap-3 px-3 justify-between w-full h-1/5 bg-white/25 relative">
      <div
        className={`absolute inset-y-0 left-0 bg-white transition-all duration-300 ${
          obfuscate ? 'text-[var(--color-brand-secondary)]' : ''
        }`}
        style={{ width: `${percentage}%` }}
      />

      <PixelFont className="relative">
        {obfuscate && guess ? obfuscateString(guess) : guess}
      </PixelFont>

      <div className="relative flex items-center gap-3">
        <PixelFont className="text-[var(--color-brand-tertiary)]">
          {abbreviateNumber(count)}
        </PixelFont>
        <PixelFont className="text-[var(--color-brand-secondary)]">
          {`${percentage}%`}
        </PixelFont>
      </div>
    </div>
  );
}
