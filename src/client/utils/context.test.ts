import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the devvit web client
vi.mock('@devvit/web/client', () => ({
  context: {
    postData: undefined,
  },
}));

import { getPostData } from './context';
import { context } from '@devvit/web/client';

// Mock navigator.userAgent
Object.defineProperty(navigator, 'userAgent', {
  writable: true,
  value: '',
});

describe('getPostData', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    context.postData = undefined;
  });

  it('returns context.postData directly on non-iOS platforms', () => {
    // Mock non-iOS user agent
    navigator.userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    // Mock context.postData
    const mockPostData = { type: 'drawing', word: 'test' };
    context.postData = mockPostData;

    const result = getPostData();
    expect(result).toBe(mockPostData);
  });

  it('returns context.postData.developerData on iOS when available', () => {
    // Mock iOS user agent
    navigator.userAgent =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)';

    // Mock context.postData with developerData
    const mockDeveloperData = { type: 'drawing', word: 'test' };
    const mockPostData = { developerData: mockDeveloperData };
    context.postData = mockPostData;

    const result = getPostData();
    expect(result).toBe(mockDeveloperData);
  });

  it('falls back to context.postData on iOS when developerData is missing', () => {
    // Mock iOS user agent
    navigator.userAgent = 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)';

    // Mock context.postData without developerData
    const mockPostData = { type: 'pinned' };
    context.postData = mockPostData;

    const result = getPostData();
    expect(result).toBe(mockPostData);
  });

  it('returns undefined when context.postData is undefined', () => {
    // Mock non-iOS user agent
    navigator.userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    context.postData = undefined;

    const result = getPostData();
    expect(result).toBeUndefined();
  });

  it('handles iPad detection correctly', () => {
    // Mock iPad user agent
    navigator.userAgent = 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)';

    const mockDeveloperData = { type: 'drawing', word: 'test' };
    const mockPostData = { developerData: mockDeveloperData };
    context.postData = mockPostData;

    const result = getPostData();
    expect(result).toBe(mockDeveloperData);
  });

  it('handles iPod detection correctly', () => {
    // Mock iPod user agent
    navigator.userAgent =
      'Mozilla/5.0 (iPod; CPU iPhone OS 14_0 like Mac OS X)';

    const mockDeveloperData = { type: 'drawing', word: 'test' };
    const mockPostData = { developerData: mockDeveloperData };
    context.postData = mockPostData;

    const result = getPostData();
    expect(result).toBe(mockDeveloperData);
  });
});
