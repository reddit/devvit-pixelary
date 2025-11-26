/**
 * Centralized rewards system - single source of truth for all reward logic
 */

export type RewardType =
  | 'extra_drawing_time'
  | 'extra_word_time'
  | 'add_remove_words'
  | 'level_flair';

type RewardConfig = {
  minLevel: number;
  getLabel: (level: number) => string; // Dynamic label for UI display
  getValue?: (level: number) => number; // Raw computed value (e.g., seconds)
};

const REWARDS: Record<RewardType, RewardConfig> = {
  extra_drawing_time: {
    minLevel: 2,
    getLabel: (level) => `+${Math.max(0, (level - 1) * 15)}s drawing time`,
    getValue: (level) => Math.max(0, (level - 1) * 15), // Returns seconds as number
  },
  extra_word_time: {
    minLevel: 2,
    getLabel: (level) => `+${Math.max(0, (level - 1) * 2)}s selection time`,
    getValue: (level) => Math.max(0, (level - 1) * 2), // Returns seconds as number
  },
  add_remove_words: {
    minLevel: 3,
    getLabel: () => 'Add/remove words',
  },
  level_flair: {
    minLevel: 1,
    getLabel: () => 'Level user flair',
  },
};

/**
 * Check if a user level has access to a specific reward
 */
export function hasReward(userLevel: number, reward: RewardType): boolean {
  const config = REWARDS[reward];
  return userLevel >= config.minLevel;
}

/**
 * Get the raw computed value for a reward (if applicable)
 */
export function getRewardValue(
  userLevel: number,
  reward: RewardType
): number | undefined {
  const config = REWARDS[reward];
  if (!hasReward(userLevel, reward) || !config.getValue) {
    return undefined;
  }
  return config.getValue(userLevel);
}

/**
 * Get the display label for a reward at a specific level
 */
export function getRewardLabel(reward: RewardType, userLevel: number): string {
  const config = REWARDS[reward];
  return config.getLabel(userLevel);
}

/**
 * Get all available reward types
 */
export function getAllRewards(): RewardType[] {
  return Object.keys(REWARDS) as RewardType[];
}

/**
 * Get rewards available at a specific level
 */
export function getRewardsByLevel(level: number): RewardType[] {
  return getAllRewards().filter((reward) => hasReward(level, reward));
}

/**
 * Convenience helper to get extra drawing time for a level
 */
export function getExtraDrawingTime(level: number): number {
  return getRewardValue(level, 'extra_drawing_time') ?? 0;
}

/**
 * Convenience helper to get extra word selection time for a level
 */
export function getExtraWordTime(level: number): number {
  return getRewardValue(level, 'extra_word_time') ?? 0;
}

/**
 * Get the minimum level required for a reward
 */
export function getRewardMinLevel(reward: RewardType): number {
  const config = REWARDS[reward];
  return config.minLevel;
}
