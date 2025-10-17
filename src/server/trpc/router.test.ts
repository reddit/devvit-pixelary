import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from './router';
import { redis } from '@devvit/web/server';
import {
  createMockCandidateWord,
  createMockDictionary,
  createMockUserProfile,
  createMockDrawingSubmitInput,
  createMockGuessSubmitInput,
} from '../../shared/test-utils';

vi.mock('../services/redis', () => {
  return {
    getConfig: vi.fn(async () => ({ timerSec: 60 })),
    getStats: vi.fn(async () => ({ plays: 1, completions: 0, activeUsers: 0 })),
    saveDrawing: vi.fn(async () => ({ rev: 1 })),
    getDrawing: vi.fn(async () => ({ rev: 1, strokes: [] })),
    clearDrawing: vi.fn(async () => ({ ok: true })),
    submitScore: vi.fn(async () => ({ ok: true })),
    getTop: vi.fn(async () => [{ username: 'u', score: 1 }]),
    refreshPresence: vi.fn(async () => ({ ok: true, activeUsers: 2 })),
    setCurrentGame: vi.fn(async () => ({ ok: true })),
    getCurrentGame: vi.fn(async () => null),
    clearCurrentGame: vi.fn(async () => ({ ok: true })),
    addHistoryEntry: vi.fn(async () => ({ ok: true })),
    incrementCompletions: vi.fn(async () => {}),
    getHistory: vi.fn(async () => [
      { prompt: 'tree', score: 10, finishedAt: 1 },
    ]),
    isRateLimited: vi.fn(async () => false),
    REDIS_KEYS: {
      scores: () => 'scores',
    },
  };
});

vi.mock('@devvit/web/server', () => {
  return {
    reddit: {
      getPostById: vi.fn(async () => ({ setPostData: vi.fn(async () => {}) })),
      getModerators: vi.fn(async () => ({ all: vi.fn(async () => []) })),
    },
    realtime: { send: vi.fn(async () => {}) },
    redis: {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      incr: vi.fn(),
      mget: vi.fn(),
      zadd: vi.fn(),
      zrange: vi.fn(),
      zcard: vi.fn(),
      zscore: vi.fn(),
      zrank: vi.fn(),
      zrevrank: vi.fn(),
      hget: vi.fn(),
      hset: vi.fn(),
      hgetall: vi.fn(),
      hdel: vi.fn(),
      hincrby: vi.fn(),
      sadd: vi.fn(),
      srem: vi.fn(),
      smembers: vi.fn(),
      sismember: vi.fn(),
      lpush: vi.fn(),
      rpop: vi.fn(),
      llen: vi.fn(),
      lrange: vi.fn(),
      expire: vi.fn(),
      ttl: vi.fn(),
      exists: vi.fn(),
      keys: vi.fn(),
      flushdb: vi.fn(),
      // Additional methods used in tests
      hGet: vi.fn(),
      zScore: vi.fn(),
      zRevRank: vi.fn(),
      zCard: vi.fn(),
      isRateLimited: vi.fn(),
    },
    scheduler: {
      runAfter: vi.fn(),
      runAt: vi.fn(),
      runEvery: vi.fn(),
      cancelJob: vi.fn(),
    },
  } as {
    postId: string | null;
    subredditName: string;
    username: string | null;
    redis: typeof redis;
    scheduler: {
      runAfter: (delay: number, job: unknown) => Promise<void>;
      runAt: (time: Date, job: unknown) => Promise<void>;
      runEvery: (interval: number, job: unknown) => Promise<void>;
      cancelJob: (jobId: string) => Promise<void>;
    };
  };
});

describe('appRouter', () => {
  const ctx = {
    postId: 't3_abc' as `t3_${string}`,
    subredditName: 'sub',
    username: 'user',
    userId: 't2_user123' as `t2_${string}`,
    subredditId: 't5_sub' as `t5_${string}`,
    postData: { type: 'drawing' as const },
    reddit: {
      getPostById: vi.fn(async () => ({ setPostData: vi.fn(async () => {}) })),
      getModerators: vi.fn(async () => ({ all: vi.fn(async () => []) })),
    },
    scheduler: {
      runJob: vi.fn(async () => 'job123'),
    },
    realtime: { send: vi.fn(async () => {}) },
  } as const;
  const caller = appRouter.createCaller(ctx as unknown);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('System endpoints', () => {
    it('system.ping returns ok', async () => {
      const res = await caller.system.ping();
      expect(res).toEqual({ ok: true });
    });
  });

  describe('App endpoints', () => {
    beforeEach(() => {
      // Mock app service responses
      vi.mocked(redis.get).mockResolvedValue(
        JSON.stringify(createMockDictionary())
      );
      vi.mocked(redis.hGet).mockResolvedValue(
        JSON.stringify(createMockUserProfile())
      );
      vi.mocked(redis.zScore).mockResolvedValue(1000);
      vi.mocked(redis.zRevRank).mockResolvedValue(5);
      vi.mocked(redis.zCard).mockResolvedValue(100);
    });

    it('app.dictionary.get returns dictionary', async () => {
      const dict = await caller.app.dictionary.get();
      expect(dict).toBeTruthy();
    });

    it('app.dictionary.getCandidates returns candidates', async () => {
      const candidates = await caller.app.dictionary.getCandidates();
      expect(candidates).toBeTruthy();
    });

    it('app.user.getProfile returns user profile', async () => {
      const profile = await caller.app.user.getProfile();
      expect(profile).toBeTruthy();
    });

    it('app.user.getRank returns user rank', async () => {
      const rank = await caller.app.user.getRank();
      expect(rank).toBeTruthy();
    });

    it('app.leaderboard.getTop returns leaderboard', async () => {
      const leaderboard = await caller.app.leaderboard.getTop();
      expect(leaderboard).toBeTruthy();
    });

    it('app.post.submitDrawing works', async () => {
      const result = await caller.app.post.submitDrawing(
        createMockDrawingSubmitInput()
      );
      expect(result).toBeTruthy();
    });

    it('app.guess.submit works', async () => {
      const result = await caller.app.guess.submit(
        createMockGuessSubmitInput()
      );
      expect(result).toBeTruthy();
    });

    it('app.guess.getStats returns guess stats', async () => {
      const stats = await caller.app.guess.getStats({ postId: 't3_test123' });
      expect(stats).toBeTruthy();
    });
  });

  describe('Error handling', () => {
    it('handles missing context gracefully', async () => {
      const invalidCtx = { ...ctx, subredditName: undefined };
      const invalidCaller = appRouter.createCaller(invalidCtx as unknown);

      // Should not throw, but may return different results
      const res = await invalidCaller.system.ping();
      expect(res).toEqual({ ok: true });
    });

    it('validates input schemas', async () => {
      await expect(caller.app.dictionary.add({ word: '' })).rejects.toThrow();
    });
  });

  describe('Rate limiting', () => {
    it('respects rate limits', async () => {
      vi.mocked(redis.isRateLimited).mockResolvedValue(true);

      await expect(
        caller.app.guess.submit(createMockGuessSubmitInput())
      ).rejects.toThrow();
    });
  });
});
