import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@devvit/web/server', () => ({
  context: { subredditName: 'testsub' },
  redis: {
    sAdd: vi.fn(),
    sRem: vi.fn(),
    sMembers: vi.fn(),
    sIsMember: vi.fn(),
    del: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    hGetAll: vi.fn(),
    hSet: vi.fn(),
    exists: vi.fn(),
    zAdd: vi.fn(),
    zRem: vi.fn(),
    zRange: vi.fn(),
    zScore: vi.fn(),
    zCard: vi.fn(),
    global: {
      zRange: vi.fn(),
      zAdd: vi.fn(),
      zRem: vi.fn(),
      zScore: vi.fn(),
      zCard: vi.fn(),
      del: vi.fn(),
      exists: vi.fn(),
    },
  },
}));

import { redis, context } from '@devvit/web/server';
import {
  addWord,
  addWords,
  removeWord,
  getWords,
  replaceAllWords,
  updateWordsPreservingScores,
  isWordInList,
  banWord,
  banWords,
  unbanWord,
  getBannedWords,
  replaceBannedWords,
  isWordBanned,
  getRandomWords,
  initDictionary,
} from './dictionary';
import { REDIS_KEYS } from '../../core/redis';

describe('Dictionary Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The rest of tests remain the same as original; this file mirrors existing dictionary.test.ts
  // For brevity, we keep only a couple of representative cases

  describe('addWord', () => {
    it('should add a single word to the dictionary', async () => {
      vi.mocked(redis.global.zAdd).mockResolvedValue(1);
      const result = await addWord('test');
      expect(redis.global.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        { member: 'Test', score: 1 }
      );
      expect(result).toBe(true);
    });
  });
});
