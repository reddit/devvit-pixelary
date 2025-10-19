import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { trpc } from '@client/trpc/client';

interface SlateContextType {
  slateId: string | null;
  setSlateId: (slateId: string | null) => void;
  trackSlateAction: (
    action: 'impression' | 'click' | 'publish',
    word?: string
  ) => void;
}

const SlateContext = createContext<SlateContextType | null>(null);

export function SlateProvider({ children }: { children: React.ReactNode }) {
  const [slateId, setSlateId] = useState<string | null>(null);
  const [mutationReady, setMutationReady] = useState(false);

  console.log('SlateProvider render:', { slateId, mutationReady });

  // Initialize mutation after component mounts to ensure tRPC context is available
  useEffect(() => {
    setMutationReady(true);
  }, []);

  // Use the useMutation hook pattern like telemetry - stable reference
  const trackSlateActionMutation = trpc.app.slate.trackAction.useMutation({
    onError: (error) => {
      console.error('Slate tracking mutation error:', error);
    },
  });

  const trackSlateAction = useCallback(
    (action: 'impression' | 'click' | 'publish', word?: string) => {
      if (!slateId) {
        console.warn('trackSlateAction called but slateId is null/undefined', {
          action,
          word,
        });
        return;
      }

      console.log('Tracking slate action:', {
        slateId,
        action,
        word,
        mutationReady,
      });

      if (!mutationReady) {
        console.warn('Slate tracking not ready yet, skipping:', {
          slateId,
          action,
          word,
        });
        return;
      }

      // Use the mutation hook with fire-and-forget pattern like telemetry
      try {
        trackSlateActionMutation.mutate(
          {
            slateId,
            action,
            word,
          },
          {
            onSuccess: (result) => {
              console.log('Slate action tracked successfully:', {
                slateId,
                action,
                word,
                result,
              });
            },
            onError: (error) => {
              console.error('Failed to track slate action:', {
                error,
                slateId,
                action,
                word,
                errorMessage:
                  error instanceof Error ? error.message : String(error),
                errorStack: error instanceof Error ? error.stack : undefined,
              });
              // Silently ignore errors - slate tracking should never break the app
            },
          }
        );
      } catch (error) {
        console.error('Slate tracking failed to initiate:', {
          error,
          slateId,
          action,
          word,
        });
        // Silently ignore - slate tracking should never break the app
      }
    },
    [slateId, trackSlateActionMutation, mutationReady]
  );

  return (
    <SlateContext.Provider value={{ slateId, setSlateId, trackSlateAction }}>
      {children}
    </SlateContext.Provider>
  );
}

export function useSlate() {
  const context = useContext(SlateContext);
  if (!context) {
    throw new Error('useSlate must be used within a SlateProvider');
  }
  return context;
}
