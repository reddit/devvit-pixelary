import { useEffect, useMemo, useRef, useState } from 'react';
import { connectRealtime, context } from '@devvit/web/client';
import { trpc } from '@client/trpc/client';
import type { ConsumableEffect, ConsumableId } from '@shared/consumables';

export type ActiveEffectEntry = {
  activationId: string;
  itemId: ConsumableId;
  effect: ConsumableEffect;
  expiresAt: number; // epoch ms
};

type EffectsUpdatedMessage = {
  type: 'effects_updated';
  effects: ActiveEffectEntry[];
  timestamp: number;
};

// Global manager to keep a single realtime connection per user
class RealtimeRewardsManager {
  private connection: Awaited<ReturnType<typeof connectRealtime>> | null = null;
  private subscribers = new Set<(effects: ActiveEffectEntry[]) => void>();

  async connect(
    onEffectsUpdate: (effects: ActiveEffectEntry[]) => void
  ): Promise<() => void> {
    const userId = context.userId;
    if (!userId) return () => {};

    const channelName = `user-${userId}-rewards`;

    // Add subscriber
    this.subscribers.add(onEffectsUpdate);

    // Create connection if it doesn't exist
    if (!this.connection) {
      try {
        this.connection = await connectRealtime({
          channel: channelName,
          onMessage: (data) => {
            if (data && typeof data === 'object' && 'type' in data) {
              const message = data as EffectsUpdatedMessage;
              if (message.type === 'effects_updated') {
                const now = Date.now();
                const filtered = (message.effects || []).filter(
                  (e) => e.expiresAt > now
                );
                this.subscribers.forEach((cb) => cb(filtered));
              }
            }
          },
        });
      } catch {
        // Ignore connection failures
      }
    }

    // Return cleanup
    return () => {
      this.subscribers.delete(onEffectsUpdate);
      if (this.subscribers.size === 0 && this.connection) {
        void this.connection.disconnect();
        this.connection = null;
      }
    };
  }
}

const realtimeRewardsManager = new RealtimeRewardsManager();

export function useActiveEffects(): {
  effects: ActiveEffectEntry[];
  currentEffect: ActiveEffectEntry | null;
  secondsRemaining: number;
} {
  const [effects, setEffects] = useState<ActiveEffectEntry[]>([]);
  const [cycleIndex, setCycleIndex] = useState(0);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const cycleTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);

  // Initial fetch
  const { data: initialEffects } = trpc.app.rewards.getActiveEffects.useQuery(
    undefined,
    {
      enabled: !!context.userId,
      staleTime: 5000,
    }
  );

  // Sync from TRPC
  useEffect(() => {
    if (initialEffects && Array.isArray(initialEffects)) {
      const now = Date.now();
      setEffects(initialEffects.filter((e) => e.expiresAt > now));
    }
  }, [initialEffects]);

  // Realtime subscription
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    if (context.userId) {
      void realtimeRewardsManager
        .connect((updated) => {
          setEffects(updated);
        })
        .then((c) => {
          cleanup = c;
        });
    }
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Expiry tick (1s)
  useEffect(() => {
    tickTimerRef.current = window.setInterval(() => {
      const now = Date.now();
      setNowTs(now);
      setEffects((prev) => prev.filter((e) => e.expiresAt > now));
    }, 1000) as unknown as number;
    return () => {
      if (tickTimerRef.current) window.clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    };
  }, []);

  // Cycle timer (3s)
  useEffect(() => {
    // Reset index if out of bounds
    setCycleIndex((idx) => (effects.length === 0 ? 0 : idx % effects.length));
    if (cycleTimerRef.current) {
      window.clearInterval(cycleTimerRef.current);
      cycleTimerRef.current = null;
    }
    if (effects.length > 1) {
      cycleTimerRef.current = window.setInterval(() => {
        setCycleIndex((idx) => (idx + 1) % effects.length);
      }, 3000) as unknown as number;
    }
    return () => {
      if (cycleTimerRef.current) window.clearInterval(cycleTimerRef.current);
      cycleTimerRef.current = null;
    };
  }, [effects.length]);

  const currentEffect = useMemo(() => {
    if (effects.length === 0) return null;
    const safeIndex = Math.min(cycleIndex, Math.max(0, effects.length - 1));
    return effects[safeIndex] ?? null;
  }, [effects, cycleIndex]);

  const secondsRemaining = useMemo(() => {
    if (!currentEffect) return 0;
    return Math.max(0, Math.ceil((currentEffect.expiresAt - nowTs) / 1000));
  }, [currentEffect, nowTs]);

  return { effects, currentEffect, secondsRemaining };
}
