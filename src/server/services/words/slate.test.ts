import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { redis } from '@devvit/web/server';
import * as Slate from './slate';
import { REDIS_KEYS } from '@server/core/redis';

vi.mock('@devvit/web/server', () => ({
  context: { subredditName: 'test-subreddit' },
  redis: {
    hGetAll: vi.fn(),
    hGet: vi.fn(),
    hSet: vi.fn(),
    hIncrBy: vi.fn(),
    exists: vi.fn(),
    zAdd: vi.fn(),
    zRange: vi.fn(),
    zCard: vi.fn(),
    zScore: vi.fn(),
    expire: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    global: {
      zRange: vi.fn(),
      zAdd: vi.fn(),
      hGetAll: vi.fn(),
      expire: vi.fn(),
      exists: vi.fn(),
    },
  },
}));

// Deterministic shuffle for slate generation
vi.mock('@shared/utils/array', () => ({
  shuffle: (arr: string[]) => arr,
}));

describe('Slate System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('get/set SlateBanditConfig', () => {
    it('returns default config when none stored', async () => {
      vi.mocked(redis.hGetAll).mockResolvedValue({});
      const config = await Slate.getSlateBanditConfig();
      expect(config).toEqual({
        explorationRate: 0.1,
        zScoreClamp: 3,
        weightPickRate: 1,
        weightPostRate: 1,
        ucbConstant: 2,
        scoreDecayRate: 0.1,
      });
    });

    it('clamps and coerces config values correctly', async () => {
      vi.mocked(redis.hGetAll).mockResolvedValue({
        explorationRate: '1.5', // -> 1
        zScoreClamp: '0', // -> 0.1 min
        weightPickRate: '-5', // -> 0 min
        weightPostRate: '5', // -> 5
        ucbConstant: '-0.5', // -> 0.1 min
        scoreDecayRate: '2', // -> 1 max
      });
      const config = await Slate.getSlateBanditConfig();
      expect(config).toEqual({
        explorationRate: 1,
        zScoreClamp: 0.1,
        weightPickRate: 0,
        weightPostRate: 5,
        ucbConstant: 0.1,
        scoreDecayRate: 1,
      });
    });

    it('persists config as strings', async () => {
      const cfg = {
        explorationRate: 0.25,
        zScoreClamp: 2.5,
        weightPickRate: 3,
        weightPostRate: 4,
        ucbConstant: 1.8,
        scoreDecayRate: 0.2,
      } as const;
      await Slate.setSlateBanditConfig(cfg);
      expect(redis.hSet).toHaveBeenCalledWith(REDIS_KEYS.slateConfig(), {
        explorationRate: '0.25',
        zScoreClamp: '2.5',
        weightPickRate: '3',
        weightPostRate: '4',
        ucbConstant: '1.8',
        scoreDecayRate: '0.2',
      });
    });
  });

  describe('initSlateBandit', () => {
    it('writes default config and seeds uncertainty when missing', async () => {
      vi.mocked(redis.exists).mockResolvedValue(0 as never);
      vi.mocked(redis.global.exists).mockResolvedValue(0 as never);
      vi.mocked(redis.global.zRange).mockResolvedValue([
        { member: 'Apple', score: 1 } as never,
        { member: 'Banana', score: 2 } as never,
      ]);

      await Slate.initSlateBandit();

      expect(redis.hSet).toHaveBeenCalledWith(
        REDIS_KEYS.slateConfig(),
        expect.objectContaining({
          explorationRate: expect.any(String),
          zScoreClamp: expect.any(String),
          weightPickRate: expect.any(String),
          weightPostRate: expect.any(String),
          ucbConstant: expect.any(String),
          scoreDecayRate: expect.any(String),
        })
      );

      const initialUncertainty = 1 / Math.sqrt(10);
      expect(redis.global.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsUncertainty('test-subreddit'),
        { member: 'Apple', score: initialUncertainty },
        { member: 'Banana', score: initialUncertainty }
      );
    });
  });

  describe('pickWordsWithUCB', () => {
    it('picks highest UCB words deterministically with Math.random=0', async () => {
      // Default config ucbConstant=2
      vi.mocked(redis.hGetAll).mockResolvedValue({});
      vi.mocked(redis.global.zRange).mockImplementation(async (key: string) => {
        if (key === REDIS_KEYS.wordsAll('test-subreddit')) {
          return [
            { member: 'A', score: 5 } as never,
            { member: 'B', score: 4 } as never,
            { member: 'C', score: 3 } as never,
            { member: 'D', score: 1 } as never,
          ];
        }
        if (key === REDIS_KEYS.wordsUncertainty('test-subreddit')) {
          return [
            { member: 'A', score: 0 } as never,
            { member: 'B', score: 0 } as never,
            { member: 'C', score: 0 } as never,
            { member: 'D', score: 0 } as never,
          ];
        }
        return [] as never;
      });
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const result = await Slate.pickWordsWithUCB(3);
      expect(result).toEqual(['A', 'B', 'C']);
    });

    it('throws when not enough words', async () => {
      vi.mocked(redis.hGetAll).mockResolvedValue({});
      vi.mocked(redis.global.zRange).mockResolvedValue([
        { member: 'A', score: 1 } as never,
        { member: 'B', score: 1 } as never,
      ]);
      await expect(Slate.pickWordsWithUCB(3)).rejects.toThrow(
        /Not enough words/
      );
    });
  });

  describe('generateSlate', () => {
    it('generates slate from UCB picks and persists to redis', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-02T03:00:00Z'));
      vi.spyOn(crypto, 'randomUUID').mockReturnValue(
        '00000000-0000-0000-0000-000000000000'
      );

      // Provide data for deterministic pickWordsWithUCB -> ['A','B','C']
      vi.mocked(redis.hGetAll).mockResolvedValue({});
      vi.mocked(redis.global.zRange).mockImplementation(async (key: string) => {
        if (key === REDIS_KEYS.wordsAll('test-subreddit')) {
          return [
            { member: 'A', score: 5 } as never,
            { member: 'B', score: 4 } as never,
            { member: 'C', score: 3 } as never,
          ];
        }
        if (key === REDIS_KEYS.wordsUncertainty('test-subreddit')) {
          return [
            { member: 'A', score: 0 } as never,
            { member: 'B', score: 0 } as never,
            { member: 'C', score: 0 } as never,
          ];
        }
        return [] as never;
      });
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const slate = await Slate.generateSlate();

      expect(slate.words.sort()).toEqual(['A', 'B', 'C']);
      expect(redis.hSet).toHaveBeenCalledWith(
        REDIS_KEYS.slate('slate_00000000-0000-0000-0000-000000000000'),
        expect.objectContaining({
          slateId: 'slate_00000000-0000-0000-0000-000000000000',
          words: JSON.stringify(['A', 'B', 'C']),
          timestamp: expect.any(String),
        })
      );
      expect(redis.expire).toHaveBeenCalledWith(
        REDIS_KEYS.slate('slate_00000000-0000-0000-0000-000000000000'),
        90 * 24 * 60 * 60
      );
    });
  });

  describe('handleSlateEvent', () => {
    it('records served events for all words in the slate', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-02-01T12:34:00.000Z'));
      const ts = Slate.getCurrentTimestamp();
      vi.mocked(redis.hGet).mockResolvedValue(JSON.stringify(['A', 'B', 'C']));

      await Slate.handleSlateEvent({
        slateId: 'slate_1' as never,
        name: 'slate_served',
        timestamp: 'ignored',
      });

      // Hourly and total served increments
      expect(redis.hIncrBy).toHaveBeenCalledWith(
        REDIS_KEYS.wordsHourlyStats('test-subreddit', ts),
        'A:served',
        1
      );
      expect(redis.hIncrBy).toHaveBeenCalledWith(
        REDIS_KEYS.wordsTotalStats('test-subreddit'),
        'A:served',
        1
      );
      // Writes servedAt and active set entries
      expect(redis.hSet).toHaveBeenCalledWith(
        REDIS_KEYS.slate('slate_1' as never),
        { servedAt: ts }
      );
      expect(redis.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsActive('test-subreddit', ts),
        { member: 'A', score: 0 }
      );
      expect(redis.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsLastServed('test-subreddit'),
        { member: 'A', score: expect.any(Number) }
      );
    });

    it('records picked and posted events', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-02-01T12:34:00.000Z'));
      const ts = Slate.getCurrentTimestamp();

      await Slate.handleSlateEvent({
        slateId: 'slate_2' as never,
        name: 'slate_picked',
        timestamp: 'ignored',
        word: 'Alpha',
        position: 2,
      });
      expect(redis.hIncrBy).toHaveBeenCalledWith(
        REDIS_KEYS.wordsHourlyStats('test-subreddit', ts),
        'Alpha:picked',
        1
      );
      expect(redis.hSet).toHaveBeenCalledWith(
        REDIS_KEYS.slate('slate_2' as never),
        { word: 'Alpha', position: '2', pickedAt: ts }
      );

      await Slate.handleSlateEvent({
        slateId: 'slate_2' as never,
        name: 'slate_posted',
        word: 'Alpha',
        postId: 't3_test' as never,
      });
      expect(redis.hIncrBy).toHaveBeenCalledWith(
        REDIS_KEYS.wordsTotalStats('test-subreddit'),
        'Alpha:posted',
        1
      );
      expect(redis.hSet).toHaveBeenCalledWith(
        REDIS_KEYS.slate('slate_2' as never),
        { word: 'Alpha', postId: 't3_test', postedAt: ts }
      );
    });
  });

  describe('applyScoreDecay', () => {
    it('decays drawerScore based on time since last served', async () => {
      vi.useFakeTimers();
      const now = new Date('2025-03-01T00:00:00Z');
      vi.setSystemTime(now);
      const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
      vi.mocked(redis.zRange).mockResolvedValue([
        { member: 'Alpha', score: now.getTime() - twoDaysMs } as never,
      ]);

      const stats = {
        Alpha: {
          hourly: { served: 1, picked: 0, posted: 0, pickRate: 0, postRate: 0 },
          total: { served: 10, picked: 0, posted: 0 },
          drawerScore: 1,
          drawerUncertainty: 0.3,
        },
        Beta: {
          hourly: { served: 0, picked: 0, posted: 0, pickRate: 0, postRate: 0 },
          total: { served: 0, picked: 0, posted: 0 },
        },
      } as const;
      const config = {
        explorationRate: 0.1,
        zScoreClamp: 3,
        weightPickRate: 1,
        weightPostRate: 1,
        ucbConstant: 2,
        scoreDecayRate: 0.1,
      } as const;

      const decayed = (await Slate.applyScoreDecay(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { ...(stats as any) },
        config,
        'test-subreddit'
      )) as Record<string, { drawerScore?: number }>;

      const expectedFactor = Math.exp(-config.scoreDecayRate * 2);
      const alpha = decayed.Alpha;
      expect(alpha).toBeDefined();
      if (!alpha) {
        throw new Error('Alpha missing in decayed results');
      }
      expect(alpha.drawerScore).toBeCloseTo(1 * expectedFactor, 6);
      // Unserved or missing drawerScore entries are untouched
      expect(decayed.Beta?.drawerScore).toBeUndefined();
    });
  });

  describe('updateWordScores', () => {
    beforeEach(() => {
      vi.spyOn(Slate, 'getSlateBanditConfig').mockResolvedValue({
        explorationRate: 0.1,
        zScoreClamp: 3,
        weightPickRate: 1,
        weightPostRate: 1,
        ucbConstant: 2,
        scoreDecayRate: 0.1,
      });
      vi.spyOn(Slate, 'applyScoreDecay').mockImplementation(
        async (s, _c, _subName) => s
      );
      vi.mocked(redis.set).mockResolvedValue(true as never);
      vi.mocked(redis.del).mockResolvedValue(undefined as never);
      vi.mocked(redis.global.zAdd).mockResolvedValue(undefined as never);
      vi.mocked(redis.expire).mockResolvedValue(undefined as never);
    });

    it('computes z-scores, uncertainties, and writes scores', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-04-01T10:15:00Z'));

      // Words
      vi.mocked(redis.global.zRange).mockResolvedValue([
        { member: 'Alpha', score: 1 } as never,
        { member: 'Beta', score: 1 } as never,
      ]);

      // Hourly stats for previous hour
      vi.mocked(redis.hGetAll).mockImplementation(async (key: string) => {
        if (key.startsWith('words:hourly:')) {
          return {
            'Alpha:served': '100',
            'Alpha:picked': '40',
            'Alpha:posted': '38',
            'Beta:served': '100',
            'Beta:picked': '10',
            'Beta:posted': '5',
          } as never;
        }
        if (key.startsWith('words:total:')) {
          return {
            'Alpha:served': '100',
            'Alpha:picked': '40',
            'Alpha:posted': '38',
            'Beta:served': '100',
            'Beta:picked': '10',
            'Beta:posted': '5',
          } as never;
        }
        return {} as never;
      });

      await Slate.updateWordScores('test-subreddit');

      // Scores should be computed and written for wordsAll
      expect(redis.global.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('test-subreddit'),
        { member: 'Alpha', score: expect.any(Number) },
        { member: 'Beta', score: expect.any(Number) }
      );

      // Uncertainties = 1/sqrt(totalServed)
      const uAlpha = 1 / Math.sqrt(100);
      const uBeta = 1 / Math.sqrt(100);
      expect(redis.global.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsUncertainty('test-subreddit'),
        { member: 'Alpha', score: uAlpha },
        { member: 'Beta', score: uBeta }
      );

      // Hourly stats expiration set
      expect(redis.expire).toHaveBeenCalledWith(
        expect.stringContaining('words:hourly:test-subreddit:'),
        90 * 24 * 60 * 60
      );
    });

    it('handles empty word list gracefully', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-04-01T10:15:00Z'));
      vi.mocked(redis.global.zRange).mockResolvedValue([]);
      vi.mocked(redis.hGetAll).mockResolvedValue({} as never);

      await Slate.updateWordScores('test-subreddit');

      // Should not write any scores
      expect(redis.global.zAdd).not.toHaveBeenCalled();
    });

    it('handles lock acquisition failure', async () => {
      vi.mocked(redis.set).mockResolvedValue(false as never);

      await expect(Slate.updateWordScores('test-subreddit')).rejects.toThrow(
        /already in progress/
      );
    });

    it('handles Redis zRange failure', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-04-01T10:15:00Z'));
      vi.mocked(redis.global.zRange).mockRejectedValue(
        new Error('Redis connection failed')
      );

      await expect(Slate.updateWordScores('test-subreddit')).rejects.toThrow(
        /Failed to fetch data/
      );
    });

    it('handles invalid/malformed stats data', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-04-01T10:15:00Z'));
      vi.mocked(redis.global.zRange).mockResolvedValue([
        { member: 'Alpha', score: 1 } as never,
        { member: 'Beta', score: 1 } as never,
      ]);

      vi.mocked(redis.hGetAll).mockImplementation(async (key: string) => {
        if (key.startsWith('words:hourly:')) {
          return {
            'Alpha:served': 'NaN',
            'Alpha:picked': 'invalid',
            'Alpha:posted': '-5', // Negative number
            'Beta:served': '100',
            'Beta:picked': '10',
            'Beta:posted': '5',
          } as never;
        }
        if (key.startsWith('words:total:')) {
          return {
            'Alpha:served': '100',
            'Alpha:picked': '40',
            'Alpha:posted': '38',
            'Beta:served': '100',
            'Beta:picked': '10',
            'Beta:posted': '5',
          } as never;
        }
        return {} as never;
      });

      // Should handle invalid data gracefully and still process valid words
      await Slate.updateWordScores('test-subreddit');

      // Should still write scores (with defaults for invalid data)
      expect(redis.global.zAdd).toHaveBeenCalled();
    });

    it('handles single word scenario', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-04-01T10:15:00Z'));
      vi.mocked(redis.global.zRange).mockResolvedValue([
        { member: 'Alpha', score: 1 } as never,
      ]);

      vi.mocked(redis.hGetAll).mockImplementation(async (key: string) => {
        if (key.startsWith('words:hourly:')) {
          return {
            'Alpha:served': '100',
            'Alpha:picked': '40',
            'Alpha:posted': '38',
          } as never;
        }
        if (key.startsWith('words:total:')) {
          return {
            'Alpha:served': '100',
            'Alpha:picked': '40',
            'Alpha:posted': '38',
          } as never;
        }
        return {} as never;
      });

      await Slate.updateWordScores('test-subreddit');

      // Should handle single word (std dev will be 1 by default)
      expect(redis.global.zAdd).toHaveBeenCalled();
    });

    it('handles zero values in all stats', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-04-01T10:15:00Z'));
      vi.mocked(redis.global.zRange).mockResolvedValue([
        { member: 'Alpha', score: 1 } as never,
      ]);

      vi.mocked(redis.hGetAll).mockResolvedValue({
        'Alpha:served': '0',
        'Alpha:picked': '0',
        'Alpha:posted': '0',
      } as never);

      await Slate.updateWordScores('test-subreddit');

      // Should handle zero stats and set score to 0
      expect(redis.global.zAdd).toHaveBeenCalled();
      const calls = vi.mocked(redis.global.zAdd).mock.calls;
      const scoreCall = calls.find(
        (call) => call[0] === REDIS_KEYS.wordsAll('test-subreddit')
      );
      expect(scoreCall).toBeDefined();
      if (scoreCall) {
        expect(scoreCall[1]).toEqual({ member: 'Alpha', score: 0 });
      }
    });

    it('handles Redis write failures gracefully', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-04-01T10:15:00Z'));
      vi.mocked(redis.global.zRange).mockResolvedValue([
        { member: 'Alpha', score: 1 } as never,
      ]);
      vi.mocked(redis.hGetAll).mockResolvedValue({
        'Alpha:served': '100',
        'Alpha:picked': '40',
        'Alpha:posted': '38',
      } as never);
      // Mock zAdd to reject for the first call (scores), succeed for second (uncertainties)
      vi.mocked(redis.global.zAdd)
        .mockRejectedValueOnce(new Error('Write failed'))
        .mockResolvedValueOnce(undefined as never);

      await expect(Slate.updateWordScores('test-subreddit')).rejects.toThrow(
        /Failed to write scores/
      );
    });

    it('validates computed scores are finite before writing', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-04-01T10:15:00Z'));
      vi.mocked(redis.global.zRange).mockResolvedValue([
        { member: 'Alpha', score: 1 } as never,
      ]);
      vi.mocked(redis.hGetAll).mockResolvedValue({
        'Alpha:served': '100',
        'Alpha:picked': '40',
        'Alpha:posted': '38',
      } as never);

      // Mock applyScoreDecay to return invalid score
      vi.spyOn(Slate, 'applyScoreDecay').mockImplementation(
        async (wordStats, _config, _subredditName) => {
          if (!wordStats.Alpha) {
            return wordStats;
          }
          return {
            ...wordStats,
            Alpha: {
              ...wordStats.Alpha,
              hourly: wordStats.Alpha.hourly,
              total: wordStats.Alpha.total,
              drawerScore: NaN,
              drawerUncertainty: Infinity,
            },
          };
        }
      );

      await Slate.updateWordScores('test-subreddit');

      // Should filter out invalid scores or use defaults
      expect(redis.global.zAdd).toHaveBeenCalled();
    });
  });

  describe('applyScoreDecay', () => {
    it('handles invalid timestamps gracefully', async () => {
      vi.useFakeTimers();
      const now = new Date('2025-03-01T00:00:00Z');
      vi.setSystemTime(now);

      // Invalid timestamp (future date)
      vi.mocked(redis.zRange).mockResolvedValue([
        { member: 'Alpha', score: now.getTime() + 1000000 } as never,
      ]);

      const stats = {
        Alpha: {
          hourly: { served: 1, picked: 0, posted: 0, pickRate: 0, postRate: 0 },
          total: { served: 10, picked: 0, posted: 0 },
          drawerScore: 1,
          drawerUncertainty: 0.3,
        },
      } as const;
      const config = {
        explorationRate: 0.1,
        zScoreClamp: 3,
        weightPickRate: 1,
        weightPostRate: 1,
        ucbConstant: 2,
        scoreDecayRate: 0.1,
      } as const;

      const result = await Slate.applyScoreDecay(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { ...(stats as any) },
        config,
        'test-subreddit'
      );

      // Should skip decay for invalid timestamp but return stats
      expect(result.Alpha?.drawerScore).toBe(1);
    });

    it('handles missing lastServed data', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-03-01T00:00:00Z'));
      vi.mocked(redis.zRange).mockResolvedValue([]);

      const stats = {
        Alpha: {
          hourly: { served: 1, picked: 0, posted: 0, pickRate: 0, postRate: 0 },
          total: { served: 10, picked: 0, posted: 0 },
          drawerScore: 1,
          drawerUncertainty: 0.3,
        },
      } as const;
      const config = {
        explorationRate: 0.1,
        zScoreClamp: 3,
        weightPickRate: 1,
        weightPostRate: 1,
        ucbConstant: 2,
        scoreDecayRate: 0.1,
      } as const;

      const result = await Slate.applyScoreDecay(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { ...(stats as any) },
        config,
        'test-subreddit'
      );

      // Should return original stats when no lastServed data
      expect(result.Alpha?.drawerScore).toBe(1);
    });

    it('handles Redis errors gracefully', async () => {
      vi.mocked(redis.zRange).mockRejectedValue(new Error('Redis error'));

      const stats = {
        Alpha: {
          hourly: { served: 1, picked: 0, posted: 0, pickRate: 0, postRate: 0 },
          total: { served: 10, picked: 0, posted: 0 },
          drawerScore: 1,
        },
      } as const;
      const config = {
        explorationRate: 0.1,
        zScoreClamp: 3,
        weightPickRate: 1,
        weightPostRate: 1,
        ucbConstant: 2,
        scoreDecayRate: 0.1,
      } as const;

      // Should return original stats on error
      const result = await Slate.applyScoreDecay(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { ...(stats as any) },
        config,
        'test-subreddit'
      );

      expect(result.Alpha?.drawerScore).toBe(1);
    });
  });
});
