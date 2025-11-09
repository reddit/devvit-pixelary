import { describe, it, expect } from 'vitest';
import {
  CONSUMABLES_CONFIG,
  getConsumablesGrantedOnLevelClaim,
} from './consumables';

describe('consumables config', () => {
  it('has reasonable shape for all items', () => {
    for (const [id, cfg] of Object.entries(CONSUMABLES_CONFIG)) {
      // id consistency
      expect(cfg.id).toBe(id);
      // label: string with minimal length
      expect(typeof cfg.label).toBe('string');
      expect(cfg.label.length).toBeGreaterThanOrEqual(3);
      // description: string with minimal length
      expect(typeof cfg.description).toBe('string');
      expect(cfg.description.length).toBeGreaterThanOrEqual(3);
      // duration: positive number
      expect(typeof cfg.durationMs).toBe('number');
      expect(cfg.durationMs).toBeGreaterThan(0);
      // effect: type-appropriate numeric fields
      switch (cfg.effect.kind) {
        case 'score_multiplier':
          expect(typeof cfg.effect.multiplier).toBe('number');
          expect(cfg.effect.multiplier).toBeGreaterThanOrEqual(2);
          break;
        case 'extra_drawing_time':
          expect(typeof cfg.effect.extraSeconds).toBe('number');
          expect(cfg.effect.extraSeconds).toBeGreaterThan(0);
          break;
        default: {
          // Exhaustiveness check at compile time
          const _exhaustiveCheck: never = cfg.effect;
          expect(_exhaustiveCheck).toBeUndefined();
        }
      }
    }
  });
});

describe('level-claim consumables', () => {
  it('grants 5x score_multiplier_2x on any level', () => {
    for (const level of [2, 5, 10, 25]) {
      const items = getConsumablesGrantedOnLevelClaim(level);
      expect(items).toEqual([{ itemId: 'score_multiplier_2x', quantity: 5 }]);
    }
  });
});
