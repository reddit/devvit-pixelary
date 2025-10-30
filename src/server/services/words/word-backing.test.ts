import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@devvit/web/server', () => ({
  context: { subredditName: 'testsub' },
  redis: {
    zAdd: vi.fn(),
    zRem: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('./dictionary', () => ({
  isWordBanned: vi.fn().mockResolvedValue(false),
}));

import { redis } from '@devvit/web/server';
import { addBacker, getBacker, removeBacker } from './word-backing';
import { REDIS_KEYS } from '../redis';

describe('Word Backing Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets a new backing and cleans up previous', async () => {
    const word = 'test';
    const commentId = 't1_comment123' as const;
    const previousCommentId = 't1_previous123' as const;
    vi.mocked(redis.get)
      .mockResolvedValueOnce(previousCommentId)
      .mockResolvedValueOnce(null);
    vi.mocked(redis.set).mockResolvedValue('OK');
    vi.mocked(redis.del).mockResolvedValue(1);
    await addBacker(word, commentId);
    expect(redis.set).toHaveBeenCalledWith(
      REDIS_KEYS.wordBacking('Test'),
      commentId
    );
    expect(redis.set).toHaveBeenCalledWith(
      REDIS_KEYS.wordBackingComment(commentId),
      'Test'
    );
    expect(redis.del).toHaveBeenCalledWith(
      REDIS_KEYS.wordBackingComment(previousCommentId)
    );
  });

  it('gets and removes backing', async () => {
    const word = 'test';
    const commentId = 't1_c' as const;
    vi.mocked(redis.get).mockResolvedValue(commentId);
    await removeBacker(word);
    expect(redis.del).toHaveBeenCalledWith(REDIS_KEYS.wordBacking('Test'));
    expect(redis.del).toHaveBeenCalledWith(
      REDIS_KEYS.wordBackingComment(commentId)
    );
  });
});
