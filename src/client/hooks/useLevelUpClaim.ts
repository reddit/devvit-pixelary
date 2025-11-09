import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectRealtime, disconnectRealtime } from '@devvit/web/client';
import { trpc } from '../trpc/client';
import { context } from '@devvit/web/client';
import { REALTIME_CHANNELS } from '@shared/realtime';
import type { LevelUpChannelMessage } from '@shared/realtime';
import type { RewardType } from '@shared/rewards';

type UnclaimedLevelUp = {
  level: number;
};

type RealtimeMessage = {
  type: 'levelup_claimed';
  timestamp: number;
};

// Global connection manager to avoid duplicate connections per user
class LevelUpClaimManager {
  private connection: Awaited<ReturnType<typeof connectRealtime>> | null = null;
  private subscribers = new Set<(claimed: boolean) => void>();

  async connect(onClaimUpdate: (claimed: boolean) => void) {
    const userId = context.userId;
    if (!userId) return;

    const channelName = REALTIME_CHANNELS.userLevelUp(userId);

    // Add subscriber
    this.subscribers.add(onClaimUpdate);

    // Create connection if it doesn't exist
    if (!this.connection) {
      try {
        this.connection = await connectRealtime({
          channel: channelName,
          onMessage: (data) => {
            console.debug('[LevelUpClaimManager] onMessage', data);
            if (data && typeof data === 'object' && 'type' in data) {
              const message = data as LevelUpChannelMessage;
              if (message.type === 'levelup_claimed') {
                console.debug(
                  '[LevelUpClaimManager] received levelup_claimed'
                );
                this.subscribers.forEach((callback) => {
                  callback(true);
                });
              } else if (
                message.type === 'levelup_pending' ||
                message.type === 'score_changed'
              ) {
                console.debug('[LevelUpClaimManager] received', message.type, {
                  level:
                    'level' in message && typeof message.level === 'number'
                      ? message.level
                      : undefined,
                  score:
                    'score' in message && typeof message.score === 'number'
                      ? message.score
                      : undefined,
                });
                this.subscribers.forEach((callback) => {
                  callback(false);
                });
              }
            }
          },
        });
      } catch (error) {
        // Failed to connect to realtime channel
        console.warn('[LevelUpClaimManager] connect failed', error);
      }
    }

    // Return cleanup function
    return () => {
      this.subscribers.delete(onClaimUpdate);
      // If no more subscribers, close connection
      if (this.subscribers.size === 0) {
        if (this.connection) {
          void disconnectRealtime(channelName);
          this.connection = null;
        }
      }
    };
  }
}

const levelUpClaimManager = new LevelUpClaimManager();

export function useLevelUpClaim(): {
  unclaimedLevel: UnclaimedLevelUp | null;
  isLoading: boolean;
  claimLevelUp: (level: number) => Promise<void>;
} {
  const queryClient = useQueryClient();
  const [shouldClaim, setShouldClaim] = useState(false);
  const refetchTimeoutRef = useRef<number | undefined>(undefined);

  // Get initial data from tRPC
  const {
    data: unclaimedLevelData,
    isLoading,
    refetch,
  } = trpc.app.user.getUnclaimedLevelUp.useQuery(undefined, {
    enabled: !!context.userId,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const [unclaimedLevel, setUnclaimedLevel] = useState<UnclaimedLevelUp | null>(
    null
  );

  // Claim mutation
  const claimMutation = trpc.app.user.claimLevelUp.useMutation({
    onSuccess: () => {
      console.debug('[useLevelUpClaim] claimLevelUp success');
      // Reset local state
      setUnclaimedLevel(null);
      setShouldClaim(false);
      // Invalidate and refetch unclaimed level data
      void queryClient.invalidateQueries({
        queryKey: ['pixelary', 'user', 'getUnclaimedLevelUp'],
      });
    },
  });

  // Update local state when data changes
  useEffect(() => {
    setUnclaimedLevel(unclaimedLevelData ?? null);
  }, [unclaimedLevelData]);

  // Debounced refetch scheduler
  const scheduleRefetch = () => {
    if (!context.userId) return;
    if (refetchTimeoutRef.current != null) return;
    console.debug('[useLevelUpClaim] scheduleRefetch queued');
    refetchTimeoutRef.current = window.setTimeout(() => {
      console.debug('[useLevelUpClaim] refetch fired');
      void refetch();
      refetchTimeoutRef.current = undefined;
    }, 250);
  };

  // Refetch when userId changes (e.g., navigation)
  useEffect(() => {
    if (context.userId) {
      console.debug('[useLevelUpClaim] userId changed, refetching', {
        userId: context.userId,
      });
      void refetch();
    }
  }, [refetch]);

  // Handle realtime claim events
  useEffect(() => {
    if (!context.userId) return;
    const userId = context.userId;
    const channelName = REALTIME_CHANNELS.userLevelUp(userId);
    console.debug('[useLevelUpClaim] subscribing to realtime', {
      userId,
      channelName,
    });

    const handleClaimUpdate = (claimed: boolean) => {
      console.debug('[useLevelUpClaim] handleClaimUpdate', { claimed });
      if (claimed) {
        // Another instance claimed, clear our state
        setUnclaimedLevel(null);
      }
      // Always refetch to get authoritative server state
      scheduleRefetch();
    };

    let cleanup: (() => void) | undefined;

    void levelUpClaimManager.connect(handleClaimUpdate).then((cleanupFn) => {
      console.debug('[useLevelUpClaim] realtime connected');
      cleanup = cleanupFn;
    });

    return () => {
      if (cleanup) {
        console.debug('[useLevelUpClaim] unsubscribing from realtime', {
          channelName,
        });
        cleanup();
      }
      if (refetchTimeoutRef.current != null) {
        clearTimeout(refetchTimeoutRef.current);
        refetchTimeoutRef.current = undefined;
      }
    };
  }, [context.userId]);

  // Trigger claim when shouldClaim is true
  useEffect(() => {
    if (shouldClaim && unclaimedLevel && !claimMutation.isPending) {
      void claimMutation.mutateAsync({ level: unclaimedLevel.level });
    }
  }, [shouldClaim, unclaimedLevel, claimMutation]);

  const claimLevelUp = async (level: number) => {
    console.debug('[useLevelUpClaim] claimLevelUp requested', { level });
    setShouldClaim(true);
  };

  return {
    unclaimedLevel: unclaimedLevel ?? null,
    isLoading,
    claimLevelUp,
  };
}
