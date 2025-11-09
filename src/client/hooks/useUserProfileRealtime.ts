import { useEffect } from 'react';
import { connectRealtime, disconnectRealtime, context } from '@devvit/web/client';
import { REALTIME_CHANNELS } from '@shared/realtime';
import type { LevelUpChannelMessage } from '@shared/realtime';
import { trpc } from '@client/trpc/client';

export function useUserProfileRealtime(): void {
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!context.userId) return;
    const userId = context.userId;
    const channelName = REALTIME_CHANNELS.userLevelUp(userId);

    let isMounted = true;
    let cleanup: (() => void) | undefined;

    void (async () => {
      try {
        const connection = await connectRealtime({
          channel: channelName,
          onMessage: (data) => {
            if (!isMounted) return;
            if (data && typeof data === 'object' && 'type' in data) {
              const message = data as LevelUpChannelMessage;
              if (
                message.type === 'score_changed' ||
                message.type === 'levelup_pending' ||
                message.type === 'levelup_claimed'
              ) {
                void utils.app.user.getProfile.invalidate();
                void utils.app.user.getLevel.invalidate();
                void utils.app.user.getUnclaimedLevelUp.invalidate();
                void utils.app.user.getProfile.refetch();
                void utils.app.user.getLevel.refetch();
                void utils.app.user.getUnclaimedLevelUp.refetch();
              }
            }
          },
        });
        cleanup = () => {
          void disconnectRealtime(channelName);
        };
      } catch {
        // ignore realtime connection errors
      }
    })();

    return () => {
      isMounted = false;
      if (cleanup) cleanup();
    };
  }, [utils]);
}


