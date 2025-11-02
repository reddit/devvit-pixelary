import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@devvit/web/server', () => ({
  redis: {
    hIncrBy: vi.fn(),
  },
}));

import { redis } from '@devvit/web/server';
import type { T1 } from '@devvit/shared-types/tid.js';
import { REDIS_KEYS } from '@server/core/redis';
import { incrementEntryViews } from './post';

describe('incrementEntryViews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('increments views field on tournament entry hash', async () => {
    const commentId = 't1_test' as T1;
    vi.mocked(redis.hIncrBy).mockResolvedValue(1 as never);

    await incrementEntryViews(commentId);

    expect(redis.hIncrBy).toHaveBeenCalledWith(
      REDIS_KEYS.tournamentEntry(commentId),
      'views',
      1
    );
  });
});
