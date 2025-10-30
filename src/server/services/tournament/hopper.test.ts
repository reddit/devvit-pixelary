import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@devvit/web/server', () => ({
  context: { subredditName: 'testsub' },
  redis: {
    global: {
      zAdd: vi.fn(),
      zRange: vi.fn(),
      zCard: vi.fn(),
      zRem: vi.fn(),
      del: vi.fn(),
    },
  },
}));

import { redis } from '@devvit/web/server';
import {
  addHopperPrompts,
  getHopperPrompts,
  replaceHopperPrompts,
  peekNextHopperPrompt,
  removeHopperPrompt,
} from './hopper';
import { REDIS_KEYS } from '../redis';

describe('Tournament Hopper Service', () => {
  const nowSpy = vi.spyOn(Date, 'now');

  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    nowSpy.mockReset();
  });

  it('addHopperPrompts adds normalized prompts with incremental scores', async () => {
    nowSpy.mockReturnValue(1000);
    vi.mocked(redis.global.zAdd).mockResolvedValue(2 as unknown as number);

    await addHopperPrompts([' cat ', 'DOG']);

    expect(redis.global.zAdd).toHaveBeenCalledWith(
      REDIS_KEYS.tournamentHopper('testsub'),
      expect.objectContaining({ member: 'Cat', score: expect.any(Number) }),
      expect.objectContaining({ member: 'Dog', score: expect.any(Number) })
    );
  });

  it('getHopperPrompts returns prompts and pagination info', async () => {
    vi.mocked(redis.global.zRange).mockResolvedValue([
      { member: 'Cat', score: 1 },
      { member: 'Dog', score: 2 },
    ]);
    vi.mocked(redis.global.zCard).mockResolvedValue(5);

    const res = await getHopperPrompts(0, 2);
    expect(res.prompts).toEqual(['Cat', 'Dog']);
    expect(res.total).toBe(5);
    expect(res.hasMore).toBe(true);
  });

  it('replaceHopperPrompts clears and adds', async () => {
    nowSpy.mockReturnValue(2000);
    vi.mocked(redis.global.del).mockResolvedValue(1);
    vi.mocked(redis.global.zAdd).mockResolvedValue(1 as unknown as number);

    await replaceHopperPrompts(['One']);

    expect(redis.global.del).toHaveBeenCalledWith(
      REDIS_KEYS.tournamentHopper('testsub')
    );
    expect(redis.global.zAdd).toHaveBeenCalled();
  });

  it('peekNextHopperPrompt returns earliest prompt', async () => {
    vi.mocked(redis.global.zRange).mockResolvedValue([
      { member: 'Cat', score: 1 },
    ]);
    const prompt = await peekNextHopperPrompt();
    expect(prompt).toBe('Cat');
  });

  it('removeHopperPrompt removes normalized prompt', async () => {
    vi.mocked(redis.global.zRem).mockResolvedValue(1);
    const ok = await removeHopperPrompt('  dog  ');
    expect(ok).toBe(true);
    expect(redis.global.zRem).toHaveBeenCalledWith(
      REDIS_KEYS.tournamentHopper('testsub'),
      ['Dog']
    );
  });
});
