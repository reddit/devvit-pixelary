import { useState, useEffect, useRef, useMemo } from 'react';
import { CARD_DRAW_DURATION } from '@shared/constants';
import type { CandidateWord } from '@shared/schema/pixelary';
import { PixelFont } from '@components/PixelFont';
import { PixelSymbol } from '@components/PixelSymbol';
import { context } from '@devvit/web/client';
import { trpc } from '@client/trpc/client';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { useSlate } from '@client/hooks/useSlate';

interface WordStepProps {
  selectCandidate: (candidate: CandidateWord) => void;
}

export function WordStep(props: WordStepProps) {
  const { selectCandidate } = props;

  // State management
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const trackedSlateIdRef = useRef<string | null>(null);

  const { track } = useTelemetry();
  const { setSlateId, trackSlateAction } = useSlate();

  // Track word step view on mount
  useEffect(() => {
    track('view_word_step');
  }, []);

  // tRPC hooks
  const {
    data: slateData,
    isLoading,
    refetch: refreshCandidates,
  } = trpc.app.dictionary.getCandidates.useQuery();

  // Extract slateId and candidates from response
  const slateId = slateData?.slateId || null;
  const candidates = useMemo(
    () => slateData?.candidates || [null, null, null],
    [slateData?.candidates]
  );

  // Set slateId in context and track impression
  useEffect(() => {
    console.log('WordStep slateId effect:', { slateId, candidates });
    if (slateId && slateId !== trackedSlateIdRef.current) {
      console.log('Setting slateId and tracking impression:', { slateId });
      setSlateId(slateId);
      trackedSlateIdRef.current = slateId;
      // Track impression with a small delay to ensure mutation is ready
      setTimeout(() => {
        trackSlateAction('impression');
      }, 200);
    }
  }, [slateId, setSlateId]);

  // Start timer when candidates load
  useEffect(() => {
    if (!isLoading && candidates.length > 0 && startTime === null) {
      setStartTime(Date.now());
    }
  }, [isLoading, candidates, startTime]);

  // Timer effect
  useEffect(() => {
    if (startTime === null) return;

    const timer = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(timer);
  }, [startTime]);

  // Auto-select effect
  useEffect(() => {
    const remainingTime = CARD_DRAW_DURATION * 1000 - elapsedTime;
    if (remainingTime <= 0 && candidates.length > 0 && candidates[0]) {
      selectCandidate(candidates[0]);
    }
  }, [elapsedTime, selectCandidate, candidates]);

  // Derived state
  const secondsLeft = Math.max(
    0,
    Math.round(CARD_DRAW_DURATION - elapsedTime / 1000)
  );

  return (
    <main className="fixed inset-0 flex flex-col gap-6 p-6 items-center justify-center">
      {/* Page Title */}
      <PixelFont scale={3}>Pick a word</PixelFont>

      {/* Word Candidates */}
      <div className="flex flex-col gap-3 items-center justify-center h-full w-full max-w-xs flex-1">
        {candidates?.map((candidate: CandidateWord | null, index: number) => (
          <WordCandidate
            candidate={candidate}
            index={index}
            isLoading={isLoading}
            onSelect={selectCandidate}
          />
        ))}
      </div>

      {/* Timer */}
      <div className="flex flex-row items-center justify-center gap-4">
        <PixelSymbol
          scale={3}
          type="arrow-right"
          className={
            secondsLeft > 2
              ? 'text-[var(--color-brand-tertiary)]'
              : 'text-[var(--color-brand-orangered)]'
          }
        />
        <PixelFont
          scale={3}
          className={
            secondsLeft > 2
              ? 'text-[var(--color-brand-primary)]'
              : 'text-[var(--color-brand-orangered)]'
          }
        >
          {secondsLeft.toString()}
        </PixelFont>
        <PixelSymbol
          scale={3}
          type="arrow-left"
          className={
            secondsLeft > 2
              ? 'text-[var(--color-brand-tertiary)]'
              : 'text-[var(--color-brand-orangered)]'
          }
        />
      </div>

      {/* Refresh Button */}
      <button
        onClick={() => {
          track('click_refresh_words');
          void refreshCandidates();
        }}
        className="flex items-center hover:opacity-70 transition-opacity p-6 fixed right-0 bottom-0 cursor-pointer"
      >
        <PixelSymbol
          scale={3}
          type="undo"
          className="text-[var(--color-brand-secondary)]"
        />
      </button>
    </main>
  );
}

/*
 * Word Candidate
 */

interface WordCandidateProps {
  candidate: CandidateWord | null;
  index: number;
  isLoading: boolean;
  onSelect: (candidate: CandidateWord) => void;
}

function WordCandidate(props: WordCandidateProps) {
  const { candidate, index, isLoading, onSelect } = props;
  const { track } = useTelemetry();
  const { trackSlateAction } = useSlate();

  return (
    <button
      key={`candidate-${index}`}
      onClick={() => {
        console.log('WordCandidate clicked:', { candidate, index });
        if (candidate) {
          console.log('Tracking word candidate click:', {
            word: candidate.word,
          });
          track('click_word_candidate');
          trackSlateAction('click', candidate.word);
          onSelect(candidate);
        }
      }}
      disabled={isLoading}
      className="bg-white border-4 border-black shadow-pixel cursor-pointer w-full h-1/3 flex flex-col gap-2 items-center justify-center"
    >
      {/* Word */}
      <div className="flex flex-row items-center justify-center gap-2">
        {index === 0 && !isLoading && (
          <PixelSymbol
            scale={2}
            type="arrow-right"
            color="#FF4500"
            className="animate-nudge-right"
          />
        )}
        {isLoading || !candidate ? (
          <div className="w-16 h-3.5 skeleton" />
        ) : (
          <PixelFont scale={2}>{candidate.word}</PixelFont>
        )}
        {index === 0 && !isLoading && (
          <PixelSymbol
            scale={2}
            type="arrow-left"
            color="#FF4500"
            className="animate-nudge-left"
          />
        )}
      </div>

      {/* Dictionary name */}
      {candidate &&
        candidate.dictionaryName !== `r/${context.subredditName}` && (
          <PixelFont scale={2} className="text-black/50">
            {candidate.dictionaryName}
          </PixelFont>
        )}
    </button>
  );
}
