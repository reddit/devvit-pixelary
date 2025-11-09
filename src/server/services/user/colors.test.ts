import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getRecentColors, pushRecentColor } from './colors';
import { redis } from '@devvit/web/server';
import type { T2 } from '@devvit/shared-types/tid.js';
import { BASE_DRAWING_COLORS } from '@shared/constants';

describe('user colors service', () => {
  const userId = 't2_testuser' as T2;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('seeds recent colors when none exist and returns newest-first (limit 6)', async () => {
    // No existing colors
    (redis.zRange as unknown as vi.Mock).mockResolvedValueOnce([]);

    const result = await getRecentColors(userId, BASE_DRAWING_COLORS, 6);

    // Should seed exactly 6 entries
    expect((redis.zAdd as unknown as vi.Mock)).toHaveBeenCalledTimes(6);
    // Newest-first should be reverse of seed slice(0,6)
    const expected = BASE_DRAWING_COLORS.slice(0, 6).slice().reverse();
    expect(result).toEqual(expected);
  });

  it('pushRecentColor prunes extras beyond limit', async () => {
    // Extras returned from zRange for pruning
    (redis.zRange as unknown as vi.Mock).mockResolvedValueOnce([
      { member: '#C7C7C7', score: Date.now() - 10 },
      { member: '#C8C8C8', score: Date.now() - 20 },
    ]);

    await pushRecentColor(userId, '#123456', 6);

    expect((redis.zAdd as unknown as vi.Mock)).toHaveBeenCalledTimes(1);
    expect((redis.zRem as unknown as vi.Mock)).toHaveBeenCalledWith(
      expect.any(String),
      ['#C7C7C7', '#C8C8C8']
    );
  });
});


