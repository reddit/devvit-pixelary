import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the context
vi.mock('@devvit/web/server', () => ({
  context: {
    subredditName: 'testsub',
  },
  redis: {
    zAdd: vi.fn(),
    zRem: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    get: vi.fn(),
  },
}));

// Mock the dictionary service
vi.mock('./dictionary', () => ({
  banWord: vi.fn(),
  isWordBanned: vi.fn().mockResolvedValue(false),
}));

import { redis, context } from '@devvit/web/server';
import {
  setChampion,
  getChampion,
  isChampion,
  removeChampion,
  handleChampionDelete,
} from './champion';
import { REDIS_KEYS } from './redis';
import { banWord } from './dictionary';

describe('Champion Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setChampion', () => {
    it('should set a new champion for a word', async () => {
      const word = 'test';
      const commentId = 't1_comment123' as const;

      vi.mocked(redis.zAdd).mockResolvedValue(1);
      vi.mocked(redis.set).mockResolvedValue('OK');
      vi.mocked(redis.del).mockResolvedValue(0);

      await setChampion(word, commentId);

      expect(redis.zAdd).toHaveBeenCalledWith(
        REDIS_KEYS.wordsChampioned('testsub'),
        { member: 'Test', score: 1 }
      );
      expect(redis.set).toHaveBeenCalledWith(
        REDIS_KEYS.wordChampion('Test'),
        commentId
      );
      expect(redis.set).toHaveBeenCalledWith(
        REDIS_KEYS.championWord(commentId),
        'Test'
      );
    });

    it('should replace existing champion and clean up previous champion', async () => {
      const word = 'test';
      const commentId = 't1_comment123' as const;
      const previousCommentId = 't1_previous123' as const;

      // Mock getChampion to return a previous champion
      vi.mocked(redis.get).mockImplementation((key) => {
        if (key === REDIS_KEYS.wordChampion('Test')) {
          return Promise.resolve(previousCommentId);
        }
        return Promise.resolve(null);
      });

      vi.mocked(redis.zAdd).mockResolvedValue(1);
      vi.mocked(redis.set).mockResolvedValue('OK');
      vi.mocked(redis.del).mockResolvedValue(1);

      await setChampion(word, commentId);

      expect(redis.del).toHaveBeenCalledWith(
        REDIS_KEYS.championWord(previousCommentId)
      );
    });

    it('should not set champion if word is banned', async () => {
      const word = 'banned';
      const commentId = 't1_comment123' as const;

      // Mock isWordBanned to return true for the normalized word
      const { isWordBanned } = await import('./dictionary');
      vi.mocked(isWordBanned).mockResolvedValue(true);

      await setChampion(word, commentId);

      expect(redis.zAdd).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('should handle Redis errors', async () => {
      const word = 'test';
      const commentId = 't1_comment123' as const;

      vi.mocked(redis.zAdd).mockRejectedValue(new Error('Redis error'));

      await expect(setChampion(word, commentId)).rejects.toThrow('Redis error');
    });
  });

  describe('getChampion', () => {
    it('should return champion comment ID for a word', async () => {
      const word = 'test';
      const commentId = 't1_comment123' as const;

      vi.mocked(redis.get).mockResolvedValue(commentId);

      const result = await getChampion(word);

      expect(redis.get).toHaveBeenCalledWith(REDIS_KEYS.wordChampion('Test'));
      expect(result).toBe(commentId);
    });

    it('should return null if no champion exists', async () => {
      const word = 'test';

      vi.mocked(redis.get).mockResolvedValue(null);

      const result = await getChampion(word);

      expect(result).toBeNull();
    });

    it('should return null if champion ID is invalid', async () => {
      const word = 'test';

      vi.mocked(redis.get).mockResolvedValue('invalid_id');

      const result = await getChampion(word);

      expect(result).toBeNull();
    });

    it('should normalize word before lookup', async () => {
      const word = 'TEST';
      const commentId = 't1_comment123' as const;

      vi.mocked(redis.get).mockResolvedValue(commentId);

      await getChampion(word);

      expect(redis.get).toHaveBeenCalledWith(REDIS_KEYS.wordChampion('Test'));
    });
  });

  describe('isChampion', () => {
    it('should return true if comment is a champion', async () => {
      const commentId = 't1_comment123' as const;

      vi.mocked(redis.get).mockResolvedValue('test');

      const result = await isChampion(commentId);

      expect(redis.get).toHaveBeenCalledWith(
        REDIS_KEYS.championWord(commentId)
      );
      expect(result).toBe(true);
    });

    it('should return false if comment is not a champion', async () => {
      const commentId = 't1_comment123' as const;

      vi.mocked(redis.get).mockResolvedValue(undefined);

      const result = await isChampion(commentId);

      expect(result).toBe(false);
    });

    it('should return true if word is empty string', async () => {
      const commentId = 't1_comment123' as const;

      vi.mocked(redis.get).mockResolvedValue('');

      const result = await isChampion(commentId);

      expect(result).toBe(true);
    });
  });

  describe('removeChampion', () => {
    it('should remove champion and clean up all related keys', async () => {
      const word = 'test';
      const commentId = 't1_comment123' as const;

      vi.mocked(redis.get).mockResolvedValue(commentId);
      vi.mocked(redis.zRem).mockResolvedValue(1);
      vi.mocked(redis.del).mockResolvedValue(1);

      await removeChampion(word);

      expect(redis.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsChampioned('testsub'),
        ['Test']
      );
      expect(redis.del).toHaveBeenCalledWith(REDIS_KEYS.wordChampion('Test'));
      expect(redis.del).toHaveBeenCalledWith(
        REDIS_KEYS.championWord(commentId)
      );
    });

    it('should handle case when no champion exists', async () => {
      const word = 'test';

      vi.mocked(redis.get).mockResolvedValue(null);

      await removeChampion(word);

      expect(redis.zRem).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('should normalize word before removal', async () => {
      const word = 'TEST';
      const commentId = 't1_comment123' as const;

      vi.mocked(redis.get).mockResolvedValue(commentId);
      vi.mocked(redis.zRem).mockResolvedValue(1);
      vi.mocked(redis.del).mockResolvedValue(1);

      await removeChampion(word);

      expect(redis.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsChampioned('testsub'),
        ['Test']
      );
    });
  });

  describe('handleChampionDelete', () => {
    it('should ban word and remove champion when comment is deleted', async () => {
      const commentId = 't1_comment123' as const;
      const word = 'test';

      // Mock the champion word lookup
      vi.mocked(redis.get).mockImplementation((key) => {
        if (key === REDIS_KEYS.championWord(commentId)) {
          return Promise.resolve(word);
        }
        if (key === REDIS_KEYS.wordChampion('Test')) {
          return Promise.resolve(commentId);
        }
        return Promise.resolve(null);
      });

      vi.mocked(banWord).mockResolvedValue();
      vi.mocked(redis.zRem).mockResolvedValue(1);
      vi.mocked(redis.del).mockResolvedValue(1);

      await handleChampionDelete(commentId);

      expect(redis.get).toHaveBeenCalledWith(
        REDIS_KEYS.championWord(commentId)
      );
      expect(banWord).toHaveBeenCalledWith(word);
      expect(redis.zRem).toHaveBeenCalledWith(
        REDIS_KEYS.wordsChampioned('testsub'),
        ['Test']
      );
      expect(redis.del).toHaveBeenCalledWith(REDIS_KEYS.wordChampion('Test'));
      expect(redis.del).toHaveBeenCalledWith(
        REDIS_KEYS.championWord(commentId)
      );
    });

    it('should do nothing if comment is not a champion', async () => {
      const commentId = 't1_comment123' as const;

      vi.mocked(redis.get).mockResolvedValue(null);

      await handleChampionDelete(commentId);

      expect(banWord).not.toHaveBeenCalled();
      expect(redis.zRem).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      const commentId = 't1_comment123' as const;

      vi.mocked(redis.get).mockRejectedValue(new Error('Redis error'));

      await expect(handleChampionDelete(commentId)).rejects.toThrow(
        'Redis error'
      );
    });

    it('should handle banWord errors', async () => {
      const commentId = 't1_comment123' as const;
      const word = 'test';

      vi.mocked(redis.get).mockResolvedValue(word);
      vi.mocked(banWord).mockRejectedValue(new Error('Ban error'));

      await expect(handleChampionDelete(commentId)).rejects.toThrow(
        'Ban error'
      );
    });
  });
});
