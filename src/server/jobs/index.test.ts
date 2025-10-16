import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateDrawingPinnedComment } from './index';
import {
  getDrawingPost,
  savePinnedCommentId,
  saveLastCommentUpdate,
} from '../services/drawing';
import { getGuessStats } from '../services/guess';
import { reddit } from '@devvit/web/server';
import type { DrawingPostDataExtended } from '../../shared/schema/pixelary';

// Mock the dependencies
vi.mock('../services/drawing-post');
vi.mock('../services/guess');
vi.mock('@devvit/web/server', () => ({
  reddit: {
    submitComment: vi.fn(),
    getCommentById: vi.fn(),
  },
}));

const mockReddit = vi.mocked(reddit);
const mockGetDrawingPost = vi.mocked(getDrawingPost);
const mockGetGuessStats = vi.mocked(getGuessStats);
const mockSavePinnedCommentId = vi.mocked(savePinnedCommentId);
const mockSaveLastCommentUpdate = vi.mocked(saveLastCommentUpdate);

describe('updateDrawingPinnedComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create new comment when no pinned comment exists', async () => {
    const postId = 't3_test123';
    const mockComment = { id: 't1_newcomment123' };

    mockGetDrawingPost.mockResolvedValue({
      type: 'drawing',
      postId,
      word: 'test',
      dictionaryName: 'main',
      data: { data: '', colors: [], bg: 0, size: 16 },
      authorUserId: 'test-user',
      authorUsername: 'testuser',
      date: Date.now(),
      solves: 0,
      skips: 0,
      pinnedCommentId: null,
    } as DrawingPostDataExtended);

    mockGetGuessStats.mockResolvedValue({
      guesses: { grass: 1 },
      wordCount: 1,
      guessCount: 1,
      playerCount: 1,
      authorUsername: 'testuser',
      topGuesses: [{ word: 'grass', count: 1, percentage: '100.0' }],
      solves: 1,
      skips: 0,
    });

    mockReddit.submitComment.mockResolvedValue(mockComment);
    mockReddit.submitComment.mockReturnValue({
      distinguish: vi.fn().mockResolvedValue(undefined),
    });

    await updateDrawingPinnedComment({ postId });

    expect(mockReddit.submitComment).toHaveBeenCalledWith({
      text: expect.stringContaining('Live Drawing Analytics'),
      id: postId,
    });
    expect(mockSavePinnedCommentId).toHaveBeenCalledWith(
      postId,
      mockComment.id
    );
    expect(mockSaveLastCommentUpdate).toHaveBeenCalledWith(
      postId,
      expect.any(Number)
    );
  });

  it('should edit existing comment when pinned comment exists', async () => {
    const postId = 't3_test123';
    const existingCommentId = 't1_existingcomment123';
    const mockComment = {
      id: existingCommentId,
      edit: vi.fn().mockResolvedValue(undefined),
    };

    mockGetDrawingPost.mockResolvedValue({
      type: 'drawing',
      postId,
      word: 'test',
      dictionaryName: 'main',
      data: { data: '', colors: [], bg: 0, size: 16 },
      authorUserId: 'test-user',
      authorUsername: 'testuser',
      date: Date.now(),
      solves: 0,
      skips: 0,
      pinnedCommentId: existingCommentId,
    } as DrawingPostDataExtended);

    mockGetGuessStats.mockResolvedValue({
      guesses: { grass: 2, tree: 1 },
      wordCount: 2,
      guessCount: 5,
      playerCount: 3,
      authorUsername: 'testuser',
      topGuesses: [
        { word: 'grass', count: 2, percentage: '40.0' },
        { word: 'tree', count: 1, percentage: '20.0' },
      ],
      solves: 2,
      skips: 1,
    });

    mockReddit.getCommentById.mockResolvedValue(mockComment);

    await updateDrawingPinnedComment({ postId });

    expect(mockReddit.getCommentById).toHaveBeenCalledWith(existingCommentId);
    expect(mockComment.edit).toHaveBeenCalledWith({
      text: expect.stringContaining('Live Drawing Analytics'),
    });
    expect(mockSaveLastCommentUpdate).toHaveBeenCalledWith(
      postId,
      expect.any(Number)
    );
    // Should not create new comment or update pinned comment ID when editing succeeds
    expect(mockReddit.submitComment).not.toHaveBeenCalled();
    expect(mockSavePinnedCommentId).not.toHaveBeenCalled();
  });

  it('should fallback to creating new comment when edit fails', async () => {
    const postId = 't3_test123';
    const existingCommentId = 't1_existingcomment123';
    const newCommentId = 't1_newcomment456';
    const mockComment = { id: newCommentId };

    mockGetDrawingPost.mockResolvedValue({
      type: 'drawing',
      postId,
      word: 'test',
      dictionaryName: 'main',
      data: { data: '', colors: [], bg: 0, size: 16 },
      authorUserId: 'test-user',
      authorUsername: 'testuser',
      date: Date.now(),
      solves: 0,
      skips: 0,
      pinnedCommentId: existingCommentId,
    } as DrawingPostDataExtended);

    mockGetGuessStats.mockResolvedValue({
      guesses: { grass: 1 },
      wordCount: 1,
      guessCount: 1,
      playerCount: 1,
      authorUsername: 'testuser',
      topGuesses: [{ word: 'grass', count: 1, percentage: '100.0' }],
      solves: 1,
      skips: 0,
    });

    // Mock edit failure
    mockReddit.getCommentById.mockRejectedValue(new Error('Edit failed'));
    mockReddit.submitComment.mockResolvedValue(mockComment);
    mockReddit.submitComment.mockReturnValue({
      distinguish: vi.fn().mockResolvedValue(undefined),
    });

    await updateDrawingPinnedComment({ postId });

    expect(mockReddit.getCommentById).toHaveBeenCalledWith(existingCommentId);
    expect(mockReddit.submitComment).toHaveBeenCalledWith({
      text: expect.stringContaining('Live Drawing Analytics'),
      id: postId,
    });
    expect(mockSavePinnedCommentId).toHaveBeenCalledWith(postId, newCommentId);
    expect(mockSaveLastCommentUpdate).toHaveBeenCalledWith(
      postId,
      expect.any(Number)
    );
  });

  it('should handle missing postId gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await updateDrawingPinnedComment({ postId: '' });

    expect(consoleSpy).toHaveBeenCalledWith(
      'PostId is undefined or empty in updateDrawingPinnedComment job'
    );
    expect(mockReddit.submitComment).not.toHaveBeenCalled();
    expect(mockReddit.getCommentById).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should handle missing post data gracefully', async () => {
    const postId = 't3_nonexistent';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockGetDrawingPost.mockResolvedValue(null);

    await updateDrawingPinnedComment({ postId });

    expect(consoleSpy).toHaveBeenCalledWith(
      `Post data not found for ${postId}`
    );
    expect(mockReddit.submitComment).not.toHaveBeenCalled();
    expect(mockReddit.getCommentById).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
