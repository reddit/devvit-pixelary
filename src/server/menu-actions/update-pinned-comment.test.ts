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
  saveLastCommentUpdate: vi.fn(),
  clearNextScheduledJobId: vi.fn(),
}));

vi.mock('../services/posts/tournament/comments', () => ({
  generateTournamentCommentText: vi.fn(),
}));

vi.mock('../services/posts/tournament/post', () => ({
  getTournament: vi.fn(),
}));

import {
  getPinnedCommentId,
  updatePinnedComment,
} from '../services/comments/pinned';
import { updatePinnedPostComment } from '../services/posts/pinned';
import { handleUpdatePinnedComment } from './update-pinned-comment';
import { getTournament } from '../services/posts/tournament/post';
import { generateTournamentCommentText } from '../services/posts/tournament/comments';
import {
  generateDrawingCommentText,
  getDrawingCommentData,
} from '../services/posts/drawing';
import type { Request, Response } from 'express';
import type { T1 } from '@devvit/shared-types/tid.js';

function createRes(): Response {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      (this as { statusCode: number }).statusCode = code;
      return this as unknown as Response;
    },
    json(payload: unknown) {
      (this as { body: unknown }).body = payload;
      return this as unknown as Response;
    },
  };
  return res as unknown as Response;
}

function createReq(postType: 'drawing' | 'tournament' | 'pinned'): Request {
  const req = { body: { postType } };
  return req as unknown as Request;
}

describe('menu-actions/update-pinned-comment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns toast when no pinned comment exists', async () => {
    vi.mocked(getPinnedCommentId).mockResolvedValue(null);
    const res = createRes();
    await handleUpdatePinnedComment(createReq('pinned'), res);
    expect(
      (res as unknown as { body?: { showToast?: string } }).body?.showToast
    ).toBe('No comment found');
  });

  it('updates pinned post comments via dedicated method', async () => {
    vi.mocked(getPinnedCommentId).mockResolvedValue('t1_x' as T1);
    const res = createRes();
    await handleUpdatePinnedComment(createReq('pinned'), res);
    expect(updatePinnedPostComment).toHaveBeenCalled();
  });

  it('updates drawing/tournament via direct text generation', async () => {
    vi.mocked(getPinnedCommentId).mockResolvedValue('t1_x' as T1);
    vi.spyOn(global, 'Date');
    vi.mocked(getDrawingCommentData).mockResolvedValue({
      solves: 0,
      solvedPercentage: 0,
      skips: 0,
      skipPercentage: 0,
      wordCount: 1,
      guessCount: 1,
      playerCount: 1,
      guesses: [],
    });
    vi.mocked(generateDrawingCommentText).mockReturnValue('text');
    const res = createRes();
    await handleUpdatePinnedComment(createReq('drawing'), res);
    expect(updatePinnedComment).toHaveBeenCalled();
  });
});
