import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectRealtime } from '@devvit/web/client';
import { trpc } from '../trpc/client';
import { context } from '@devvit/web/client';
import { REALTIME_CHANNELS } from '@shared/realtime';
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
              const message = data as RealtimeMessage;
              if (message.type === 'levelup_claimed') {
                // Notify all subscribers
                this.subscribers.forEach((callback) => callback(true));
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
          void this.connection.disconnect();
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
      void queryClient.invalidateQueries({
        queryKey: ['pixelary', 'user', 'getUnclaimedLevelUp'],
      });
    },
  });

  // Update local state when data changes
  useEffect(() => {
    setUnclaimedLevel(unclaimedLevelData ?? null);
  }, [unclaimedLevelData]);

  // Refetch when userId changes (e.g., navigation)
  useEffect(() => {
    if (context.userId) {
      void refetch();
    }
  }, [refetch]);

  // Handle realtime claim events
  useEffect(() => {
    if (!context.userId) return;

    const handleClaimUpdate = (claimed: boolean) => {
      if (claimed) {
        // Another instance claimed, clear our state
        setUnclaimedLevel(null);
      }
    };

    let cleanup: (() => void) | undefined;

    void levelUpClaimManager.connect(handleClaimUpdate).then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

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
