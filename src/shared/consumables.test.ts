import { describe, it, expect } from 'vitest';
import { getEffectDescription, type ConsumableEffect } from './consumables';

describe('consumables helpers', () => {
  it('describes score multiplier effects', () => {
    const effect: ConsumableEffect = {
      kind: 'score_multiplier',
      multiplier: 3,
    };
    expect(getEffectDescription(effect)).toBe(
      'On all points earned while active'
    );
  });

  it('describes extra drawing time effects', () => {
    const effect: ConsumableEffect = {
      kind: 'extra_drawing_time',
      extraSeconds: 30,
    };
    expect(getEffectDescription(effect)).toBe(
      'Adds +30s to your drawing timer!'
    );
  });
});
