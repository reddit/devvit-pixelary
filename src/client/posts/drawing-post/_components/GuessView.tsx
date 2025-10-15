import { useState, useRef } from 'react';
import { Button } from '@components/Button';
import { Drawing } from '@components/Drawing';
import { Shimmer } from '@components/Shimmer';
import { DrawingData } from '../../../../shared/schema/drawing';
import { PixelInput } from '@components/PixelInput';
import { useToastHelpers } from '@components/ToastManager';
import { PixelFont } from '@components/PixelFont';
import type { PostGuesses } from '../../../../shared/schema/pixelary';

interface GuessViewProps {
  drawing: DrawingData;
  onGuess: (guess: string, createComment: boolean) => Promise<void>;
  onGiveUp: () => Promise<void>;
  feedback?: boolean | null;
  stats?: PostGuesses;
  isLoading?: boolean;
}

export function GuessView({
  drawing,
  onGuess,
  onGiveUp,
  feedback,
  stats,
  isLoading,
}: GuessViewProps) {
  const [guess, setGuess] = useState('');
  const [createComment, setCreateComment] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { warning } = useToastHelpers();

  const handleGuessSubmit = async () => {
    if (!guess.trim()) {
      warning('Please enter a guess!', { duration: 2000 });
      return;
    }

    try {
      await onGuess(guess.trim().toLowerCase(), createComment);
      setGuess('');
      setCreateComment(false);

      // Restore focus to input field after submission
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error('Failed to submit guess:', error);
    }
  };

  const playerCount = stats?.playerCount || 0;
  const correctGuessCount = stats?.guessCount || 0;
  const solvePercentage =
    playerCount > 0 ? Math.round((correctGuessCount / playerCount) * 100) : 0;

  return (
    <main className="absolute inset-0 flex flex-col items-center justify-evenly px-5">
      {/* Drawing */}
      <div className="relative h-64 w-64 flex items-center justify-center">
        <Drawing
          data={drawing}
          size={256}
          enableBreathing={true}
          isPaused={feedback === false}
        />
        {/* Feedback overlay - covers whole game area */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-[#ff4500]/70 transition-opacity pointer-events-none ${
            feedback === false ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Pixel X - Scaled to align with canvas grid */}
          <svg
            width="160"
            height="160"
            viewBox="0 0 10 10"
            className="animate-incorrect-guess"
          >
            <path
              d="M2 1H3V2H4V3H6V2H7V1H8V0H10V2H9V3H8V4H7V6H8V7H9V8H10V10H8V9H7V8H6V7H4V8H3V9H2V10H0V8H1V7H2V6H3V4H2V3H1V2H0V0H2V1Z"
              fill="white"
            />
          </svg>
        </div>
      </div>

      {/* Player Count */}
      <div className="w-full flex flex-col gap-2 items-center justify-center">
        {!isLoading ? (
          <PixelFont scale={2.5}>
            {`${playerCount.toLocaleString()} player${
              playerCount !== 1 ? 's' : ''
            } tried`}
          </PixelFont>
        ) : (
          <div className="w-[232.5px] h-[17.5px] skeleton" />
        )}
        {!isLoading ? (
          <PixelFont className="text-[var(--color-brand-secondary)]">
            {`${solvePercentage}% solved it`}
          </PixelFont>
        ) : (
          <div className="w-[156px] h-[14px] skeleton" />
        )}
      </div>

      {/* Guess Button */}
      <div className="w-full flex flex-row gap-3 items-center justify-center max-w-xs">
        <PixelInput
          ref={inputRef}
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              void handleGuessSubmit();
            }
          }}
          placeholderPhrases={['My guess...', 'Bird?', 'Plane?']}
        />
        <Button onClick={() => void handleGuessSubmit()} size="large">
          SEND
        </Button>
      </div>

      {/* Give Up Button */}
      <button
        onClick={onGiveUp}
        className="flex items-center justify-center cursor-pointer"
      >
        <svg
          width="144"
          height="34"
          viewBox="0 0 144 34"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M12 8H10V20H12V8Z M24 24H26.0498V26H24V24Z M28.0371 24H30.1368V26H28.0371V24Z M32.1241 24H34.2238V26H32.1241V24Z M36.211 24H38.3107V26H36.211V24Z M40.298 24H42.3977V26H40.298V24Z M44.3849 24H46.4846V26H44.3849V24Z M48.4719 24H50.5716V26H48.4719V24Z M52.5589 24H54.6585V26H52.5589V24Z M56.6458 24H58.7455V26H56.6458V24Z M60.7328 24H62.8325V26H60.7328V24Z M64.8197 24H66.9194V26H64.8197V24Z M68.9067 24H71.0064V26H68.9067V24Z M72.9936 24H75.0933V26H72.9936V24Z M77.0806 24H79.1803V26H77.0806V24Z M81.1675 24H83.2672V26H81.1675V24Z M85.2545 24H87.3542V26H85.2545V24Z M89.3415 24H91.4411V26H89.3415V24Z M93.4284 24H95.5281V26H93.4284V24Z M97.5154 24H99.6151V26H97.5154V24Z M101.602 24H103.702V26H101.602V24Z M105.689 24H107.789V26H105.689V24Z M109.776 24H111.876V26H109.776V24Z M113.863 24H115.963V26H113.863V24Z M117.95 24H120V26H117.95V24Z M36 8H26V10H24V18H26V20H36V14H30V16H32V18H28V10H36V8Z M38 8H50V10H46V18H50V20H38V18H42V10H38V8Z M52 8H56V16H60V8H64V16H62V18H60V20H56V18H54V16H52V8Z M78 8H66V20H78V18H70V14H76V12H70V10H78V8Z M98 8H94V20H106V8H102V18H98V8Z M108 8V20H112V16H118V14H120V10H118V8H108ZM112 10V14H116V10H112Z M134 8H132V20H134V8Z"
            fill="var(--color-brand-tertiary)"
          />
          <path
            d="M10 8H8V10H6V8H2V10H0V16H2V14H6V16H10V8Z M134 8H136V10H138V8H142V10H144V16H142V14H138V16H134V8Z"
            fill="white"
          />
        </svg>
      </button>

      {/* Timed shimmer overlay */}
      <Shimmer />
    </main>
  );
}
