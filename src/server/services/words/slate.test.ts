import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redis } from '@devvit/web/server';
import {
  getSlateBanditConfig,
  setSlateBanditConfig,
  initSlateBandit,
  pickWordsWithUCB,
  generateSlate,
  updateWordScores,
  applyScoreDecay,
} from './slate';
import { REDIS_KEYS } from '../redis';

vi.mock('@devvit/web/server', () => ({
  context: { subredditName: 'test-subreddit' },
  redis: {
    hGetAll: vi.fn(),
    hSet: vi.fn(),
    hIncrBy: vi.fn(),
    exists: vi.fn(),
    zAdd: vi.fn(),
    zRange: vi.fn(),
    zCard: vi.fn(),
    zScore: vi.fn(),
    expire: vi.fn(),
    global: { zRange: vi.fn(), zAdd: vi.fn(), exists: vi.fn() },
  },
}));

describe('Slate System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns default config', async () => {
    vi.mocked(redis.hGetAll).mockResolvedValue({});
    const config = await getSlateBanditConfig();
    expect(config.explorationRate).toBe(0.1);
  });
});
