// Pixelary game constants
export const CANONICAL_SUBREDDIT_NAME = 'Pixelary';
export const DEFAULT_PINNED_POST_TITLE = "Let's play Pixelary!";

// Scoring constants (aliases for easier access)

/*
 * Rewards
 */

export const AUTHOR_REWARD_SUBMIT = 25;
export const AUTHOR_REWARD_CORRECT_GUESS = 1;
export const GUESSER_REWARD_SOLVE = 5;

// Tournament rewards
export const TOURNAMENT_REWARD_VOTE = 1;
export const TOURNAMENT_REWARD_WINNER = 250;
export const TOURNAMENT_REWARD_TOP_10 = 100;
export const TOURNAMENT_ELO_K_FACTOR = 32;
export const TOURNAMENT_ELO_INITIAL_RATING = 1200;

/*
 * Timers
 */

export const DRAWING_DURATION = 60;
export const CARD_DRAW_DURATION = 10;
export const TOAST_DURATION_MS = 3000;

/*
 * Drawings
 */

export const DRAWING_RESOLUTION = 16;

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
