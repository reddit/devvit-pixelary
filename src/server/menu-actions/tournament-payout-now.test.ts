import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@devvit/web/server', () => ({
  context: { postId: 't3_abc' },
}));

vi.mock('../services/posts/tournament/post', () => ({
  getTournament: vi.fn(),
}));

vi.mock('../services/posts/tournament/award', () => ({
  awardTournamentRewards: vi.fn(),
}));

vi.mock('../services/comments/pinned', () => ({
  replyToPinnedComment: vi.fn(),
}));

import type { Request, Response } from 'express';
import { handleRunTournamentPayout } from './tournament-payout-now';
import { getTournament } from '../services/posts/tournament/post';
import { awardTournamentRewards } from '../services/posts/tournament/award';
// reply is handled inside award service

function mockRes(): Response {
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('menu-actions: tournament payout now', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no-ops on non-tournament posts', async () => {
    vi.mocked(getTournament).mockResolvedValue({
      type: '',
      word: '',
      submissionCount: 0,
      voteCount: 0,
      playerCount: 0,
    });

    const req = {} as Request;
    const res = mockRes();
    await handleRunTournamentPayout(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ showToast: 'Not a tournament post' })
    );
    expect(awardTournamentRewards).not.toHaveBeenCalled();
  });

  it('runs payout on tournament posts and replies', async () => {
    vi.mocked(getTournament).mockResolvedValue({
      type: 'tournament',
      word: 'cat',
      submissionCount: 0,
      voteCount: 0,
      playerCount: 0,
    });

    const req = {} as Request;
    const res = mockRes();
    await handleRunTournamentPayout(req, res);
    expect(awardTournamentRewards).toHaveBeenCalledWith(
      't3_abc',
      expect.objectContaining({ manual: true })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ showToast: 'Payout complete' })
    );
  });
});
