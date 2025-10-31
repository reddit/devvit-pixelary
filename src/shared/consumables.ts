/**
 * Shared consumables catalog and types
 * Defines IDs, configs, and effect contracts used by client and server
 */

export type ConsumableId =
  | 'score_multiplier_2x_4h'
  | 'score_multiplier_3x_30m'
  | 'draw_time_boost_30s_2h';

export type ConsumableEffect =
  | { kind: 'score_multiplier'; multiplier: number }
  | { kind: 'extra_drawing_time'; extraSeconds: number };

export type ConsumableConfig = {
  id: ConsumableId;
  label: string;
  durationMs: number; // Duration an activation remains active
  effect: ConsumableEffect;
};

export const CONSUMABLES_CONFIG: Record<ConsumableId, ConsumableConfig> = {
  score_multiplier_2x_4h: {
    id: 'score_multiplier_2x_4h',
    label: '2× Score (4h)',
    durationMs: 4 * 60 * 60 * 1000,
    effect: { kind: 'score_multiplier', multiplier: 2 },
  },
  score_multiplier_3x_30m: {
    id: 'score_multiplier_3x_30m',
    label: '3× Score (30m)',
    durationMs: 30 * 60 * 1000,
    effect: { kind: 'score_multiplier', multiplier: 3 },
  },
  draw_time_boost_30s_2h: {
    id: 'draw_time_boost_30s_2h',
    label: '+30s Drawing Time (2h)',
    durationMs: 2 * 60 * 60 * 1000,
    effect: { kind: 'extra_drawing_time', extraSeconds: 30 },
  },
};

export const SCORE_MULTIPLIER_IDS: ConsumableId[] = [
  'score_multiplier_2x_4h',
  'score_multiplier_3x_30m',
];

export const DRAW_TIME_BOOST_IDS: ConsumableId[] = ['draw_time_boost_30s_2h'];

export function getConsumableConfig(id: ConsumableId): ConsumableConfig {
  return CONSUMABLES_CONFIG[id];
}
