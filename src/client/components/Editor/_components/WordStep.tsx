import { useState, useEffect, useRef } from 'react';
import { CARD_DRAW_DURATION } from '@shared/constants';
import { getExtraWordTime } from '@shared/rewards';
import { Text, Icon } from '@components/PixelFont';
import { useTelemetry } from '@client/hooks/useTelemetry';
import type { SlateAction } from '@shared/types';

interface WordStepProps {
  selectCandidate: (word: string) => void;
  slateId: string | null;
  words: (string | null)[];
  isLoading: boolean;
  refreshCandidates: () => void;
  trackSlateAction: (
    action: SlateAction,
    word?: string,
    metadata?: Record<string, string | number>
  ) => Promise<void>;
  userLevel: number;
}

export function WordStep(props: WordStepProps) {
  const {
    selectCandidate,
    slateId,
    words,
    isLoading,
    refreshCandidates,
    trackSlateAction,
    userLevel,
  } = props;

  // State management
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const trackedSlateIdRef = useRef<string | null>(null);

  const { track } = useTelemetry();

  // Track word step view on mount
  useEffect(() => {
    void track('view_word_step');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debug slate data
  useEffect(() => {
    // Slate data debug
  }, [slateId, isLoading, words]);

  // Track slate impression when slateId is available
  useEffect(() => {
    // Only proceed if we have a valid slateId and query is complete
    if (slateId && !isLoading && slateId !== trackedSlateIdRef.current) {
      trackedSlateIdRef.current = slateId;

      // Track impression after ensuring context is updated
      // Use setTimeout to ensure React state update has completed
      setTimeout(() => {
        trackSlateAction('slate_served').catch(() => {
          // Failed to track slate served
        });
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slateId, isLoading]);

  // Start timer when words load
  useEffect(() => {
    if (!isLoading && words.length > 0 && startTime === null) {
      setStartTime(Date.now());
    }
  }, [isLoading, words, startTime]);

  // Timer effect
  useEffect(() => {
    if (startTime === null) return;

    const timer = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(timer);
  }, [startTime]);

  // Calculate total word selection time with reward
  const totalWordTime = CARD_DRAW_DURATION + getExtraWordTime(userLevel);

  // Auto-select effect
  useEffect(() => {
    const remainingTime = totalWordTime * 1000 - elapsedTime;
    if (remainingTime <= 0 && words.length > 0 && words[0]) {
      // Track auto-select before selecting
      void trackSlateAction('slate_picked', words[0], {
        selectionType: 'auto',
      });
      selectCandidate(words[0]);
    }
  }, [elapsedTime, selectCandidate, words, trackSlateAction, totalWordTime]);

  // Derived state
  const secondsLeft = Math.max(
    0,
    Math.round(totalWordTime - elapsedTime / 1000)
  );

  return (
    <main className="absolute inset-0 flex flex-col gap-6 p-6 items-center justify-center">
      {/* Page Title */}
      <Text scale={3}>Pick a word</Text>

      {/* Word Candidates */}
      <div className="flex flex-col gap-3 items-center justify-center h-full w-full max-w-xs flex-1">
        {words?.map((word: string | null, index: number) => (
          <WordCandidate
            key={`word-${index}-${word || 'loading'}`}
            word={word}
            index={index}
            isLoading={isLoading}
            onSelect={selectCandidate}
            trackSlateAction={trackSlateAction}
          />
        ))}
      </div>

      {/* Timer */}
      <div className="flex flex-row items-center justify-center gap-4">
        <Icon
          scale={3}
          type="arrow-right"
          className={secondsLeft > 2 ? 'text-tertiary' : 'text-orangered'}
        />
        <Text
          scale={3}
          className={secondsLeft > 2 ? 'text-primary' : 'text-orangered'}
        >
          {secondsLeft.toString()}
        </Text>
        <Icon
          scale={3}
          type="arrow-left"
          className={secondsLeft > 2 ? 'text-tertiary' : 'text-orangered'}
        />
      </div>

      {/* Refresh Button */}
      <button
        onClick={() => {
          void track('click_refresh_words');
          void refreshCandidates();
        }}
        className="flex items-center hover:opacity-70 transition-opacity p-6 absolute right-0 bottom-0 cursor-pointer"
      >
        <Icon scale={3} type="undo" className="text-secondary" />
      </button>
    </main>
  );
}

/*
 * Word Candidate
 */

interface WordCandidateProps {
  word: string | null;
  index: number;
  isLoading: boolean;
  onSelect: (word: string) => void;
  trackSlateAction: (
    action: SlateAction,
    word?: string,
    metadata?: Record<string, string | number>
  ) => Promise<void>;
}

function WordCandidate(props: WordCandidateProps) {
  const { word, index, isLoading, onSelect, trackSlateAction } = props;
  const { track } = useTelemetry();

  return (
    <button
      onClick={() => {
        if (word) {
          void track('click_word_candidate');
          void trackSlateAction('slate_picked', word, {
            selectionType: 'manual',
          });
          onSelect(word);
        }
      }}
      disabled={isLoading}
      className="bg-white border-4 border-black shadow-pixel cursor-pointer w-full h-1/3 flex flex-col gap-2 items-center justify-center"
    >
      {/* Word */}
      <div className="flex flex-row items-center justify-center gap-2">
        {index === 0 && !isLoading && (
          <Icon
            scale={2}
            type="arrow-right"
            color="currentColor"
            className="text-orangered animate-nudge-right"
          />
        )}
        {isLoading || !word ? (
          <div className="w-16 h-3.5 skeleton" />
        ) : (
          <Text scale={2}>{word}</Text>
        )}
        {index === 0 && !isLoading && (
          <Icon
            scale={2}
            type="arrow-left"
            color="currentColor"
            className="text-orangered animate-nudge-left"
          />
        )}
      </div>

      {/* Dictionary name - removed since we're just using strings now */}
    </button>
  );
}
