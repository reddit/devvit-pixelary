import { useState, useEffect, useRef, useCallback } from 'react';
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
            if (data && typeof data === 'object' && 'type' in data) {
              const message = data as LevelUpChannelMessage;
              if (message.type === 'levelup_claimed') {
                this.subscribers.forEach((callback) => {
                  callback(true);
                });
              } else {
                this.subscribers.forEach((callback) => {
                  callback(false);
                });
              }
            }
          },
        });
      } catch (error) {
        // Failed to connect to realtime channel
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
  const utils = trpc.useUtils();
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
      // Reset local state
      setUnclaimedLevel(null);
      setShouldClaim(false);
      // Invalidate and refetch unclaimed level data
      void utils.app.user.getUnclaimedLevelUp.invalidate();
      // Refresh profile (level/progress bar) and related user info
      void utils.app.user.getProfile.invalidate();
      void utils.app.user.getProfile.refetch();
    },
  });

  // Update local state when data changes
  useEffect(() => {
    setUnclaimedLevel(unclaimedLevelData ?? null);
  }, [unclaimedLevelData]);

  // Debounced refetch scheduler
  const scheduleRefetch = useCallback(() => {
    if (!context.userId) return;
    if (refetchTimeoutRef.current != null) return;
    refetchTimeoutRef.current = window.setTimeout(() => {
      void refetch();
      // Also refresh profile (menu, level details, etc.)
      void utils.app.user.getProfile.invalidate();
      void utils.app.user.getProfile.refetch();
      refetchTimeoutRef.current = undefined;
    }, 250);
  }, [refetch, utils]);

  // Refetch when userId changes (e.g., navigation)
  useEffect(() => {
    if (context.userId) {
      void refetch();
    }
  }, [refetch]);

  // Handle realtime claim events
  useEffect(() => {
    if (!context.userId) return;
    const userId = context.userId;
    const channelName = REALTIME_CHANNELS.userLevelUp(userId);

    const handleClaimUpdate = (claimed: boolean) => {
      if (claimed) {
        // Another instance claimed, clear our state
        setUnclaimedLevel(null);
      }
      // Always refetch to get authoritative server state
      scheduleRefetch();
    };

    let cleanup: (() => void) | undefined;

    void levelUpClaimManager.connect(handleClaimUpdate).then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    return () => {
      if (cleanup) {
        cleanup();
      }
      if (refetchTimeoutRef.current != null) {
        clearTimeout(refetchTimeoutRef.current);
        refetchTimeoutRef.current = undefined;
      }
    };
  }, [scheduleRefetch]);

  // Trigger claim when shouldClaim is true
  useEffect(() => {
    if (shouldClaim && unclaimedLevel && !claimMutation.isPending) {
      void claimMutation.mutateAsync({ level: unclaimedLevel.level });
    }
  }, [shouldClaim, unclaimedLevel, claimMutation]);

  const claimLevelUp = async (level: number) => {
    setShouldClaim(true);
  };

  return {
    unclaimedLevel: unclaimedLevel ?? null,
    isLoading,
    claimLevelUp,
  };
}
