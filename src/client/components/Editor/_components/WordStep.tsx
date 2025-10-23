import { useState, useEffect, useRef, useMemo } from 'react';
import { CARD_DRAW_DURATION } from '@shared/constants';
import type { CandidateWord } from '@shared/schema/pixelary';
import { PixelFont } from '@components/PixelFont';
import { PixelSymbol } from '@components/PixelSymbol';
import { context } from '@devvit/web/client';
import { useTelemetry } from '@client/hooks/useTelemetry';
import type { SlateAction } from '@shared/types';

interface WordStepProps {
  selectCandidate: (candidate: CandidateWord) => void;
  slateId: string | null;
  candidates: (CandidateWord | null)[];
  isLoading: boolean;
  refreshCandidates: () => void;
  trackSlateAction: (
    action: SlateAction,
    word?: string,
    metadata?: Record<string, string | number>
  ) => Promise<void>;
}

export function WordStep(props: WordStepProps) {
  console.log('WordStep component mounted');
  const {
    selectCandidate,
    slateId,
    candidates,
    isLoading,
    refreshCandidates,
    trackSlateAction,
  } = props;

  // State management
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const trackedSlateIdRef = useRef<string | null>(null);

  const { track } = useTelemetry();

  // Track word step view on mount
  useEffect(() => {
    console.log('🔍 WordStep: About to track view_word_step');
    void track('view_word_step');
    console.log('🔍 WordStep: Tracked view_word_step');
  }, []);

  // Debug slate data
  useEffect(() => {
    console.log('WordStep slateData debug:', {
      slateId,
      isLoading,
      candidatesLength: candidates.length,
    });
  }, [slateId, isLoading, candidates]);

  // Track slate impression when slateId is available
  useEffect(() => {
    console.log('🔍 WordStep slateId effect:', {
      slateId,
      candidates,
      isLoading,
      trackedSlateIdRef: trackedSlateIdRef.current,
    });

    // Only proceed if we have a valid slateId and query is complete
    if (slateId && !isLoading && slateId !== trackedSlateIdRef.current) {
      console.log('🔍 WordStep: Tracking impression for slateId:', {
        slateId,
      });
      trackedSlateIdRef.current = slateId;

      // Track impression after ensuring context is updated
      console.log(
        '🔍 WordStep: About to call trackSlateAction for slate_served'
      );
      // Use setTimeout to ensure React state update has completed
      setTimeout(() => {
        trackSlateAction('slate_served').catch((error) => {
          console.error('🔍 WordStep: Failed to track slate served:', error);
        });
        console.log('🔍 WordStep: Called trackSlateAction for slate_served');
      }, 0);
    } else if (!slateId && !isLoading) {
      console.log('🔍 WordStep: No slateId available after query completed');
    } else if (slateId && slateId === trackedSlateIdRef.current) {
      console.log('🔍 WordStep: slateId already tracked, skipping impression');
    }
  }, [slateId, isLoading, trackSlateAction]);

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
      // Track auto-select before selecting
      void trackSlateAction('slate_picked', candidates[0].word, {
        selectionType: 'auto',
      });
      selectCandidate(candidates[0]);
    }
  }, [elapsedTime, selectCandidate, candidates, trackSlateAction]);

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
            trackSlateAction={trackSlateAction}
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
          void track('click_refresh_words');
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
  trackSlateAction: (
    action: SlateAction,
    word?: string,
    metadata?: Record<string, string | number>
  ) => Promise<void>;
}

function WordCandidate(props: WordCandidateProps) {
  const { candidate, index, isLoading, onSelect, trackSlateAction } = props;
  const { track } = useTelemetry();

  return (
    <button
      key={`candidate-${index}`}
      onClick={() => {
        console.log('WordCandidate clicked:', { candidate, index });
        if (candidate) {
          console.log('Tracking word candidate click:', {
            word: candidate.word,
          });
          void track('click_word_candidate');
          void trackSlateAction('slate_picked', candidate.word, {
            selectionType: 'manual',
          });
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
