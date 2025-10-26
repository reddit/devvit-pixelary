import { useState, useEffect, useCallback, useRef } from 'react';
import { WordStep } from './_components/WordStep';
import { DrawStep } from './_components/DrawStep';
import { ReviewStep } from './_components/ReviewStep';
import { TournamentReviewStep } from './_components/TournamentReviewStep';
import { trpc } from '@client/trpc/client';
import { DRAWING_DURATION } from '@shared/constants';
import type { CandidateWord } from '@shared/schema/pixelary';
import { DrawingData, DrawingUtils } from '@shared/schema/drawing';
import { useTelemetry } from '@client/hooks/useTelemetry';
import type { SlateAction } from '@shared/types';
import { context } from '@devvit/web/client';
import { getExtraDrawingTime } from '@shared/rewards';

interface DrawingEditorProps {
  onClose: () => void;
  onSuccess?: () => void;
  mode?: 'post' | 'tournament-comment';
  tournamentPostId?: string;
  tournamentWord?: string;
}

type Step = 'word' | 'draw' | 'review';

export function DrawingEditor({
  onClose,
  onSuccess,
  mode = 'post',
  tournamentPostId,
  tournamentWord,
}: DrawingEditorProps) {
  // State management - skip word step if tournament word is provided
  const [step, setStep] = useState<Step>(
    mode === 'tournament-comment' && tournamentWord ? 'draw' : 'word'
  );
  const [time, setTime] = useState<number>(DRAWING_DURATION);
  const [candidate, setCandidate] = useState<CandidateWord | null>(null);
  const [drawing, setDrawing] = useState<DrawingData>(
    DrawingUtils.createBlank()
  );
  const [slateId, setSlateId] = useState<string | null>(null);

  const { track } = useTelemetry();

  // Track editor view on mount
  useEffect(() => {
    void track('view_editor');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tRPC hooks
  const { data: userProfile } = trpc.app.user.getProfile.useQuery();
  const trackSlateActionMutation = trpc.app.slate.trackAction.useMutation();
  const trackSlateActionRef = useRef(trackSlateActionMutation.mutateAsync);
  const subredditNameRef = useRef(context.subredditName);

  // Fetch slate data at Editor level to persist across step transitions
  const {
    data: slateData,
    isLoading: isSlateLoading,
    refetch: refreshCandidates,
  } = trpc.app.dictionary.getCandidates.useQuery();

  // Extract slateId and words from response
  const currentSlateId = slateData?.slateId || null;
  const words = slateData?.words || [null, null, null];

  // Debug slate data
  useEffect(() => {
    // Slate data changed
  }, [slateData, currentSlateId, isSlateLoading, slateId]);

  // Set slateId when slate data loads
  useEffect(() => {
    if (currentSlateId && currentSlateId !== slateId) {
      setSlateId(currentSlateId);
    }
  }, [currentSlateId, slateId]);

  // Update refs when values change
  useEffect(() => {
    trackSlateActionRef.current = trackSlateActionMutation.mutateAsync;
    subredditNameRef.current = context.subredditName;
  }, [trackSlateActionMutation.mutateAsync]);

  // Track slate action function
  const trackSlateAction = useCallback(
    async (
      action: SlateAction,
      word?: string,
      metadata?: Record<string, string | number>
    ) => {
      // Use currentSlateId if slateId is not set yet
      const effectiveSlateId = slateId || currentSlateId;

      if (!effectiveSlateId) {
        return;
      }

      await trackSlateActionRef.current({
        slateId: effectiveSlateId,
        action,
        word,
        metadata,
      });
    },
    [slateId, currentSlateId]
  );

  // On load effect
  useEffect(() => {
    if (userProfile) {
      const extraTime = getExtraDrawingTime(userProfile.level);
      setTime(DRAWING_DURATION + extraTime);
    }
  }, [userProfile]);

  const handleOnComplete = useCallback((drawingData: DrawingData) => {
    setDrawing(drawingData);
    setStep('review');
  }, []);

  const selectCandidate = useCallback((word: string) => {
    setCandidate({ word, dictionaryName: `r/${subredditNameRef.current}` });
    setStep('draw');
  }, []);

  // Initialize tournament word on mount if provided
  useEffect(() => {
    if (mode === 'tournament-comment' && tournamentWord && !candidate) {
      setCandidate({
        word: tournamentWord,
        dictionaryName: `r/${subredditNameRef.current}`,
      });
    }
  }, [mode, tournamentWord, candidate]);

  return (
    <>
      {/* Render current step */}
      {step === 'word' && (
        <WordStep
          selectCandidate={selectCandidate}
          slateId={slateId}
          words={words}
          isLoading={isSlateLoading}
          refreshCandidates={refreshCandidates}
          trackSlateAction={trackSlateAction}
          userLevel={userProfile?.level || 1}
        />
      )}
      {step === 'draw' && candidate && (
        <DrawStep
          word={candidate.word}
          time={time}
          onComplete={handleOnComplete}
          slateId={slateId}
          trackSlateAction={trackSlateAction}
          userLevel={userProfile?.level || 1}
        />
      )}
      {step === 'review' && candidate && (
        <>
          {mode === 'tournament-comment' && tournamentPostId ? (
            <TournamentReviewStep
              word={candidate.word}
              drawing={drawing}
              onCancel={onClose}
              {...(onSuccess && { onSuccess })}
              tournamentPostId={tournamentPostId}
            />
          ) : (
            <ReviewStep
              word={candidate.word}
              dictionaryName={candidate.dictionaryName}
              drawing={drawing}
              onCancel={onClose}
              onSuccess={onClose}
              slateId={slateId}
              trackSlateAction={trackSlateAction}
            />
          )}
        </>
      )}
    </>
  );
}
