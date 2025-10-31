import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@server/services/progression', () => ({
  getScore: vi.fn().mockResolvedValue(200), // Level 2
  getUserLevel: (score: number) => ({
    rank: score >= 100 ? 2 : 1,
    name: 'Level',
    min: 100,
    max: 999,
  }),
}));

vi.mock('@shared/rewards', () => ({
  getExtraDrawingTime: (level: number) => (level - 1) * 15,
}));

vi.mock('./activity', () => ({
  getActivityDrawingTimeBonus: vi.fn().mockResolvedValue({
    postsLast7d: 10,
    qualifies: true,
    extraDrawingTimeSeconds: 20,
  }),
}));

vi.mock('./consumables', () => ({
  getActiveExtraDrawingTimeSeconds: vi.fn().mockResolvedValue(30),
  getEffectiveScoreMultiplier: vi.fn().mockResolvedValue(2),
}));

const { getEffectiveBonuses } = await import('./index');

describe('Rewards aggregator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns numeric bonuses and breakdown shape', async () => {
    const result = await getEffectiveBonuses('t2_user' as never);
    expect(typeof result.extraDrawingTimeSeconds).toBe('number');
    expect(result).toHaveProperty('breakdown');
    expect(typeof result.breakdown.levelExtra).toBe('number');
    expect(typeof result.breakdown.activityExtra).toBe('number');
    expect(typeof result.breakdown.consumableExtra).toBe('number');
  });
});
