/*
 * Pixelary game constants
 */

export const CANONICAL_SUBREDDIT_NAME = 'Pixelary';
export const DRAWING_DURATION = 60;
export const CARD_DRAW_DURATION = 10;
export const TOAST_DURATION_MS = 3000;
export const DRAWING_RESOLUTION = 16;

/*
 * Pinned posts
 */

export const DEFAULT_PINNED_POST_TITLE = 'Welcome to Pixelary!';

/*
 * Collection posts
 */

export const DEFAULT_COLLECTION_POST_TITLE = 'Top drawings this week!';
export const DEFAULT_COLLECTION_POST_LABEL = 'Top drawings\nthis week!';
export const DEFAULT_COLLECTION_POST_NUMBER_OF_DAYS = 7;
export const DEFAULT_COLLECTION_POST_NUMBER_OF_DRAWINGS = 6;

/*
 * Drawing posts
 */

export const AUTHOR_REWARD_SUBMIT = 25;
export const AUTHOR_REWARD_CORRECT_GUESS = 1;
export const GUESSER_REWARD_SOLVE = 5;

/*
 * Drawing tournaments
 */

// Rewards
export const TOURNAMENT_REWARD_VOTE = 1;

// Daily payout snapshots
export const TOURNAMENT_PAYOUT_SNAPSHOT_COUNT = 5;
export const TOURNAMENT_PAYOUT_INTERVAL_HOURS = 24;
// Cohort and amounts
export const TOURNAMENT_PAYOUT_TOP_PERCENT = 20; // Top N% each snapshot (min 1)
export const TOURNAMENT_PAYOUT_REWARD_TOP_PERCENT = 10; // Per-user reward for being in top N%
export const TOURNAMENT_PAYOUT_LADDER_FIRST = 30; // Additional bonus for rank 1
export const TOURNAMENT_PAYOUT_LADDER_SECOND = 20; // Additional bonus for rank 2
export const TOURNAMENT_PAYOUT_LADDER_THIRD = 10; // Additional bonus for rank 3

// ELO constants
export const TOURNAMENT_ELO_K_FACTOR = 32;
export const TOURNAMENT_ELO_INITIAL_RATING = 1200;

// Default drawing prompt
export const TOURNAMENT_FALLBACK_WORD = 'Meatloaf';

/*
 * Levels
 */

// First 10 named levels (order of magnitude progression: 10x per level)
// Levels 11+ are generated dynamically as "Bonus N"
export const LEVELS = [
  { rank: 1, name: 'Doodle', min: 0, max: 99 },
  { rank: 2, name: 'Sketch', min: 100, max: 999 },
  { rank: 3, name: 'Outline', min: 1000, max: 9999 },
  { rank: 4, name: 'Shade', min: 10000, max: 99999 },
  { rank: 5, name: 'Paint', min: 100000, max: 999999 },
  { rank: 6, name: 'Detail', min: 1000000, max: 9999999 },
  { rank: 7, name: 'Render', min: 10000000, max: 99999999 },
  { rank: 8, name: 'Frame', min: 100000000, max: 999999999 },
  { rank: 9, name: 'Exhibit', min: 1000000000, max: 9999999999 },
  { rank: 10, name: 'Master', min: 10000000000, max: 99999999999 },
] as const;
