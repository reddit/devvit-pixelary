import { describe, it, expect } from 'vitest';
import { calculateEloChange } from './elo';

describe('calculateEloChange', () => {
  it('awards more (or equal due to rounding) points when underdog wins', () => {
    const { winnerChange, loserChange } = calculateEloChange(1000, 1400);
    expect(winnerChange).toBeGreaterThan(0);
    expect(winnerChange).toBeGreaterThanOrEqual(Math.abs(loserChange));
  });

  it('awards fewer points when favorite wins', () => {
    const { winnerChange, loserChange } = calculateEloChange(1400, 1000);
    expect(winnerChange).toBeGreaterThan(0);
    // Favorite gains less than underdog scenario
    const underdogWin = calculateEloChange(1000, 1400);
    expect(winnerChange).toBeLessThan(underdogWin.winnerChange);
    expect(loserChange).toBeLessThan(0);
  });

  it('sum of changes should be close to zero', () => {
    const { winnerChange, loserChange } = calculateEloChange(1200, 1200);
    // With rounding, they may not be exact opposites; allow |sum| <= 1
    expect(Math.abs(winnerChange + loserChange)).toBeLessThanOrEqual(1);
  });
});
