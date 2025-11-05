import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the context
vi.mock('@devvit/web/server', () => ({
  context: {
    subredditName: 'testsub',
  },
  reddit: {
    submitCustomPost: vi.fn(),
  },
}));

import { reddit, context, type Post } from '@devvit/web/server';
import { createPost } from './post';
import type { PostData } from '@shared/schema/index';
import type { DrawingPostData } from '@shared/schema/pixelary';

function makeDrawingPostData(
  overrides: Partial<DrawingPostData> = {}
): DrawingPostData {
  const base: DrawingPostData = {
    type: 'drawing',
    word: 'test',
    dictionary: 'default',
    drawing: { data: '', colors: [], bg: 0, size: 16 },
    authorId: 'u_test',
    authorName: 'tester',
  };
  return { ...base, ...overrides };
}

describe('Post Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore context mock after clearing
    vi.mocked(context).subredditName = 'testsub';
  });

  describe('createPost', () => {
    it('should create a post successfully', async () => {
      const title = 'Test Post';
      const postData: PostData = makeDrawingPostData();
      const mockPost = { id: 't3_post123' };

      vi.mocked(reddit.submitCustomPost).mockResolvedValue(mockPost as Post);

      const result = await createPost(title, postData);

      expect(reddit.submitCustomPost).toHaveBeenCalledWith({
        entry: 'default',
        userGeneratedContent: {
          text: 'Pixelary',
        },
        splash: {
          appDisplayName: 'Pixelary',
          backgroundUri: 'transparent.png',
        },
        subredditName: 'testsub',
        title,
        postData: postData,
      });
      expect(result).toBe(mockPost);
    });

    it('should create a pinned post successfully', async () => {
      const title = 'Pinned Post';
      const postData: PostData = { type: 'pinned' };
      const mockPost = { id: 't3_post123' };

      vi.mocked(reddit.submitCustomPost).mockResolvedValue(mockPost as Post);

      const result = await createPost(title, postData);

      expect(reddit.submitCustomPost).toHaveBeenCalledWith({
        entry: 'pinned',
        userGeneratedContent: {
          text: 'Pixelary',
        },
        splash: {
          appDisplayName: 'Pixelary',
          backgroundUri: 'transparent.png',
        },
        subredditName: 'testsub',
        title,
        postData: postData,
      });
      expect(result).toBe(mockPost);
    });

    it('should throw error when subredditName is missing', async () => {
      const title = 'Test Post';
      const postData: PostData = makeDrawingPostData();

      // Mock context to have no subredditName
      vi.mocked(context).subredditName = undefined as unknown as string;

      await expect(createPost(title, postData)).rejects.toThrow(
        'subredditName is required'
      );

      // Restore context for other tests
      vi.mocked(context).subredditName = 'testsub';
    });

    it('should throw error when post data exceeds 2KB limit', async () => {
      const title = 'Test Post';
      const base = makeDrawingPostData();
      const postData = {
        ...base,
        drawing: { ...base.drawing, data: 'x'.repeat(3000) },
      };

      await expect(createPost(title, postData)).rejects.toThrow(
        'Post data too large'
      );
    });

    it('should allow post data exactly at 2KB limit', async () => {
      const title = 'Test Post';
      const base = makeDrawingPostData();
      const baseSize = Buffer.byteLength(JSON.stringify(base), 'utf8');
      const allowed = Math.max(0, 2048 - baseSize);
      const postData = {
        ...base,
        drawing: { ...base.drawing, data: 'x'.repeat(allowed) },
      };
      const mockPost = { id: 't3_post123' };

      vi.mocked(reddit.submitCustomPost).mockResolvedValue(mockPost as Post);

      const result = await createPost(title, postData);

      expect(result).toBe(mockPost);
    });

    it('should allow post data under 2KB limit', async () => {
      const title = 'Test Post';
      const base = makeDrawingPostData();
      const postData = {
        ...base,
        drawing: { ...base.drawing, data: 'small' },
      };
      const mockPost = { id: 't3_post123' };

      vi.mocked(reddit.submitCustomPost).mockResolvedValue(mockPost as Post);

      const result = await createPost(title, postData);

      expect(result).toBe(mockPost);
    });

    it('should handle JSON serialization edge cases', async () => {
      const title = 'Test Post';
      const base = makeDrawingPostData();
      const trickyString =
        'Special chars: "quotes", \'apostrophes\', \n newlines, \t tabs | ' +
        'Unicode: 🎨 🖼️ ✨ | numbers: [1,2,3] | nested: {"deep": {"value": true}}';
      const postData = {
        ...base,
        drawing: { ...base.drawing, data: trickyString },
      };
      const mockPost = { id: 't3_post123' };

      vi.mocked(reddit.submitCustomPost).mockResolvedValue(mockPost as Post);

      const result = await createPost(title, postData);

      expect(result).toBe(mockPost);
    });

    it('should handle Reddit API errors', async () => {
      const title = 'Test Post';
      const postData: PostData = makeDrawingPostData();

      vi.mocked(reddit.submitCustomPost).mockRejectedValue(
        new Error('Reddit API error')
      );

      await expect(createPost(title, postData)).rejects.toThrow(
        'Reddit API error'
      );
    });

    it('should handle empty title', async () => {
      const title = '';
      const postData: PostData = makeDrawingPostData();
      const mockPost = { id: 't3_post123' };

      vi.mocked(reddit.submitCustomPost).mockResolvedValue(mockPost as Post);

      const result = await createPost(title, postData);

      expect(result).toBe(mockPost);
    });

    it('should handle very long title', async () => {
      const title = 'A'.repeat(300); // Very long title
      const postData: PostData = makeDrawingPostData();
      const mockPost = { id: 't3_post123' };

      vi.mocked(reddit.submitCustomPost).mockResolvedValue(mockPost as Post);

      const result = await createPost(title, postData);

      expect(result).toBe(mockPost);
    });

    it('should calculate post data size correctly', async () => {
      const title = 'Test Post';
      const base = makeDrawingPostData();
      const postData = {
        ...base,
        drawing: { ...base.drawing, data: 'test' },
      };
      const mockPost = { id: 't3_post123' };

      vi.mocked(reddit.submitCustomPost).mockResolvedValue(mockPost as Post);

      const result = await createPost(title, postData);

      expect(result).toBe(mockPost);
    });

    it('should handle Reddit API errors', async () => {
      const title = 'Test Post';
      const postData: PostData = makeDrawingPostData();
      const error = new Error('Reddit API error');

      vi.mocked(reddit.submitCustomPost).mockRejectedValue(error);

      await expect(createPost(title, postData)).rejects.toThrow(
        'Reddit API error'
      );
    });
  });
});
