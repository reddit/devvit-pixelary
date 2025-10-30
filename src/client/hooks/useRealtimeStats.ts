import { useEffect, useRef, useState } from 'react';
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
        // Failed to connect to realtime channel
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

export function useRealtimeStats(postId: string): {
  stats: PostGuesses | null;
  isLoading: boolean;
  updateStats: (stats: PostGuesses | null) => void;
} {
  const queryClient = useQueryClient();
  const [optimisticStats, setOptimisticStats] = useState<StatsData | null>(
    null
  );
  const lastUpdateRef = useRef(0);

  // Get initial data from tRPC
  const { data: initialStats, isLoading } = trpc.app.guess.getStats.useQuery(
    { postId },
    { enabled: !!postId }
  );

  // Use optimistic stats if available, otherwise fall back to initial stats
  const stats = optimisticStats || initialStats || null;

  // Handle realtime updates
  useEffect(() => {
    if (!postId) return;

    const THROTTLE_MS = 100;
    const handleStatsUpdate = (newStats: StatsData) => {
      const now = Date.now();
      if (now - lastUpdateRef.current < THROTTLE_MS) return;
      lastUpdateRef.current = now;
      setOptimisticStats(newStats);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
