import { useEffect } from 'react';
import { useEditorContext } from '../_context/EditorContext';
import { WordStep } from './WordStep';
import { DrawStep } from './DrawStep';
import { ReviewStep } from './ReviewStep';
import { useEditorTelemetry } from '../_hooks/useEditorTelemetry';
import { context } from '@devvit/web/client';

export function EditorRouter() {
  const ctx = useEditorContext();
  useEditorTelemetry();

  useEffect(() => {
    // If tournament mode, ensure we selected the provided word into the flow
    if (ctx.mode === 'tournament-comment' && ctx.word && ctx.step === 'draw') {
      // no-op: already staged
    }
  }, [ctx.mode, ctx.word, ctx.step]);

  return (
    <>
      {ctx.step === 'word' && (
        <WordStep
          selectCandidate={ctx.actions.selectCandidate}
          slateId={ctx.slateId}
          words={ctx.words}
          isLoading={ctx.isSlateLoading}
          refreshCandidates={ctx.refreshCandidates}
          trackSlateAction={ctx.trackSlateAction}
          userLevel={ctx.userLevel}
        />
      )}
      {ctx.word && (ctx.step === 'draw' || ctx.step === 'review') && (
        <>
          <DrawStep
            word={ctx.word}
            time={ctx.timeSeconds}
            onComplete={(drawing) => {
              ctx.actions.setDraft(drawing);
              ctx.actions.toReview();
            }}
            slateId={ctx.slateId}
            trackSlateAction={ctx.trackSlateAction}
            userLevel={ctx.userLevel}
            isReviewing={ctx.step === 'review'}
          />
          {ctx.step === 'review' && ctx.draft && (
            <div className="absolute inset-0 z-30 pointer-events-auto">
              {ctx.mode === 'tournament-comment' && ctx.tournamentPostId ? (
                <ReviewStep
                  mode="tournament"
                  tournamentPostId={ctx.tournamentPostId}
                  drawing={ctx.draft}
                  {...(ctx.onSuccess
                    ? {
                        onSuccess: (_result) => {
                          ctx.onSuccess?.();
                        },
                      }
                    : {})}
                />
              ) : (
                <ReviewStep
                  mode="post"
                  word={ctx.word}
                  dictionary={`r/${context.subredditName}`}
                  drawing={ctx.draft}
                  slateId={ctx.slateId}
                  trackSlateAction={ctx.trackSlateAction}
                />
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
