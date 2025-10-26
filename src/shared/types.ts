/*
 * Color types
 */

export type HEX = `#${string}`;

export type RGB = {
  r: number;
  g: number;
  b: number;
};

export type SlateAction = 'slate_served' | 'slate_picked' | 'slate_posted';

/**
 * Progression system
 */

export type Level = {
  rank: number;
  name: string;
  min: number;
  max: number;
};

/**
 * Telemetry types
 */
export type PostType = 'drawing' | 'pinned' | 'tournament';

export type TelemetryEventType =
  // View events
  | 'view_menu'
  | 'view_my_drawings'
  | 'view_leaderboard'
  | 'view_how_to_play'
  | 'view_my_rewards'
  | 'view_level_details'
  | 'view_drawing_post'
  | 'view_guess'
  | 'view_results'
  | 'view_editor'
  | 'view_word_step'
  | 'view_draw_step'
  | 'view_review_step'
  | 'view_slate'
  // Click events
  | 'click_draw'
  | 'click_my_drawings'
  | 'click_leaderboard'
  | 'click_how_to_play'
  | 'click_my_rewards'
  | 'click_level_details'
  | 'click_close_my_drawings'
  | 'click_drawing_tile'
  | 'click_start_drawing'
  | 'click_close_leaderboard'
  | 'click_close_how_to_play'
  | 'click_close_my_rewards'
  | 'click_close_level_details'
  | 'click_level_prev'
  | 'click_level_next'
  | 'click_guess_submit'
  | 'click_give_up'
  | 'click_draw_something'
  | 'click_close_results'
  | 'click_word_candidate'
  | 'click_refresh_words'
  | 'click_done_drawing'
  | 'click_color_swatch'
  | 'click_color_picker_plus'
  | 'click_post_drawing'
  | 'click_cancel_drawing'
  // Drawing events
  | 'drawing_start'
  | 'drawing_first_pixel'
  | 'drawing_done_auto'
  | 'drawing_done_manual'
  | 'first_pixel_drawn'
  | 'select_extended_color'
  // Post events (specific taxonomy)
  | 'post_impression' // Post viewed (affects social metrics)
  | 'post_guess' // User submitted guess
  | 'post_solve' // User solved the drawing
  | 'post_skip'; // User gave up/skipped

/**
 * Slate system types
 */
export type SlateData = {
  slateId: string;
  words: string[];
  timestamp: number;
};

export type WordMetrics = {
  impressions: number;
  clicks: number; // picks
  clickRate: number;
  publishes: number; // finishes
  publishRate: number;
  starts: number;
  guesses: number;
  skips: number;
  solves: number;
  skipRate: number;
  solveRate: number;
  upvotes: number;
  comments: number;
};

export type SlateMetrics = {
  served: number;
  upvotes: number;
  comments: number;
};
