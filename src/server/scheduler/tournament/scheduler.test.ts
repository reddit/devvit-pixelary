import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/posts/tournament/hopper', () => ({
  peekNextHopperPrompt: vi.fn(),
  removeHopperPrompt: vi.fn(),
}));

vi.mock('../../services/posts/tournament/post', () => ({
  createTournament: vi.fn(),
}));

vi.mock('../../core/redis', () => ({
  acquireLock: vi.fn().mockResolvedValue(true),
  REDIS_KEYS: {
    tournamentSchedulerEnabled: (s: string) =>
      `tournament:scheduler:enabled:${s}`,
    tournamentSchedulerLock: (s: string) => `tournament:scheduler:lock:${s}`,
  },
}));

import type { Request, Response } from 'express';
import { redis } from '@devvit/web/server';
import { handleTournamentScheduler } from './scheduler';
import {
  peekNextHopperPrompt,
  removeHopperPrompt,
} from '../../services/posts/tournament/hopper';
import { createTournament } from '../../services/posts/tournament/post';
import { acquireLock } from '../../core/redis';

function mockRes(): Response {
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('tournament scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips when disabled', async () => {
    vi.mocked(redis.get).mockResolvedValue('0');
    const req = {} as Request;
    const res = mockRes();
    await handleTournamentScheduler(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped' })
    );
  });

  it('skips when lock is held', async () => {
    vi.mocked(redis.get).mockResolvedValue('1');
    vi.mocked(acquireLock).mockResolvedValue(false as unknown as boolean);
    const req = {} as Request;
    const res = mockRes();
    await handleTournamentScheduler(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped' })
    );
  });

  it('creates tournament and removes prompt when available', async () => {
    vi.mocked(redis.get).mockResolvedValue('1');
    vi.mocked(acquireLock).mockResolvedValue(true as unknown as boolean);
    vi.mocked(peekNextHopperPrompt).mockResolvedValue('Cat');
    const req = {} as Request;
    const res = mockRes();
    await handleTournamentScheduler(req, res);
    expect(createTournament).toHaveBeenCalledWith('Cat');
    expect(removeHopperPrompt).toHaveBeenCalledWith('Cat');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', prompt: 'Cat' })
    );
  });

  it('skips when no prompt available', async () => {
    vi.mocked(redis.get).mockResolvedValue('1');
    vi.mocked(redis.exists).mockResolvedValue(0);
    vi.mocked(peekNextHopperPrompt).mockResolvedValue(null);
    const req = {} as Request;
    const res = mockRes();
    await handleTournamentScheduler(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped' })
    );
  });
});
