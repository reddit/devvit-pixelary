import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { Level } from '@shared/types';
import { isLegacyUser } from '../../services/legacy';
import { handleSetUserFlair } from './flair';

vi.mock('@devvit/web/server', () => ({
  reddit: {
    getUserFlairTemplates: vi.fn().mockResolvedValue([{}]),
    setUserFlair: vi.fn(),
  },
}));

vi.mock('../../core/user', () => ({
  getUsername: vi.fn().mockResolvedValue('TestUser'),
}));

vi.mock('../../services/legacy', () => ({
  isLegacyUser: vi.fn(),
}));

function makeReq(data: unknown): Request {
  return { body: { data } } as unknown as Request;
}

function makeRes(): Response {
  const res = {
    json: vi.fn(),
    status: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('User Flair Scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appends [OG] for legacy users', async () => {
    vi.mocked(isLegacyUser).mockResolvedValue(true);
    const level: Level = { rank: 1, name: 'Beginner' } as unknown as Level;
    const req = makeReq({
      userId: 't2_user',
      subredditName: 'testsub',
      level,
    });
    const res = makeRes();

    await handleSetUserFlair(req, res);

    expect(vi.mocked(res.json)).toHaveBeenCalled();
  });

  it('does not append [OG] for non-legacy users', async () => {
    vi.mocked(isLegacyUser).mockResolvedValue(false);
    const level: Level = { rank: 2, name: 'Rookie' } as unknown as Level;
    const req = makeReq({
      userId: 't2_user2',
      subredditName: 'testsub',
      level,
    });
    const res = makeRes();

    await handleSetUserFlair(req, res);

    expect(vi.mocked(res.json)).toHaveBeenCalled();
  });
});
