// Pixelary game constants

export const PIXELARY_CONFIG = {
  primarySubredditName: 'Pixelary',
  resolution: 16,
  postLiveSpan: 86400000,
  feedbackDuration: 15,
  cardDrawDuration: 10,
  drawingDuration: 60,
  colors: [
    '#FFFFFF', // 0 - white
    '#000000', // 1 - black
    '#EB5757', // 2 - red
    '#F2994A', // 3 - orange
    '#F2C94C', // 4 - yellow
    '#27AE60', // 5 - green
    '#2F80ED', // 6 - blue
    '#9B51E0', // 7 - purple
  ],
  pinnedPost: {
    title: "Let's play Pixelary!",
  },
  rewards: {
    authorRewardForSubmit: 10,
    authorRewardForCorrectGuess: 1,
    guesserRewardForSolve: 2,
    guesserRewardForFirstSolve: 10,
    userRewardForCrosspost: 5,
    userRewardForReport: 2,
  },
} as const;

// Scoring constants (aliases for easier access)
export const AUTHOR_REWARD_SUBMIT =
  PIXELARY_CONFIG.rewards.authorRewardForSubmit;
export const AUTHOR_REWARD_CORRECT_GUESS =
  PIXELARY_CONFIG.rewards.authorRewardForCorrectGuess;
export const GUESSER_REWARD_SOLVE =
  PIXELARY_CONFIG.rewards.guesserRewardForSolve;
export const GUESSER_REWARD_FIRST_SOLVE =
  PIXELARY_CONFIG.rewards.guesserRewardForFirstSolve;
export const DRAWING_DURATION = PIXELARY_CONFIG.drawingDuration;
export const CARD_DRAW_DURATION = PIXELARY_CONFIG.cardDrawDuration;
export const RESOLUTION = PIXELARY_CONFIG.resolution;

// Level progression (powers of 2)
export const LEVELS = [
  { rank: 1, name: 'Newcomer', min: 0, max: 1, extraTime: 0 },
  { rank: 2, name: 'Apprentice', min: 2, max: 3, extraTime: 3 },
  { rank: 3, name: 'Artist', min: 4, max: 7, extraTime: 6 },
  { rank: 4, name: 'Creator', min: 8, max: 15, extraTime: 9 },
  { rank: 5, name: 'Master', min: 16, max: 31, extraTime: 12 },
  { rank: 6, name: 'Expert', min: 32, max: 63, extraTime: 15 },
  { rank: 7, name: 'Virtuoso', min: 64, max: 127, extraTime: 18 },
  { rank: 8, name: 'Legend', min: 128, max: 255, extraTime: 21 },
  { rank: 9, name: 'Champion', min: 256, max: 511, extraTime: 24 },
  { rank: 10, name: 'Grandmaster', min: 512, max: 1023, extraTime: 27 },
  { rank: 11, name: 'Pixelary God', min: 1024, max: 2047, extraTime: 30 },
  { rank: 12, name: 'Pixelary Deity', min: 2048, max: 4095, extraTime: 33 },
  { rank: 13, name: 'Pixelary Supreme', min: 4096, max: 8191, extraTime: 36 },
  {
    rank: 14,
    name: 'Pixelary Transcendent',
    min: 8192,
    max: 16383,
    extraTime: 39,
  },
  { rank: 15, name: 'Pixelary Eternal', min: 16384, max: 32767, extraTime: 42 },
] as const;

export type PixelaryConfig = typeof PIXELARY_CONFIG;
export type PixelaryColors = typeof PIXELARY_CONFIG.colors;
export type Level = (typeof LEVELS)[number];
