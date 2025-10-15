import { context, reddit, realtime, scheduler } from '@devvit/web/server';
import type { PostData } from '../../shared/schema';

export async function createContext() {
  const username = await reddit.getCurrentUsername();
  const { postId, subredditName, postData, userId } = context;
  return {
    postId: postId ?? null,
    subredditName: subredditName ?? null,
    username: username ?? null,
    userId: userId ?? null,
    postData: postData as PostData | null,
    reddit,
    scheduler, // Direct scheduler import
    realtime, // Devvit realtime for broadcasting messages
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
