// Types
export type T1 = `t1_${string}`;
export type T2 = `t2_${string}`;
export type T3 = `t3_${string}`;
export type T4 = `t4_${string}`;
export type T5 = `t5_${string}`;

// Type guards
export function isT1(id: string): id is T1 {
  return id.startsWith('t1_');
}
export function isT2(id: string): id is T2 {
  return id.startsWith('t2_');
}

export function isT3(id: string): id is T3 {
  return id.startsWith('t3_');
}

export function isT4(id: string): id is T4 {
  return id.startsWith('t4_');
}

export function isT5(id: string): id is T5 {
  return id.startsWith('t5_');
}

// Assertions
export function assertT1(id: string): asserts id is T1 {
  if (!isT1(id)) throw new Error('Invalid ID: ' + id);
}

export function assertT2(id: string): asserts id is T2 {
  if (!isT2(id)) throw new Error('Invalid ID: ' + id);
}

export function assertT3(id: string): asserts id is T3 {
  if (!isT3(id)) throw new Error('Invalid ID: ' + id);
}

export function assertT4(id: string): asserts id is T4 {
  if (!isT4(id)) throw new Error('Invalid ID: ' + id);
}

export function assertT5(id: string): asserts id is T5 {
  if (!isT5(id)) throw new Error('Invalid ID: ' + id);
}

// Parsing
export function parseT1(id: string): T1 {
  assertT1(id);
  return id as T1;
}

export function parseT2(id: string): T2 {
  assertT2(id);
  return id as T2;
}

export function parseT3(id: string): T3 {
  assertT3(id);
  return id as T3;
}

export function parseT4(id: string): T4 {
  assertT4(id);
  return id as T4;
}

export function parseT5(id: string): T5 {
  assertT5(id);
  return id as T5;
}

/*
 * Color types
 */

export type RGB = {
  r: number;
  g: number;
  b: number;
};

export type HEX = `#${string}`;

/**
 * Progression system
 */

export type Level = {
  rank: number;
  name: string;
  min: number;
  max: number;
  extraTime: number;
};

/**
 * Telemetry types
 */
export type PostType = 'drawing' | 'pinned';

export type TelemetryEventType =
  // View events
  | 'view_menu'
  | 'view_my_drawings'
  | 'view_leaderboard'
  | 'view_how_to_play'
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
  | 'click_level_details'
  | 'click_close_my_drawings'
  | 'click_drawing_tile'
  | 'click_start_drawing'
  | 'click_close_leaderboard'
  | 'click_close_how_to_play'
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
  | 'click_post_drawing'
  | 'click_cancel_drawing';

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
  clicks: number;
  clickRate: number;
  publishes: number;
  publishRate: number;
};
