import { describe, it, expect } from 'vitest';
import { getEffectDescription, getEffectIcon, type ConsumableEffect } from './consumables';

describe('consumables helpers', () => {
  it('describes score multiplier effects', () => {
    const effect: ConsumableEffect = { kind: 'score_multiplier', multiplier: 3 };
    expect(getEffectDescription(effect)).toBe(
      'All points earned are multiplied by 3x while active.'
    );
  });

  it('describes extra drawing time effects', () => {
    const effect: ConsumableEffect = { kind: 'extra_drawing_time', extraSeconds: 30 };
    expect(getEffectDescription(effect)).toBe('Adds +30s to your drawing timer.');
  });

  it('maps icons by effect kind', () => {
    expect(getEffectIcon({ kind: 'score_multiplier', multiplier: 2 })).toBe('star');
    expect(getEffectIcon({ kind: 'extra_drawing_time', extraSeconds: 30 })).toBe('clock');
  });
});


