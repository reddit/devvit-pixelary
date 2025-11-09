/**
 * Shared consumables catalog and types
 * Defines IDs, configs, and effect contracts used by client and server
 */

export type ConsumableEffect =
  | { kind: 'score_multiplier'; multiplier: number }
  | { kind: 'extra_drawing_time'; extraSeconds: number };

export const CONSUMABLES_CONFIG = {
  score_multiplier_2x: {
    id: 'score_multiplier_2x',
    label: 'DOUBLE POINTS!',
    description: 'On all points earned while active',
    durationMs: 4 * 60 * 60 * 1000,
    effect: { kind: 'score_multiplier', multiplier: 2 },
  },
  score_multiplier_3x: {
    id: 'score_multiplier_3x',
    label: 'TRIPLE POINTS!',
    description: 'On all points earned while active',
    durationMs: 30 * 60 * 1000,
    effect: { kind: 'score_multiplier', multiplier: 3 },
  },
  draw_time_boost_30s: {
    id: 'draw_time_boost_30s',
    label: 'EXTRA TIME!',
    description: 'Adds +30s to your drawing timer!',
    durationMs: 2 * 60 * 60 * 1000,
    effect: { kind: 'extra_drawing_time', extraSeconds: 30 },
  },
} as const;

export type ConsumableId = keyof typeof CONSUMABLES_CONFIG;
export type ConsumableConfig = (typeof CONSUMABLES_CONFIG)[ConsumableId] & {
  durationMs: number;
  effect: ConsumableEffect;
};

export function getConsumableConfig(id: ConsumableId): ConsumableConfig {
  return CONSUMABLES_CONFIG[id];
}

// Consumables granted when a user claims a level-up
export type GrantedConsumable = {
  itemId: ConsumableId;
  quantity: number;
};

export function getConsumablesGrantedOnLevelClaim(
  _level: number
): GrantedConsumable[] {
  // Static grant for now; can evolve by level later
  return [{ itemId: 'score_multiplier_2x', quantity: 5 }];
}
