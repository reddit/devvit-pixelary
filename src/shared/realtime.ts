export const REALTIME_CHANNELS = {
  userRewards: (userId: string) => `user_${userId}_rewards`,
  userLevelUp: (userId: string) => `user_${userId}_levelup`,
  post: (postId: string) => `post_${postId}`,
} as const;

// User-level channel message types
export type LevelUpPendingMessage = {
  type: 'levelup_pending';
  level: number;
  score: number;
  timestamp: number;
};

export type LevelUpClaimedMessage = {
  type: 'levelup_claimed';
  timestamp: number;
};

export type ScoreChangedMessage = {
  type: 'score_changed';
  level: number;
  score: number;
  timestamp: number;
};

export type LevelUpChannelMessage =
  | LevelUpPendingMessage
  | LevelUpClaimedMessage
  | ScoreChangedMessage;
