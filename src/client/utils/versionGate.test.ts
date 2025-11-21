import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the devvit web client
vi.mock('@devvit/web/client', () => ({
  context: {
    client: undefined,
  },
}));

import { isClientVersionSufficient } from './versionGate';
import { context } from '@devvit/web/client';

describe('isClientVersionSufficient', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    context.client = undefined;
  });

  it('returns true when client is undefined (web/Shreddit)', () => {
    context.client = undefined;
    expect(isClientVersionSufficient()).toBe(true);
  });

  describe('iOS client', () => {
    it('returns true when version meets minimum requirements (same year, same release)', () => {
      context.client = {
        name: 'IOS',
        version: {
          yyyy: 2025,
          release: 46,
          attempt: 0,
          number: 1000,
        },
      };
      expect(isClientVersionSufficient()).toBe(true);
    });

    it('returns true when version exceeds minimum requirements (same year, newer release)', () => {
      context.client = {
        name: 'IOS',
        version: {
          yyyy: 2025,
          release: 47,
          attempt: 0,
          number: 1000,
        },
      };
      expect(isClientVersionSufficient()).toBe(true);
    });

    it('returns true when version exceeds minimum requirements (newer year)', () => {
      context.client = {
        name: 'IOS',
        version: {
          yyyy: 2026,
          release: 1,
          attempt: 0,
          number: 1000,
        },
      };
      expect(isClientVersionSufficient()).toBe(true);
    });

    it('returns false when version is below minimum requirements (older year)', () => {
      context.client = {
        name: 'IOS',
        version: {
          yyyy: 2024,
          release: 50,
          attempt: 0,
          number: 1000,
        },
      };
      expect(isClientVersionSufficient()).toBe(false);
    });

    it('returns false when version is below minimum requirements (same year, older release)', () => {
      context.client = {
        name: 'IOS',
        version: {
          yyyy: 2025,
          release: 45,
          attempt: 0,
          number: 1000,
        },
      };
      expect(isClientVersionSufficient()).toBe(false);
    });
  });

  describe('Android client', () => {
    it('returns true when version meets minimum requirements (same year, same release)', () => {
      context.client = {
        name: 'ANDROID',
        version: {
          yyyy: 2025,
          release: 46,
          attempt: 0,
          number: 1000,
        },
      };
      expect(isClientVersionSufficient()).toBe(true);
    });

    it('returns true when version exceeds minimum requirements (same year, newer release)', () => {
      context.client = {
        name: 'ANDROID',
        version: {
          yyyy: 2025,
          release: 47,
          attempt: 0,
          number: 1000,
        },
      };
      expect(isClientVersionSufficient()).toBe(true);
    });

    it('returns true when version exceeds minimum requirements (newer year)', () => {
      context.client = {
        name: 'ANDROID',
        version: {
          yyyy: 2026,
          release: 1,
          attempt: 0,
          number: 1000,
        },
      };
      expect(isClientVersionSufficient()).toBe(true);
    });

    it('returns false when version is below minimum requirements (older year)', () => {
      context.client = {
        name: 'ANDROID',
        version: {
          yyyy: 2024,
          release: 50,
          attempt: 0,
          number: 1000,
        },
      };
      expect(isClientVersionSufficient()).toBe(false);
    });

    it('returns false when version is below minimum requirements (same year, older release)', () => {
      context.client = {
        name: 'ANDROID',
        version: {
          yyyy: 2025,
          release: 45,
          attempt: 0,
          number: 1000,
        },
      };
      expect(isClientVersionSufficient()).toBe(false);
    });
  });
});

