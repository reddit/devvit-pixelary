import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getRecentColors, pushRecentColor } from './colors';
import { redis } from '@devvit/web/server';
import type { T2 } from '@devvit/shared-types/tid.js';
import { DEFAULT_MRU_COLORS } from '@client/constants';

describe('user colors service', () => {
  const userId = 't2_testuser' as T2;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('seeds recent colors when none exist and returns newest-first (limit 7)', async () => {
    // No existing colors
    (redis.zRange as unknown as vi.Mock).mockResolvedValueOnce([]);

    const result = await getRecentColors(userId, DEFAULT_MRU_COLORS, 7);

    // Should seed exactly 7 entries
    expect(redis.zAdd as unknown as vi.Mock).toHaveBeenCalledTimes(7);
    // Newest-first should be reverse of seed
    const expected = [...DEFAULT_MRU_COLORS].slice().reverse();
    expect(result).toEqual(expected);
  });

  it('pushRecentColor prunes extras beyond limit', async () => {
    // Extras returned from zRange for pruning
    (redis.zRange as unknown as vi.Mock).mockResolvedValueOnce([
      { member: '#CCCCCC', score: Date.now() - 10 },
      { member: '#A6A6A6', score: Date.now() - 20 },
    ]);

    // Use a valid color from DRAWING_COLORS
    await pushRecentColor(userId, '#000000', 7);

    expect(redis.zAdd as unknown as vi.Mock).toHaveBeenCalledTimes(1);
    expect(redis.zRem as unknown as vi.Mock).toHaveBeenCalledWith(
      expect.any(String),
      ['#CCCCCC', '#A6A6A6']
    );
  });

  it('pushRecentColor rejects invalid colors', async () => {
    await pushRecentColor(userId, '#123456' as never, 7);

    // Should not add invalid colors to Redis
    expect(redis.zAdd as unknown as vi.Mock).not.toHaveBeenCalled();
  });
});
