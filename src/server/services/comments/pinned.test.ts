import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@devvit/web/server', () => ({
  reddit: {
    submitComment: vi.fn(),
    getCommentById: vi.fn(),
  },
  redis: {
    hSet: vi.fn(),
    hGet: vi.fn(),
  },
}));

import { reddit, redis } from '@devvit/web/server';
import type { T1, T3 } from '@devvit/shared-types/tid.js';
import { REDIS_KEYS } from '@server/core/redis';
import { createPinnedComment, updatePinnedComment } from './pinned';

describe('comments/pinned (base helpers)', () => {
  const postId = 't3_abc' as T3;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates pinned comment and saves id', async () => {
    const text = 'hello world';

    vi.mocked(reddit.submitComment).mockResolvedValue({
      id: 't1_cmt' as T1,
      distinguish: vi.fn().mockResolvedValue(undefined),
    } as unknown as { id: T1; distinguish: (mod: boolean) => Promise<void> });

    const id = await createPinnedComment(postId, text);

    expect(reddit.submitComment).toHaveBeenCalledWith(
      expect.objectContaining({ text, id: postId })
    );
    expect(redis.hSet).toHaveBeenCalledWith(REDIS_KEYS.comment(postId), {
      pinnedCommentId: 't1_cmt',
    });
    expect(id).toBe('t1_cmt');
  });

  it('updates pinned comment using provided text', async () => {
    const newText = 'updated text';

    vi.mocked(redis.hGet).mockResolvedValue('t1_existing' as unknown as T1);
    const edit = vi.fn().mockResolvedValue(undefined);
    vi.mocked(reddit.getCommentById).mockResolvedValue({
      edit,
    } as unknown as { edit: (opts: { text: string }) => Promise<void> });

    await updatePinnedComment(postId, newText);

    expect(redis.hGet).toHaveBeenCalledWith(
      REDIS_KEYS.comment(postId),
      'pinnedCommentId'
    );
    expect(edit).toHaveBeenCalledWith({ text: newText });
  });
});
