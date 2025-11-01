export const REALTIME_CHANNELS = {
  userRewards: (userId: string) => `user-${userId}-rewards`,
  userLevelUp: (userId: string) => `user-${userId}-levelup`,
  post: (postId: string) => `post-${postId}`,
} as const;
