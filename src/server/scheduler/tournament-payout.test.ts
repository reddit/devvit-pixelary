import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@devvit/web/server', () => ({
  redis: {
    hGet: vi.fn(),
    hSet: vi.fn(),
    zCard: vi.fn(),
    zRange: vi.fn(),
  },
}));

vi.mock('../core/redis', () => ({
  acquireLock: vi.fn().mockResolvedValue(true),
  releaseLock: vi.fn().mockResolvedValue(undefined),
  REDIS_KEYS: {
    tournamentEntries: (p: string) => `tournament:entries:${p}`,
    tournamentPayoutLedger: (p: string) => `tournament:payout:ledger:${p}`,
    tournamentPayoutLock: (p: string, d: number) =>
      `tournament:payout:lock:${p}:${d}`,
  },
}));

vi.mock('../services/posts/tournament/award', () => ({
  awardTournamentRewards: vi.fn(),
}));
vi.mock('../services/posts/tournament/post', () => ({
  getTournamentEntry: vi.fn(),
}));

vi.mock('../services/comments/pinned', () => ({
  replyToPinnedComment: vi.fn(),
}));

vi.mock('../core/user', () => ({
  getUsername: vi.fn(),
}));

import type { Request, Response } from 'express';
import type { T1, T2, T3 } from '@devvit/shared-types/tid.js';
import { redis } from '@devvit/web/server';
import { handleTournamentPayoutSnapshot } from './tournament-payout';
import { acquireLock, releaseLock } from '../core/redis';
import { awardTournamentRewards } from '../services/posts/tournament/award';
import { getTournamentEntry } from '../services/posts/tournament/post';
import { replyToPinnedComment } from '../services/comments/pinned';
import { getUsername } from '../core/user';

function mockRes(): Response {
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('tournament payout snapshot', () => {
  const postId = 't3_abc' as T3;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips when lock is held', async () => {
    vi.mocked(acquireLock).mockResolvedValue(false as unknown as boolean);
    const req = {
      body: { data: { postId, dayIndex: 1 } },
    } as unknown as Request;
    const res = mockRes();
    await handleTournamentPayoutSnapshot(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped' })
    );
  });

  it('skips when already ran', async () => {
    vi.mocked(acquireLock).mockResolvedValue(true as unknown as boolean);
    vi.mocked(redis.hGet).mockResolvedValue('1');
    const req = {
      body: { data: { postId, dayIndex: 1 } },
    } as unknown as Request;
    const res = mockRes();
    await handleTournamentPayoutSnapshot(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped' })
    );
    expect(releaseLock).toHaveBeenCalled();
  });

  it('awards payouts, writes ledger, and replies', async () => {
    vi.mocked(acquireLock).mockResolvedValue(true as unknown as boolean);
    vi.mocked(redis.hGet).mockResolvedValue(null as unknown as string);
    vi.mocked(redis.zCard).mockResolvedValue(10);
    vi.mocked(redis.zRange).mockResolvedValue([
      { member: 't1_a', score: 1500 },
      { member: 't1_b', score: 1400 },
      { member: 't1_c', score: 1300 },
      { member: 't1_d', score: 1200 },
    ] as unknown as Array<{ member: string; score: number }>);
    vi.mocked(getTournamentEntry).mockImplementation(async (id: T1) => ({
      commentId: id,
      drawing: {} as unknown as import('@shared/schema').DrawingData,
      userId: ('t2_' + String(id)).slice(0, 6) as unknown as T2,
      postId: postId,
      votes: 0,
      views: 0,
      mediaUrl: '',
      mediaId: '',
    }));
    vi.mocked(getUsername).mockResolvedValueOnce('alpha');
    vi.mocked(getUsername).mockResolvedValueOnce('beta');
    vi.mocked(getUsername).mockResolvedValueOnce('gamma');

    const req = {
      body: { data: { postId, dayIndex: 2 } },
    } as unknown as Request;
    const res = mockRes();
    await handleTournamentPayoutSnapshot(req, res);

    expect(awardTournamentRewards).toHaveBeenCalled();
    expect(redis.hSet).toHaveBeenCalled();
    expect(replyToPinnedComment).toHaveBeenCalledWith(
      postId,
      expect.stringContaining('Day 2/5')
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success' })
    );
  });

  it('handles small tournaments (min 1)', async () => {
    vi.mocked(acquireLock).mockResolvedValue(true as unknown as boolean);
    vi.mocked(redis.hGet).mockResolvedValue(null as unknown as string);
    vi.mocked(redis.zCard).mockResolvedValue(1);
    vi.mocked(redis.zRange).mockResolvedValue([
      { member: 't1_a', score: 1200 },
    ] as unknown as Array<{ member: string; score: number }>);
    vi.mocked(getTournamentEntry).mockResolvedValue({
      commentId: 't1_a' as unknown as T1,
      drawing: {} as unknown as import('@shared/schema').DrawingData,
      userId: 't2_a' as unknown as T2,
      postId: postId,
      votes: 0,
      views: 0,
      mediaUrl: '',
      mediaId: '',
    });
    vi.mocked(getUsername).mockResolvedValueOnce('alpha');

    const req = {
      body: { data: { postId, dayIndex: 1 } },
    } as unknown as Request;
    const res = mockRes();
    await handleTournamentPayoutSnapshot(req, res);
    expect(awardTournamentRewards).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success' })
    );
  });
});
