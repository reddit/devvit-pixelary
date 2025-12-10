import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { handleUpdateWordScores } from './update-word-scores';
import * as Slate from '../services/words/slate';

const mockContext = {
  subredditName: 'test-subreddit',
};

vi.mock('@devvit/web/server', () => ({
  context: {
    get subredditName() {
      return mockContext.subredditName;
    },
  },
}));

vi.mock('../services/words/slate', () => ({
  updateWordScores: vi.fn(),
}));

describe('handleUpdateWordScores', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonSpy: ReturnType<typeof vi.fn>;
  let statusSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext.subredditName = 'test-subreddit';
    jsonSpy = vi.fn().mockReturnThis();
    statusSpy = vi.fn().mockReturnValue({ json: jsonSpy });
    mockReq = {};
    mockRes = {
      json: jsonSpy,
      status: statusSpy,
    };
  });

  it('successfully updates word scores', async () => {
    vi.mocked(Slate.updateWordScores).mockResolvedValue(undefined);

    await handleUpdateWordScores(mockReq as Request, mockRes as Response);

    expect(Slate.updateWordScores).toHaveBeenCalledWith('test-subreddit');
    expect(jsonSpy).toHaveBeenCalledWith({
      showToast: {
        text: expect.stringContaining('successfully'),
        appearance: 'success',
      },
    });
    expect(statusSpy).not.toHaveBeenCalled();
  });

  it('handles missing subreddit name', async () => {
    mockContext.subredditName = undefined as never;

    await handleUpdateWordScores(mockReq as Request, mockRes as Response);

    expect(Slate.updateWordScores).not.toHaveBeenCalled();
    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      showToast: {
        text: 'Subreddit not found. Please try again.',
        appearance: 'neutral',
      },
    });

    // Restore for other tests
    mockContext.subredditName = 'test-subreddit';
  });

  it('handles lock error', async () => {
    vi.mocked(Slate.updateWordScores).mockRejectedValue(
      new Error('Word scores update already in progress')
    );

    await handleUpdateWordScores(mockReq as Request, mockRes as Response);

    expect(statusSpy).toHaveBeenCalledWith(409);
    expect(jsonSpy).toHaveBeenCalledWith({
      showToast: {
        text: 'Update already in progress. Please wait a few minutes and try again.',
        appearance: 'neutral',
      },
    });
  });

  it('handles data fetch error', async () => {
    vi.mocked(Slate.updateWordScores).mockRejectedValue(
      new Error('Failed to fetch data: Redis connection failed')
    );

    await handleUpdateWordScores(mockReq as Request, mockRes as Response);

    expect(statusSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({
      showToast: {
        text: 'Data error occurred. Please check server logs.',
        appearance: 'neutral',
      },
    });
  });

  it('handles generic errors', async () => {
    vi.mocked(Slate.updateWordScores).mockRejectedValue(
      new Error('Unexpected error')
    );

    await handleUpdateWordScores(mockReq as Request, mockRes as Response);

    expect(statusSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({
      showToast: {
        text: 'Failed to update word scores',
        appearance: 'neutral',
      },
    });
  });

  it('handles non-Error exceptions', async () => {
    vi.mocked(Slate.updateWordScores).mockRejectedValue('String error');

    await handleUpdateWordScores(mockReq as Request, mockRes as Response);

    expect(statusSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({
      showToast: {
        text: 'Failed to update word scores',
        appearance: 'neutral',
      },
    });
  });
});
