import { createContext, useContext, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import { trpc } from '@client/trpc/client';
import { DRAWING_DURATION } from '@shared/constants';
import { getExtraDrawingTime } from '@shared/rewards';
import { context } from '@devvit/web/client';
import type { DrawingData } from '@shared/schema/drawing';
import type { SlateAction } from '@shared/types';
import { useEditorFlow } from '../_hooks/useEditorFlow';

export type EditorMode = 'post' | 'tournament-comment';

export type EditorContextValue = {
  // flow
  step: 'word' | 'draw' | 'review';
  word: string | null;
  draft: DrawingData | null;
  actions: {
    selectCandidate: (word: string) => void;
    setDraft: (drawing: DrawingData) => void;
    toReview: () => void;
    back: () => void;
  };
  // editor-wide
  userLevel: number;
  timeSeconds: number;
  slateId: string | null;
  words: Array<string | null>;
  isSlateLoading: boolean;
  refreshCandidates: () => void;
  trackSlateAction: (
    action: SlateAction,
    word?: string,
    metadata?: Record<string, string | number>
  ) => Promise<void>;
  // mode
  mode: EditorMode;
  tournamentPostId?: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export const EditorRawContext = createContext<EditorContextValue | null>(null);

export function useEditorContext(): EditorContextValue {
  const ctx = useContext(EditorRawContext);
  if (!ctx)
    throw new Error(
      'useEditorContext must be used within EditorContextProvider'
    );
  return ctx;
}

export function useOptionalEditorContext(): EditorContextValue | null {
  return useContext(EditorRawContext);
}

type ProviderProps = {
  children: ReactNode;
  onClose: () => void;
  onSuccess?: () => void;
  mode?: EditorMode;
  tournamentPostId?: string;
  tournamentWord?: string;
};

export function EditorContextProvider(props: ProviderProps) {
  const {
    children,
    onClose,
    onSuccess,
    mode = 'post',
    tournamentPostId,
    tournamentWord,
  } = props;

  // flow
  const flow = useEditorFlow({
    initialStep:
      mode === 'tournament-comment' && tournamentWord && tournamentPostId
        ? 'draw'
        : 'word',
    initialWord:
      mode === 'tournament-comment' && tournamentWord && tournamentPostId
        ? tournamentWord
        : null,
  });

  // queries
  const { data: userProfile } = trpc.app.user.getProfile.useQuery(undefined, {
    staleTime: 30000,
  });
  const { data: effectiveBonuses } =
    trpc.app.rewards.getEffectiveBonuses.useQuery(undefined, {
      enabled: !!context.userId,
      staleTime: 5000,
    });
  const {
    data: slateData,
    isLoading: isSlateLoading,
    refetch: refreshCandidates,
  } = trpc.app.dictionary.getCandidates.useQuery();

  // slate
  const currentSlateId = slateData?.slateId ?? null;

  // track slate action
  const trackSlateActionMutation = trpc.app.slate.trackAction.useMutation();
  const trackSlateAction = useCallback(
    async (
      action: SlateAction,
      word?: string,
      metadata?: Record<string, string | number>
    ) => {
      const effectiveSlateId = currentSlateId;
      if (!effectiveSlateId) return;
      try {
        const postIdFromMetadata =
          metadata && typeof metadata.postId === 'string'
            ? metadata.postId
            : undefined;
        await trackSlateActionMutation.mutateAsync({
          slateId: effectiveSlateId,
          action,
          word,
          metadata,
          ...(postIdFromMetadata ? { postId: postIdFromMetadata } : {}),
        });
      } catch {
        // ignore
      }
    },
    [currentSlateId, trackSlateActionMutation]
  );

  const userLevel = userProfile?.level ?? 1;
  const timeSeconds =
    DRAWING_DURATION +
    (effectiveBonuses?.extraDrawingTimeSeconds ??
      (userLevel ? getExtraDrawingTime(userLevel) : 0));

  const value = useMemo<EditorContextValue>(
    () => ({
      step: flow.step,
      word: flow.word,
      draft: flow.draft,
      actions: {
        selectCandidate: (w: string) => {
          flow.setWord(w);
          flow.toDraw();
        },
        setDraft: flow.setDraft,
        toReview: flow.toReview,
        back: flow.back,
      },
      userLevel,
      timeSeconds,
      slateId: currentSlateId,
      words: slateData?.words ?? [null, null, null],
      isSlateLoading,
      refreshCandidates: () => {
        void refreshCandidates();
      },
      trackSlateAction,
      mode,
      tournamentPostId,
      onClose,
      onSuccess,
    }),
    [
      flow,
      userLevel,
      timeSeconds,
      currentSlateId,
      slateData?.words,
      isSlateLoading,
      refreshCandidates,
      trackSlateAction,
      mode,
      tournamentPostId,
      onClose,
      onSuccess,
    ]
  );

  return (
    <EditorRawContext.Provider value={value}>
      {children}
    </EditorRawContext.Provider>
  );
}
