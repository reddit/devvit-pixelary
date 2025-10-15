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
  };
});

vi.mock('@devvit/web/server', () => {
  return {
    reddit: {
      getPostById: vi.fn(async () => ({ setPostData: vi.fn(async () => {}) })),
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
    postData: { type: 'drawing' as const },
    reddit: {
      getPostById: vi.fn(async () => ({ setPostData: vi.fn(async () => {}) })),
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
    it('system.ping returns pong', async () => {
      const res = await caller.system.ping();
      expect(res).toBe('pong');
    });

    it('session.init returns config and stats', async () => {
      const res = await caller.session.init();
      expect(res.config).toBeTruthy();
      expect(res.stats).toBeTruthy();
    });
  });

  describe('Drawing endpoints', () => {
    it('drawing upsert/get/clear works', async () => {
      await caller.drawing.upsert({ rev: 1, delta: [] });
      const got = await caller.drawing.get();
      expect(got.rev).toBeGreaterThanOrEqual(0);
      await caller.drawing.clear();
    });

    it('drawing upsert handles invalid input', async () => {
      await expect(
        caller.drawing.upsert({ rev: -1, delta: [] })
      ).rejects.toThrow();
    });
  });

  describe('Progress and Leaderboard endpoints', () => {
    it('progress submit works', async () => {
      const res = await caller.progress.submit({ score: 5 });
      expect(res).toBeTruthy();
    });

    it('progress submit rejects negative score', async () => {
      await expect(caller.progress.submit({ score: -1 })).rejects.toThrow();
    });
  });

  describe('Game endpoints', () => {
    it('game start/status/finish flow', async () => {
      const start = await caller.game.start({ durationSec: 10 });
      expect(start.prompt).toBeTruthy();
      const status = await caller.game.status();
      expect(status).toBeTruthy();
      await caller.game.finish({ score: 3 });
    });

    it('game start rejects invalid duration', async () => {
      await expect(caller.game.start({ durationSec: -1 })).rejects.toThrow();
    });

    it('game finish rejects negative score', async () => {
      await expect(caller.game.finish({ score: -1 })).rejects.toThrow();
    });
  });

  describe('History endpoints', () => {
    it('history.get returns entries', async () => {
      const h = await caller.history.get({ limit: 5 });
      expect(h.length).toBeGreaterThanOrEqual(1);
    });

    it('history.get respects limit', async () => {
      const h = await caller.history.get({ limit: 3 });
      expect(h.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Stats endpoints', () => {
    it('stats.get returns stats', async () => {
      const stats = await caller.stats.get();
      expect(stats).toBeTruthy();
      expect(stats.plays).toBeDefined();
      expect(stats.completions).toBeDefined();
      expect(stats.activeUsers).toBeDefined();
    });
  });

  describe('Config endpoints', () => {
    it('config.update works', async () => {
      const res = await caller.config.update({ timerSec: 90, mode: 'test' });
      expect(res).toBeTruthy();
    });

    it('config.update validates timerSec', async () => {
      await expect(caller.config.update({ timerSec: -1 })).rejects.toThrow();
    });
  });

  describe('Pixelary-specific endpoints', () => {
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
      expect(Array.isArray(candidates)).toBe(true);
    });

    it('app.user.getProfile returns user profile', async () => {
      const profile = await caller.app.user.getProfile();
      expect(profile).toBeTruthy();
      expect(profile.username).toBeDefined();
      expect(profile.score).toBeDefined();
    });

    it('app.user.getRank returns user rank', async () => {
      const rank = await caller.app.user.getRank();
      expect(rank).toBeTruthy();
      expect(rank.rank).toBeDefined();
      expect(rank.score).toBeDefined();
    });

    it('app.leaderboard.getTop returns leaderboard', async () => {
      const leaderboard = await caller.app.leaderboard.getTop({
        limit: 10,
      });
      expect(Array.isArray(leaderboard)).toBe(true);
    });

    it('app.drawing.submit works', async () => {
      const input = createMockDrawingSubmitInput();
      const result = await caller.app.drawing.submit(input);
      expect(result).toBeTruthy();
    });

    it('app.guess.submit works', async () => {
      const input = createMockGuessSubmitInput();
      const result = await caller.app.guess.submit(input);
      expect(result).toBeTruthy();
    });

    it('app.guess.getStats returns guess stats', async () => {
      const stats = await caller.app.guess.getStats({
        postId: 't3_test123',
      });
      expect(stats).toBeTruthy();
    });
  });

  describe('Error handling', () => {
    it('handles missing context gracefully', async () => {
      const invalidCtx = {
        postId: null,
        subredditName: null,
        username: null,
        userId: null,
        postData: null,
        reddit: {
          getPostById: vi.fn(async () => ({
            setPostData: vi.fn(async () => {}),
          })),
        },
        scheduler: {
          runJob: vi.fn(async () => 'job123'),
        },
        realtime: { send: vi.fn(async () => {}) },
      };
      const invalidCaller = appRouter.createCaller(invalidCtx as unknown);

      // Should not throw, but may return different results
      const res = await invalidCaller.system.ping();
      expect(res).toBe('pong');
    });

    it('validates input schemas', async () => {
      await expect(
        caller.progress.submit({ score: 'invalid' } as unknown)
      ).rejects.toThrow();
      await expect(
        caller.app.leaderboard.getTop({ limit: 'invalid' } as unknown)
      ).rejects.toThrow();
      await expect(
        caller.game.start({ durationSec: 'invalid' } as unknown)
      ).rejects.toThrow();
    });
  });

  describe('Rate limiting', () => {
    it('respects rate limits', async () => {
      vi.mocked(redis.isRateLimited).mockResolvedValue(true);

      await expect(caller.progress.submit({ score: 5 })).rejects.toThrow();
    });
  });
});
