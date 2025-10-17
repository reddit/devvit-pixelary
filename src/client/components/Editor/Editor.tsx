import { useState, useEffect, useCallback } from 'react';
import { WordStep } from './_components/WordStep';
import { DrawStep } from './_components/DrawStep';
import { ReviewStep } from './_components/ReviewStep';
import { trpc } from '../../trpc/client';
import { LEVELS, DRAWING_DURATION } from '../../../shared/constants';
import type { Level } from '../../../shared/constants';
import type { CandidateWord } from '../../../shared/schema/pixelary';
import { DrawingData, DrawingUtils } from '../../../shared/schema/drawing';

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

  // tRPC hooks
  const { data: userProfile } = trpc.app.user.getProfile.useQuery();

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

  // Render current step
  switch (step) {
    case 'word':
      return <WordStep selectCandidate={selectCandidate} />;
    case 'draw':
      return candidate ? (
        <DrawStep
          word={candidate.word}
          time={time}
          onComplete={handleOnComplete}
        />
      ) : null;
    case 'review':
      return candidate ? (
        <ReviewStep
          word={candidate.word}
          dictionaryName={candidate.dictionaryName}
          drawing={drawing}
          onCancel={onClose}
          onSuccess={onClose}
        />
      ) : null;
    default:
      return null;
  }
}
