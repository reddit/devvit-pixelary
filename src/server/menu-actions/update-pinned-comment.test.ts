import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@devvit/web/server', () => ({
  context: { postId: 't3_post' },
  redis: {},
}));

vi.mock('../services/comments/pinned', () => ({
  getPinnedCommentId: vi.fn(),
  updatePinnedComment: vi.fn(),
}));

// No factory module anymore

vi.mock('../services/posts/pinned', () => ({
  updatePinnedPostComment: vi.fn(),
}));

vi.mock('../services/posts/drawing', () => ({
  generateDrawingCommentText: vi.fn(),
  getDrawingCommentData: vi.fn(),
}));

vi.mock('../services/posts/tournament/comments', () => ({
  generateTournamentCommentText: vi.fn(),
}));

vi.mock('../services/posts/tournament/post', () => ({
  getTournament: vi.fn(),
}));

import { getPinnedCommentId, updatePinnedComment } from '../services/comments/pinned';
import { updatePinnedPostComment } from '../services/posts/pinned';
import { handleUpdatePinnedComment } from './update-pinned-comment';
import { getTournament } from '../services/posts/tournament/post';
import { generateTournamentCommentText } from '../services/posts/tournament/comments';
import { generateDrawingCommentText, getDrawingCommentData } from '../services/posts/drawing';

function createRes() {
  const res: any = {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as import('express').Response;
}

describe('menu-actions/update-pinned-comment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns toast when no pinned comment exists', async () => {
    vi.mocked(getPinnedCommentId).mockResolvedValue(null);
    const res = createRes();
    await handleUpdatePinnedComment({ body: { postType: 'pinned' } } as any, res);
    // @ts-expect-error test helper field
    expect((res as any).body?.showToast).toBe('No comment found');
  });

  it('updates pinned post comments via dedicated method', async () => {
    vi.mocked(getPinnedCommentId).mockResolvedValue('t1_x' as any);
    const res = createRes();
    await handleUpdatePinnedComment({ body: { postType: 'pinned' } } as any, res);
    expect(updatePinnedPostComment).toHaveBeenCalled();
  });

  it('updates drawing/tournament via direct text generation', async () => {
    vi.mocked(getPinnedCommentId).mockResolvedValue('t1_x' as any);
    vi.spyOn(global, 'Date');
    vi.mocked(getDrawingCommentData).mockResolvedValue({
      guessCount: 1,
      playerCount: 1,
      wordCount: 1,
      skips: 0,
      skipPercentage: 0,
      solves: 0,
      solvedPercentage: 0,
    } as any);
    vi.mocked(generateDrawingCommentText).mockReturnValue('text');
    const res = createRes();
    await handleUpdatePinnedComment({ body: { postType: 'drawing' } } as any, res);
    expect(updatePinnedComment).toHaveBeenCalled();
  });
});


