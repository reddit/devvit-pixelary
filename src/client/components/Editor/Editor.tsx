import { useState, useEffect, useCallback } from 'react';
import { WordStep } from './_components/WordStep';
import { DrawStep } from './_components/DrawStep';
import { ReviewStep } from './_components/ReviewStep';
import { trpc } from '@client/trpc/client';
import { LEVELS, DRAWING_DURATION } from '@shared/constants';
import type { Level } from '@shared/constants';
import type { CandidateWord } from '@shared/schema/pixelary';
import { DrawingData, DrawingUtils } from '@shared/schema/drawing';
import { useTelemetry } from '@client/hooks/useTelemetry';
import type { SlateAction } from '@shared/types';

interface DrawingEditorProps {
  onClose: () => void;
}

type Step = 'word' | 'draw' | 'review';

export function DrawingEditor({ onClose }: DrawingEditorProps) {
  // State management
  const [step, setStep] = useState<Step>('word');
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
  }, []);

  // tRPC hooks
  const { data: userProfile } = trpc.app.user.getProfile.useQuery();
  const trackSlateActionMutation = trpc.app.slate.trackAction.useMutation();

  // Fetch slate data at Editor level to persist across step transitions
  const {
    data: slateData,
    isLoading: isSlateLoading,
    refetch: refreshCandidates,
  } = trpc.app.dictionary.getCandidates.useQuery();

  // Extract slateId and candidates from response
  const currentSlateId = slateData?.slateId || null;
  const candidates = slateData?.candidates || [null, null, null];

  // Set slateId when slate data loads
  useEffect(() => {
    if (currentSlateId && currentSlateId !== slateId) {
      console.log('🔍 Editor: Setting slateId from slate data:', {
        currentSlateId,
        previousSlateId: slateId,
      });
      setSlateId(currentSlateId);
    }
  }, [currentSlateId, slateId]);

  // Track slate action function
  const trackSlateAction = useCallback(
    async (
      action: SlateAction,
      word?: string,
      metadata?: Record<string, string | number>
    ) => {
      console.log('🔍 Editor: trackSlateAction called', {
        action,
        word,
        slateId,
      });
      if (!slateId) {
        console.warn(
          '🔍 Editor: trackSlateAction called but slateId is not set',
          { action, word }
        );
        return;
      }

      console.log('🔍 Editor: tracking slate action', {
        slateId,
        action,
        word,
      });
      await trackSlateActionMutation.mutateAsync({
        slateId,
        action,
        word,
        metadata,
      });
    },
    [slateId, trackSlateActionMutation]
  );

  // On load effect
  useEffect(() => {
    if (userProfile) {
      const userLevel: Level | null = userProfile
        ? LEVELS.find((l) => l.rank === userProfile.level) || null
        : null;

      if (userLevel) {
        setTime(DRAWING_DURATION + userLevel.extraTime);
      }
    }
  }, [userProfile]);

  const handleOnComplete = useCallback((drawingData: DrawingData) => {
    setDrawing(drawingData);
    setStep('review');
  }, []);

  const selectCandidate = useCallback((candidate: CandidateWord) => {
    setCandidate(candidate);
    setStep('draw');
  }, []);

  return (
    <>
      {/* Render current step */}
      {step === 'word' && (
        <WordStep
          selectCandidate={selectCandidate}
          slateId={slateId}
          candidates={candidates}
          isLoading={isSlateLoading}
          refreshCandidates={refreshCandidates}
          trackSlateAction={trackSlateAction}
        />
      )}
      {step === 'draw' && candidate && (
        <DrawStep
          word={candidate.word}
          time={time}
          onComplete={handleOnComplete}
          slateId={slateId}
          trackSlateAction={trackSlateAction}
        />
      )}
      {step === 'review' && candidate && (
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
  );
}
