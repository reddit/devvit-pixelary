import { useEffect, useState } from 'react';
import { connectRealtime } from '@devvit/web/client';
import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '../trpc/client';
import type { PostGuesses } from '../../shared/schema';

type StatsData = PostGuesses;

type RealtimeMessage = {
  type: 'guess_submitted';
  postId: string;
  correct: boolean;
  isFirstSolve?: boolean;
  timestamp: number;
  stats: StatsData;
};

// Global connection manager to avoid duplicate connections
class RealtimeManager {
  private connections = new Map<
    string,
    Awaited<ReturnType<typeof connectRealtime>>
  >();
  private subscribers = new Map<string, Set<(stats: StatsData) => void>>();

  async connect(postId: string, onStatsUpdate: (stats: StatsData) => void) {
    const channelName = `post-${postId}`;

    // Add subscriber
    if (!this.subscribers.has(channelName)) {
      this.subscribers.set(channelName, new Set());
    }
    this.subscribers.get(channelName)!.add(onStatsUpdate);

    // Create connection if it doesn't exist
    if (!this.connections.has(channelName)) {
      try {
        const connection = await connectRealtime({
          channel: channelName,
          onMessage: (data) => {
            if (data && typeof data === 'object' && 'stats' in data) {
              const message = data as RealtimeMessage;
              // Notify all subscribers
              const subscribers = this.subscribers.get(channelName);
              if (subscribers) {
                subscribers.forEach((callback) => callback(message.stats));
              }
            }
          },
        });
        this.connections.set(channelName, connection);
      } catch (error) {
        console.error(
          `Failed to connect to realtime channel ${channelName}:`,
          error
        );
      }
    }

    // Return cleanup function
    return () => {
      const subscribers = this.subscribers.get(channelName);
      if (subscribers) {
        subscribers.delete(onStatsUpdate);
        // If no more subscribers, close connection
        if (subscribers.size === 0) {
          const connection = this.connections.get(channelName);
          if (connection) {
            void connection.disconnect();
            this.connections.delete(channelName);
            this.subscribers.delete(channelName);
          }
        }
      }
    };
  }
}

const realtimeManager = new RealtimeManager();

export function useRealtimeStats(postId: string) {
  const queryClient = useQueryClient();
  const [optimisticStats, setOptimisticStats] = useState<StatsData | null>(
    null
  );

  // Get initial data from tRPC
  const { data: initialStats, isLoading } = trpc.app.guess.getStats.useQuery(
    { postId },
    { enabled: !!postId }
  );

  // Use optimistic stats if available, otherwise fall back to initial stats
  const stats = optimisticStats || initialStats;

  // Handle realtime updates
  useEffect(() => {
    if (!postId) return;

    const handleStatsUpdate = (newStats: StatsData) => {
      // Update optimistic state immediately
      setOptimisticStats(newStats);

      // Update React Query cache for consistency
      queryClient.setQueryData(
        ['pixelary', 'guess', 'stats', postId],
        newStats
      );
    };

    let cleanup: (() => void) | undefined;

    void realtimeManager
      .connect(postId, handleStatsUpdate)
      .then((cleanupFn) => {
        cleanup = cleanupFn;
      });

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [postId]);

  // Reset optimistic stats when initial data changes (e.g., page refresh)
  useEffect(() => {
    if (initialStats && !optimisticStats) {
      setOptimisticStats(null);
    }
  }, [initialStats, optimisticStats]);

  return {
    stats,
    isLoading,
    // Helper for optimistic updates
    updateStats: setOptimisticStats,
  };
}
