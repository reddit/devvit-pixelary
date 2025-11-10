import { useState, useEffect, useRef } from 'react';
import { CARD_DRAW_DURATION } from '@shared/constants';
import { getExtraWordTime } from '@shared/rewards';
import { Text, Icon } from '@components/PixelFont';
import { useTelemetry } from '@client/hooks/useTelemetry';
import type { SlateAction } from '@shared/types';
import { useOptionalEditorContext } from '../_context/EditorContext';
import { EXIT_SHORT_MS, EXIT_LONG_MS } from '../_constants/motion';

type WordStepProps = {
  selectCandidate: (word: string) => void;
  slateId: string | null;
  words: Array<string | null>;
  isLoading: boolean;
  refreshCandidates: () => void;
  trackSlateAction: (
    action: SlateAction,
    word?: string,
    metadata?: Record<string, string | number>
  ) => Promise<void>;
  userLevel: number;
};

export function WordStep(props: WordStepProps) {
  const ctx = useOptionalEditorContext();
  const selectCandidate = ctx?.actions.selectCandidate ?? props.selectCandidate;
  const slateId = ctx?.slateId ?? props.slateId;
  const words = ctx?.words ?? props.words;
  const isLoading = ctx?.isSlateLoading ?? props.isLoading;
  const refreshCandidates = ctx?.refreshCandidates ?? props.refreshCandidates;
  const trackSlateAction = ctx?.trackSlateAction ?? props.trackSlateAction;
  const userLevel = ctx?.userLevel ?? props.userLevel;

  // State management
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const trackedSlateIdRef = useRef<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

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

    return () => {
      clearInterval(timer);
    };
  }, [startTime]);

  // Calculate total word selection time with reward
  const totalWordTime = CARD_DRAW_DURATION + getExtraWordTime(userLevel);

  // Auto-select effect
  useEffect(() => {
    const remainingTime = totalWordTime * 1000 - elapsedTime;
    if (remainingTime <= 0 && words.length > 0 && words[0]) {
      // Track auto-select before selecting
      const w = words[0];
      void trackSlateAction('slate_picked', w, {
        selectionType: 'auto',
      });
      // Play exit animation then navigate
      setIsExiting(true);
      setSelectedIndex(0);
      window.setTimeout(() => {
        selectCandidate(w);
      }, EXIT_SHORT_MS);
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
      <Text
        scale={3}
        className={`transition-opacity duration-200 ${
          isExiting ? 'opacity-0' : 'opacity-100'
        }`}
      >
        Pick a word
      </Text>

      {/* Word Candidates */}
      <div
        className={`flex flex-col gap-3 items-center justify-center h-full w-full max-w-xs flex-1 ${
          isExiting ? 'pointer-events-none' : ''
        }`}
      >
        {words.map((word: string | null, index: number) => (
          <WordCandidate
            key={`word-${index}-${word ?? 'loading'}`}
            word={word}
            index={index}
            isLoading={isLoading}
            isExiting={isExiting}
            isSelected={selectedIndex === index}
            onPress={() => {
              if (!word || isLoading) return;
              void track('click_word_candidate');
              void trackSlateAction('slate_picked', word, {
                selectionType: 'manual',
              });
              setIsExiting(true);
              setSelectedIndex(index);
              window.setTimeout(() => {
                selectCandidate(word);
              }, EXIT_LONG_MS);
            }}
          />
        ))}
      </div>

      {/* Timer */}
      <div
        className={`flex flex-row items-center justify-center gap-4 transition-opacity duration-200 ${
          isExiting ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <Icon
          scale={3}
          type="arrow-right"
          className={secondsLeft > 2 ? 'text-tertiary' : 'text-orangered'}
        />
        {!isLoading ? (
          <Text
            scale={3}
            className={secondsLeft > 2 ? 'text-primary' : 'text-orangered'}
          >
            {secondsLeft.toString()}
          </Text>
        ) : (
          <div className="w-9 h-[21px] skeleton" />
        )}
        <Icon
          scale={3}
          type="arrow-left"
          className={secondsLeft > 2 ? 'text-tertiary' : 'text-orangered'}
        />
      </div>

      {/* Refresh Button */}
      <button
        onClick={() => {
          track('click_refresh_words').catch(() => {
            return;
          });
          refreshCandidates();
        }}
        className={`flex items-center hover:opacity-70 transition-opacity duration-200 p-6 absolute right-0 bottom-0 cursor-pointer ${
          isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <Icon scale={3} type="undo" className="text-secondary" />
      </button>
    </main>
  );
}

/*
 * Word Candidate
 */

type WordCandidateProps = {
  word: string | null;
  index: number;
  isLoading: boolean;
  onPress: () => void;
  isExiting: boolean;
  isSelected: boolean;
};

function WordCandidate(props: WordCandidateProps) {
  const { word, index, isLoading, onPress, isExiting, isSelected } = props;
  const { track } = useTelemetry();

  return (
    <button
      onClick={() => {
        if (word) {
          void track('click_word_candidate');
          onPress();
        }
      }}
      disabled={isLoading}
      className={`bg-white border-4 border-black shadow-pixel cursor-pointer w-full h-1/3 flex flex-col gap-2 items-center justify-center ${
        isExiting
          ? isSelected
            ? 'transition-opacity duration-700 opacity-0'
            : 'transition-opacity duration-200 opacity-0'
          : 'transition-opacity duration-300 opacity-100'
      }`}
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
    </button>
  );
}
