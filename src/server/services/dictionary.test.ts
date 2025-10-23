import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the context
vi.mock('@devvit/web/server', () => ({
  context: {
    subredditName: 'testsub',
  },
  redis: {
    sAdd: vi.fn(),
    sRem: vi.fn(),
    sMembers: vi.fn(),
    sIsMember: vi.fn(),
    del: vi.fn(),
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
  getAllWords,
  getAllWordsPaginated,
  replaceAllWords,
  updateWordsPreservingScores,
  isWordInList,
  banWord,
  banWords,
  unbanWord,
  getAllBannedWords,
  getAllBannedWordsPaginated,
  replaceBannedWords,
  isWordBanned,
  getRandomWords,
  initDictionary,
} from './dictionary';
import { REDIS_KEYS } from './redis';

describe('Dictionary Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

    it('should return false if word already exists', async () => {
      vi.mocked(redis.global.zAdd).mockResolvedValue(0);

      const result = await addWord('test');

      expect(result).toBe(false);
    });

    it('should handle Redis errors gracefully', async () => {
      vi.mocked(redis.global.zAdd).mockRejectedValue(new Error('Redis error'));

      await expect(addWord('test')).rejects.toThrow('Redis error');
    });
  });

  describe('addWords', () => {
    it('should add multiple words to the dictionary', async () => {
      vi.mocked(redis.zRange).mockResolvedValue([]); // No banned words
      vi.mocked(redis.global.zAdd).mockResolvedValue(2);

      await addWords(['word1', 'word2']);

      expect(redis.global.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        { member: 'Word1', score: 1 },
        { member: 'Word2', score: 1 }
      );
    });

    it('should handle empty array', async () => {
      vi.mocked(redis.zRange).mockResolvedValue([]); // No banned words
      vi.mocked(redis.global.zAdd).mockResolvedValue(0);

      await addWords([]);

      expect(redis.global.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub')
      );
    });

    it('should handle Redis errors', async () => {
      vi.mocked(redis.zRange).mockResolvedValue([]); // No banned words
      vi.mocked(redis.global.zAdd).mockRejectedValue(new Error('Redis error'));

      await expect(addWords(['word1'])).rejects.toThrow('Redis error');
    });
  });

  describe('removeWord', () => {
    it('should remove a word from the dictionary', async () => {
      vi.mocked(redis.global.zRem).mockResolvedValue(1);

      const result = await removeWord('test');

      expect(redis.global.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        ['Test']
      );
      expect(result).toBe(true);
    });

    it('should return false if word does not exist', async () => {
      vi.mocked(redis.global.zRem).mockResolvedValue(0);

      const result = await removeWord('test');

      expect(result).toBe(false);
    });
  });

  describe('getAllWords', () => {
    it('should return all words from the dictionary', async () => {
      const mockWords = [
        { member: 'Word1', score: 1 },
        { member: 'Word2', score: 1 },
        { member: 'Word3', score: 1 },
      ];
      vi.mocked(redis.global.zRange).mockResolvedValue(mockWords);

      const result = await getAllWords();

      expect(redis.global.zRange).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        0,
        -1
      );
      expect(result).toEqual(['Word1', 'Word2', 'Word3']);
    });

    it('should return empty array when no words exist', async () => {
      vi.mocked(redis.global.zRange).mockResolvedValue([]);

      const result = await getAllWords();

      expect(result).toEqual([]);
    });

    it('should handle custom subreddit name', async () => {
      const mockWords = [{ member: 'Word1', score: 1 }];
      vi.mocked(redis.global.zRange).mockResolvedValue(mockWords);

      const result = await getAllWords('custom-sub');

      expect(redis.global.zRange).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('custom-sub'),
        0,
        -1
      );
      expect(result).toEqual(['Word1']);
    });
  });

  describe('getAllWordsPaginated', () => {
    it('should return paginated words with correct metadata', async () => {
      const mockWords = [
        { member: 'Word1', score: 1 },
        { member: 'Word2', score: 1 },
      ];
      vi.mocked(redis.global.zRange).mockResolvedValue(mockWords);
      vi.mocked(redis.global.zCard).mockResolvedValue(3);

      const result = await getAllWordsPaginated('testsub', 0, 2);

      expect(result.words).toEqual(['Word1', 'Word2']);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it('should handle last page correctly', async () => {
      const mockWords = [
        { member: 'Word1', score: 1 },
        { member: 'Word2', score: 1 },
      ];
      vi.mocked(redis.global.zRange).mockResolvedValue(mockWords);
      vi.mocked(redis.global.zCard).mockResolvedValue(2);

      const result = await getAllWordsPaginated('testsub', 0, 10);

      expect(result.words).toEqual(['Word1', 'Word2']);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should handle empty results', async () => {
      vi.mocked(redis.global.zRange).mockResolvedValue([]);
      vi.mocked(redis.global.zCard).mockResolvedValue(0);

      const result = await getAllWordsPaginated('testsub', 0, 10);

      expect(result.words).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('replaceAllWords', () => {
    it('should replace all words in the dictionary', async () => {
      vi.mocked(redis.zRange).mockResolvedValue([]); // No banned words
      vi.mocked(redis.global.del).mockResolvedValue(1);
      vi.mocked(redis.global.zAdd).mockResolvedValue(2);

      await replaceAllWords(['new1', 'new2']);

      expect(redis.global.del).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub')
      );
      expect(redis.global.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        { member: 'New1', score: 1 },
        { member: 'New2', score: 1 }
      );
    });

    it('should handle empty word list', async () => {
      vi.mocked(redis.global.del).mockResolvedValue(1);

      await replaceAllWords([]);

      expect(redis.global.del).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub')
      );
      expect(redis.global.zAdd).not.toHaveBeenCalled();
    });
  });

  describe('updateWordsPreservingScores', () => {
    it('should preserve existing scores when updating words', async () => {
      const newWords = ['word2', 'word3'];

      vi.mocked(redis.zRange).mockResolvedValue([]); // No banned words
      vi.mocked(redis.global.zRange).mockResolvedValue([
        { member: 'Word1', score: 10 },
        { member: 'Word2', score: 20 },
      ]);
      vi.mocked(redis.global.zAdd).mockResolvedValue(1);
      vi.mocked(redis.global.zRem).mockResolvedValue(1);

      await updateWordsPreservingScores(newWords);

      // Should preserve score for word2, add word3 with default score
      expect(redis.global.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        { member: 'Word3', score: 1 }
      );
      expect(redis.global.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        ['Word1']
      );
    });

    it('should handle missing scores gracefully', async () => {
      const newWords = ['word2'];

      vi.mocked(redis.zRange).mockResolvedValue([]); // No banned words
      vi.mocked(redis.global.zRange).mockResolvedValue([
        { member: 'Word1', score: 10 },
      ]);
      vi.mocked(redis.global.zAdd).mockResolvedValue(1);
      vi.mocked(redis.global.zRem).mockResolvedValue(1);

      await updateWordsPreservingScores(newWords);

      expect(redis.global.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        { member: 'Word2', score: 1 }
      );
      expect(redis.global.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        ['Word1']
      );
    });
  });

  describe('isWordInList', () => {
    it('should return true if word exists in dictionary', async () => {
      vi.mocked(redis.global.zScore).mockResolvedValue(1);

      const result = await isWordInList('test');

      expect(redis.global.zScore).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        'Test'
      );
      expect(result).toBe(true);
    });

    it('should return false if word does not exist', async () => {
      vi.mocked(redis.global.zScore).mockResolvedValue(undefined);

      const result = await isWordInList('test');

      expect(result).toBe(false);
    });
  });

  describe('banWord', () => {
    it('should ban a word and remove it from active dictionary', async () => {
      vi.mocked(redis.zAdd).mockResolvedValue(1);
      vi.mocked(redis.global.zRem).mockResolvedValue(1);

      await banWord('test');

      expect(redis.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsBanned('testsub'),
        { member: 'Test', score: 1 }
      );
      expect(redis.global.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        ['Test']
      );
    });

    it('should handle Redis errors', async () => {
      vi.mocked(redis.zAdd).mockRejectedValue(new Error('Redis error'));

      await expect(banWord('test')).rejects.toThrow('Redis error');
    });
  });

  describe('banWords', () => {
    it('should ban multiple words', async () => {
      vi.mocked(redis.zAdd).mockResolvedValue(2);
      vi.mocked(redis.global.zRem).mockResolvedValue(2);

      await banWords(['word1', 'word2']);

      expect(redis.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsBanned('testsub'),
        { member: 'Word1', score: 1 },
        { member: 'Word2', score: 1 }
      );
      expect(redis.global.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        ['Word1', 'Word2']
      );
    });

    it('should handle empty array', async () => {
      vi.mocked(redis.zAdd).mockResolvedValue(0);
      vi.mocked(redis.global.zRem).mockResolvedValue(0);

      await banWords([]);

      expect(redis.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsBanned('testsub')
      );
      expect(redis.global.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub'),
        []
      );
    });
  });

  describe('unbanWord', () => {
    it('should unban a word', async () => {
      vi.mocked(redis.zRem).mockResolvedValue(1);

      await unbanWord('test');

      expect(redis.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsBanned('testsub'),
        ['Test']
      );
    });

    it('should handle word not in banned list', async () => {
      vi.mocked(redis.zRem).mockResolvedValue(0);

      await unbanWord('test');

      expect(redis.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsBanned('testsub'),
        ['Test']
      );
    });
  });

  describe('getAllBannedWords', () => {
    it('should return all banned words', async () => {
      const mockBannedWords = [
        { member: 'banned1', score: 1 },
        { member: 'banned2', score: 1 },
      ];
      vi.mocked(redis.zRange).mockResolvedValue(mockBannedWords);

      const result = await getAllBannedWords();

      expect(redis.zRange).toHaveBeenCalledWith(
        REDIS_KEYS.wordsBanned('testsub'),
        0,
        -1
      );
      expect(result).toEqual(['banned1', 'banned2']);
    });

    it('should return empty array when no banned words', async () => {
      vi.mocked(redis.zRange).mockResolvedValue([]);

      const result = await getAllBannedWords();

      expect(result).toEqual([]);
    });
  });

  describe('getAllBannedWordsPaginated', () => {
    it('should return paginated banned words', async () => {
      const mockBannedWords = [
        { member: 'banned1', score: 1 },
        { member: 'banned2', score: 1 },
        { member: 'banned3', score: 1 },
      ];
      vi.mocked(redis.zRange).mockResolvedValue(mockBannedWords);
      vi.mocked(redis.zCard).mockResolvedValue(3);

      const result = await getAllBannedWordsPaginated(0, 2);

      expect(redis.zRange).toHaveBeenCalledWith(
        REDIS_KEYS.wordsBanned('testsub'),
        0,
        1
      );
      expect(redis.zCard).toHaveBeenCalledWith(
        REDIS_KEYS.wordsBanned('testsub')
      );
      expect(result.words).toEqual(['banned1', 'banned2', 'banned3']);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('replaceBannedWords', () => {
    it('should replace all banned words', async () => {
      vi.mocked(redis.del).mockResolvedValue(1);
      vi.mocked(redis.zAdd).mockResolvedValue(2);

      await replaceBannedWords(['new1', 'new2']);

      expect(redis.del).toHaveBeenCalledWith(REDIS_KEYS.wordsBanned('testsub'));
      expect(redis.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsBanned('testsub'),
        { member: 'New1', score: 1 },
        { member: 'New2', score: 1 }
      );
    });
  });

  describe('isWordBanned', () => {
    it('should return true if word is banned', async () => {
      vi.mocked(redis.zScore).mockResolvedValue(1);

      const result = await isWordBanned('test');

      expect(redis.zScore).toHaveBeenCalledWith(
        REDIS_KEYS.wordsBanned('testsub'),
        'Test'
      );
      expect(result).toBe(true);
    });

    it('should return false if word is not banned', async () => {
      vi.mocked(redis.zScore).mockResolvedValue(undefined);

      const result = await isWordBanned('test');

      expect(result).toBe(false);
    });
  });

  describe('getRandomWords', () => {
    it('should return random words from dictionary', async () => {
      const mockWords = [
        { member: 'Word1', score: 1 },
        { member: 'Word2', score: 1 },
        { member: 'Word3', score: 1 },
        { member: 'Word4', score: 1 },
        { member: 'Word5', score: 1 },
      ];
      vi.mocked(redis.global.zRange).mockResolvedValue(mockWords);

      const result = await getRandomWords(3);

      expect(result).toHaveLength(3);
      expect(
        result.every((word) =>
          ['Word1', 'Word2', 'Word3', 'Word4', 'Word5'].includes(word)
        )
      ).toBe(true);
    });

    it('should return all words if count exceeds available words', async () => {
      const mockWords = [
        { member: 'Word1', score: 1 },
        { member: 'Word2', score: 1 },
      ];
      vi.mocked(redis.global.zRange).mockResolvedValue(mockWords);

      const result = await getRandomWords(5);

      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining(['Word1', 'Word2']));
    });

    it('should return empty array when no words available', async () => {
      vi.mocked(redis.global.zRange).mockResolvedValue([]);

      const result = await getRandomWords(3);

      expect(result).toEqual([]);
    });

    it('should handle count of 0', async () => {
      vi.mocked(redis.global.zRange).mockResolvedValue([]);
      const result = await getRandomWords(0);
      expect(result).toEqual([]);
    });
  });

  describe('initDictionary', () => {
    it('should initialize dictionary with default words', async () => {
      vi.mocked(redis.global.exists).mockResolvedValue(0);
      vi.mocked(redis.global.zAdd).mockResolvedValue(10);

      await initDictionary();

      expect(redis.global.exists).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub')
      );
      expect(redis.global.zAdd).toHaveBeenCalled();
    });

    it('should not initialize if dictionary already exists', async () => {
      vi.mocked(redis.global.exists).mockResolvedValue(1);
      vi.mocked(redis.global.zAdd).mockResolvedValue(1); // For communities

      await initDictionary();

      expect(redis.global.exists).toHaveBeenCalledWith(
        REDIS_KEYS.wordsAll('testsub')
      );
      expect(redis.global.zAdd).toHaveBeenCalledTimes(1); // Only communities, not words
    });
  });
});
