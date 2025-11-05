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

// Deterministic shuffle for getRandomWords
vi.mock('@shared/utils/array', () => ({
  shuffle: (arr: string[]) => arr,
}));

import { redis } from '@devvit/web/server';
import * as Dictionary from './dictionary';
import { REDIS_KEYS } from '@server/core/redis';

describe('Dictionary Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addWord', () => {
    it('should add a single word to the dictionary', async () => {
      vi.mocked(redis.global.zAdd).mockResolvedValue(1);
      const result = await Dictionary.addWord('test');
      expect(redis.global.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        { member: 'Test', score: 1 }
      );
      expect(result).toBe(true);
    });

    it('should not add if word is banned', async () => {
      vi.mocked(redis.zScore).mockResolvedValue(1 as never);
      const result = await Dictionary.addWord('banned');
      expect(result).toBe(false);
      expect(redis.global.zAdd).not.toHaveBeenCalled();
    });
  });

  describe('addWords', () => {
    it('adds non-banned normalized words and filters banned ones', async () => {
      // getBannedWords reads from non-global redis.zRange
      vi.mocked(redis.zRange).mockResolvedValue([
        { member: 'Banned', score: 1 } as never,
      ]);
      vi.mocked(redis.zCard).mockResolvedValue(1 as never);

      await Dictionary.addWords([' test  ', 'bAnNeD']);

      expect(redis.global.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        { member: 'Test', score: 1 }
      );
    });
  });

  describe('removeWord', () => {
    it('removes from dictionary and uncertainty', async () => {
      vi.mocked(redis.global.zRem).mockResolvedValue(1 as never);
      vi.mocked(redis.zRem).mockResolvedValue(1 as never);

      const result = await Dictionary.removeWord('  teST  ');
      expect(result).toBe(true);
      expect(redis.global.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        ['Test']
      );
      expect(redis.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsUncertainty('testsub'),
        ['Test']
      );
    });
  });

  describe('getWords', () => {
    it('paginates and maps members correctly', async () => {
      vi.mocked(redis.global.zRange).mockResolvedValue([
        { member: 'Cat', score: 1 } as never,
        { member: 'Dog', score: 1 } as never,
      ]);
      vi.mocked(redis.global.zCard).mockResolvedValue(5 as never);

      const result = await Dictionary.getWords(undefined, 0, 2);
      expect(result).toEqual({
        words: ['Cat', 'Dog'],
        total: 5,
        hasMore: true,
      });
    });
  });

  describe('replaceAllWords', () => {
    it('clears existing words and adds new ones when provided', async () => {
      vi.mocked(redis.global.del).mockResolvedValue(1 as never);
      // No banned words
      vi.mocked(redis.zRange).mockResolvedValue([] as never);
      vi.mocked(redis.zCard).mockResolvedValue(0 as never);

      await Dictionary.replaceAllWords(['cat', 'dog']);

      expect(redis.global.del).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub')
      );
      // addWords path ultimately zAdds normalized words
      expect(redis.global.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        { member: 'Cat', score: 1 },
        { member: 'Dog', score: 1 }
      );
    });

    it('clears and does not add when list is empty', async () => {
      vi.mocked(redis.global.del).mockResolvedValue(1 as never);
      const addWordsSpy = vi.spyOn(Dictionary, 'addWords').mockResolvedValue();

      await Dictionary.replaceAllWords([]);

      expect(redis.global.del).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub')
      );
      expect(addWordsSpy).not.toHaveBeenCalled();
    });
  });

  describe('updateWordsPreservingScores', () => {
    it('adds new words and removes absent ones while filtering banned', async () => {
      vi.mocked(redis.global.zRange).mockResolvedValue([
        { member: 'Cat', score: 5 } as never,
        { member: 'Dog', score: 1 } as never,
      ]);
      // Banned includes Bird
      vi.mocked(redis.zRange).mockResolvedValue([
        { member: 'Bird', score: 1 } as never,
      ]);
      vi.mocked(redis.zCard).mockResolvedValue(1 as never);

      await Dictionary.updateWordsPreservingScores(['dog', 'bird', 'fox']);

      expect(redis.global.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        ['Cat']
      );
      expect(redis.global.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        { member: 'Fox', score: 1 }
      );
    });
  });

  describe('isWordInList', () => {
    it('returns true when score exists', async () => {
      vi.mocked(redis.global.zScore).mockResolvedValue(1 as never);
      await expect(Dictionary.isWordInList('cat')).resolves.toBe(true);
    });
    it('returns false when score is undefined', async () => {
      vi.mocked(redis.global.zScore).mockResolvedValue(undefined as never);
      await expect(Dictionary.isWordInList('cat')).resolves.toBe(false);
    });
  });

  describe('banWord / banWords / unbanWord', () => {
    it('banWord moves word to banned set and removes elsewhere', async () => {
      vi.mocked(redis.zAdd).mockResolvedValue(1 as never);
      vi.mocked(redis.global.zRem).mockResolvedValue(1 as never);
      vi.mocked(redis.zRem).mockResolvedValue(1 as never);

      await Dictionary.banWord('  cat  ');

      expect(redis.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsBanned('testsub'),
        { member: 'Cat', score: 1 }
      );
      expect(redis.global.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        ['Cat']
      );
      expect(redis.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsUncertainty('testsub'),
        ['Cat']
      );
    });

    it('banWords moves multiple words and removes from other sets', async () => {
      vi.mocked(redis.zAdd).mockResolvedValue(2 as never);
      vi.mocked(redis.global.zRem).mockResolvedValue(2 as never);
      vi.mocked(redis.zRem).mockResolvedValue(2 as never);

      await Dictionary.banWords(['cat', 'dog']);

      expect(redis.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsBanned('testsub'),
        { member: 'Cat', score: 1 },
        { member: 'Dog', score: 1 }
      );
      expect(redis.global.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        ['Cat', 'Dog']
      );
      expect(redis.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsUncertainty('testsub'),
        ['Cat', 'Dog']
      );
    });

    it('unbanWord removes from banned set', async () => {
      vi.mocked(redis.zRem).mockResolvedValue(1 as never);
      await Dictionary.unbanWord('cat');
      expect(redis.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsBanned('testsub'),
        ['Cat']
      );
    });
  });

  describe('getBannedWords', () => {
    it('paginates and maps banned words', async () => {
      vi.mocked(redis.zRange).mockResolvedValue([
        { member: 'Fox', score: 1 } as never,
        { member: 'Bear', score: 1 } as never,
      ]);
      vi.mocked(redis.zCard).mockResolvedValue(4 as never);

      const result = await Dictionary.getBannedWords(0, 2);
      expect(result).toEqual({
        words: ['Fox', 'Bear'],
        total: 4,
        hasMore: true,
      });
    });
  });

  describe('replaceBannedWords', () => {
    it('clears and bans provided words', async () => {
      vi.mocked(redis.del).mockResolvedValue(1 as never);

      await Dictionary.replaceBannedWords([' fox ', 'bear']);

      expect(redis.del).toHaveBeenCalledWith(REDIS_KEYS.wordsBanned('testsub'));
      expect(redis.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsBanned('testsub'),
        { member: 'Fox', score: 1 },
        { member: 'Bear', score: 1 }
      );
    });

    it('clears and does not ban when empty', async () => {
      vi.mocked(redis.del).mockResolvedValue(1 as never);
      const banWordsSpy = vi.spyOn(Dictionary, 'banWords').mockResolvedValue();

      await Dictionary.replaceBannedWords([]);
      expect(redis.del).toHaveBeenCalledWith(REDIS_KEYS.wordsBanned('testsub'));
      expect(banWordsSpy).not.toHaveBeenCalled();
    });
  });

  describe('isWordBanned', () => {
    it('returns true when in banned set', async () => {
      vi.mocked(redis.zScore).mockResolvedValue(1 as never);
      await expect(Dictionary.isWordBanned('cat')).resolves.toBe(true);
    });
    it('returns false when not in banned set', async () => {
      vi.mocked(redis.zScore).mockResolvedValue(undefined as never);
      await expect(Dictionary.isWordBanned('cat')).resolves.toBe(false);
    });
  });

  describe('getRandomWords', () => {
    it('returns first N words from deterministic shuffle', async () => {
      vi.mocked(redis.global.zRange).mockResolvedValue([
        { member: 'A', score: 1 } as never,
        { member: 'B', score: 1 } as never,
        { member: 'C', score: 1 } as never,
        { member: 'D', score: 1 } as never,
      ]);
      vi.mocked(redis.global.zCard).mockResolvedValue(4 as never);
      const result = await Dictionary.getRandomWords(3);
      expect(result).toEqual(['A', 'B', 'C']);
    });
  });

  describe('initDictionary', () => {
    it('adds subreddit to communities and seeds words when none exist', async () => {
      vi.mocked(redis.global.exists).mockResolvedValue(0 as never);
      vi.mocked(redis.global.zAdd).mockResolvedValue(1 as never);

      await Dictionary.initDictionary();

      expect(redis.global.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.communities(),
        expect.objectContaining({ member: 'testsub' })
      );
      // Verify there was a seeding call to wordsAll
      expect(
        vi
          .mocked(redis.global.zAdd)
          .mock.calls.some((args) => args[0] === REDIS_KEYS.wordsAll('testsub'))
      ).toBe(true);
    });

    it('does not reseed when words already exist', async () => {
      vi.mocked(redis.global.exists).mockResolvedValue(1 as never);

      await Dictionary.initDictionary();

      // communities zAdd still called once
      expect(redis.global.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.communities(),
        expect.objectContaining({ member: 'testsub' })
      );
      // but wordsAll seed not called
      expect(
        vi
          .mocked(redis.global.zAdd)
          .mock.calls.some((args) => args[0] === REDIS_KEYS.wordsAll('testsub'))
      ).toBe(false);
    });
  });
});
