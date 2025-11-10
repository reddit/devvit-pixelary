import { useCallback, useState } from 'react';
import type { DrawingData } from '@shared/schema/drawing';

type Step = 'word' | 'draw' | 'review';

type UseEditorFlowParams = {
  initialStep?: Step;
  initialWord?: string | null;
};

export function useEditorFlow(params?: UseEditorFlowParams) {
  const initialStep = params?.initialStep ?? 'word';
  const initialWord = params?.initialWord ?? null;

  const [step, setStep] = useState<Step>(initialStep);
  const [word, setWordState] = useState<string | null>(initialWord);
  const [draft, setDraftState] = useState<DrawingData | null>(null);

  const setWord = useCallback((w: string) => {
    setWordState(w);
  }, []);
  const toDraw = useCallback(() => {
    setStep('draw');
  }, []);
  const setDraft = useCallback((d: DrawingData) => {
    setDraftState(d);
  }, []);
  const toReview = useCallback(() => {
    setStep('review');
  }, []);
  const back = useCallback(() => {
    if (step === 'review') setStep('draw');
    else if (step === 'draw') setStep('word');
  }, [step]);

  return {
    step,
    word,
    draft,
    setWord,
    toDraw,
    setDraft,
    toReview,
    back,
  };
}
