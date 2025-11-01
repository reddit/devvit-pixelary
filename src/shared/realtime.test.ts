import { describe, it, expect } from 'vitest';
import { REALTIME_CHANNELS } from './realtime';

describe('REALTIME_CHANNELS', () => {
  it('builds user rewards channel', () => {
    expect(REALTIME_CHANNELS.userRewards('u_123')).toBe('user-u_123-rewards');
  });

  it('builds user level-up channel', () => {
    expect(REALTIME_CHANNELS.userLevelUp('u_123')).toBe('user-u_123-levelup');
  });

  it('builds post channel', () => {
    expect(REALTIME_CHANNELS.post('t3_abc')).toBe('post-t3_abc');
  });
});
