import { context, reddit, realtime, scheduler } from '@devvit/web/server';
import type { PostData } from '@shared/schema';
import type { T2, T3, T5 } from '@devvit/shared-types/tid.js';

export async function createContext() {
  const username = await reddit.getCurrentUsername();
  const { postId, subredditName, subredditId, postData, userId } = context;
  return {
    postId: (postId as T3 | null) ?? null,
    subredditName: subredditName ?? null,
    subredditId: (subredditId as T5 | null) ?? null,
    username: username ?? null,
    userId: (userId as T2 | null) ?? null,
    postData: postData as PostData | null,
    reddit,
    scheduler,
    realtime,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
