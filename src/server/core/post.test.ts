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

describe('Post Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore context mock after clearing
    vi.mocked(context).subredditName = 'testsub';
  });

  describe('createPost', () => {
    it('should create a post successfully', async () => {
      const title = 'Test Post';
      const postData: PostData = { type: 'drawing' };
      const mockPost = { id: 't3_post123' };

      vi.mocked(reddit.submitCustomPost).mockResolvedValue(mockPost as Post);

      const result = await createPost(title, postData);

      expect(reddit.submitCustomPost).toHaveBeenCalledWith({
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
      const postData: PostData = { type: 'drawing' };

      // Mock context to have no subredditName
      vi.mocked(context).subredditName = undefined as string | undefined;

      await expect(createPost(title, postData)).rejects.toThrow(
        'subredditName is required'
      );

      // Restore context for other tests
      vi.mocked(context).subredditName = 'testsub';
    });

    it('should throw error when post data exceeds 2KB limit', async () => {
      const title = 'Test Post';
      const postData: PostData = {
        type: 'drawing',
        // Create large data to exceed 2KB
        largeData: 'x'.repeat(3000),
      };

      await expect(createPost(title, postData)).rejects.toThrow(
        'Post data too large'
      );
    });

    it('should allow post data exactly at 2KB limit', async () => {
      const title = 'Test Post';
      const postData: PostData = {
        type: 'drawing',
        // Create data exactly at 2KB limit (accounting for JSON overhead)
        largeData: 'x'.repeat(
          2048 - JSON.stringify({ type: 'drawing', largeData: '' }).length
        ),
      };
      const mockPost = { id: 't3_post123' };

      vi.mocked(reddit.submitCustomPost).mockResolvedValue(mockPost as Post);

      const result = await createPost(title, postData);

      expect(result).toBe(mockPost);
    });

    it('should allow post data under 2KB limit', async () => {
      const title = 'Test Post';
      const postData: PostData = {
        type: 'drawing',
        smallData: 'small',
      };
      const mockPost = { id: 't3_post123' };

      vi.mocked(reddit.submitCustomPost).mockResolvedValue(mockPost as Post);

      const result = await createPost(title, postData);

      expect(result).toBe(mockPost);
    });

    it('should handle JSON serialization edge cases', async () => {
      const title = 'Test Post';
      const postData: PostData = {
        type: 'drawing',
        specialChars:
          'Special chars: "quotes", \'apostrophes\', \n newlines, \t tabs',
        unicode: 'Unicode: 🎨 🖼️ ✨',
        numbers: [1, 2, 3],
        nested: { deep: { value: true } },
      };
      const mockPost = { id: 't3_post123' };

      vi.mocked(reddit.submitCustomPost).mockResolvedValue(mockPost as Post);

      const result = await createPost(title, postData);

      expect(result).toBe(mockPost);
    });

    it('should handle Reddit API errors', async () => {
      const title = 'Test Post';
      const postData: PostData = { type: 'drawing' };

      vi.mocked(reddit.submitCustomPost).mockRejectedValue(
        new Error('Reddit API error')
      );

      await expect(createPost(title, postData)).rejects.toThrow(
        'Reddit API error'
      );
    });

    it('should handle empty title', async () => {
      const title = '';
      const postData: PostData = { type: 'drawing' };
      const mockPost = { id: 't3_post123' };

      vi.mocked(reddit.submitCustomPost).mockResolvedValue(mockPost as Post);

      const result = await createPost(title, postData);

      expect(result).toBe(mockPost);
    });

    it('should handle very long title', async () => {
      const title = 'A'.repeat(300); // Very long title
      const postData: PostData = { type: 'drawing' };
      const mockPost = { id: 't3_post123' };

      vi.mocked(reddit.submitCustomPost).mockResolvedValue(mockPost as Post);

      const result = await createPost(title, postData);

      expect(result).toBe(mockPost);
    });

    it('should calculate post data size correctly', async () => {
      const title = 'Test Post';
      const postData: PostData = {
        type: 'drawing',
        testData: 'test',
      };
      const mockPost = { id: 't3_post123' };

      vi.mocked(reddit.submitCustomPost).mockResolvedValue(mockPost as Post);

      const result = await createPost(title, postData);

      expect(result).toBe(mockPost);
    });

    it('should handle Reddit API errors', async () => {
      const title = 'Test Post';
      const postData: PostData = { type: 'drawing' };
      const error = new Error('Reddit API error');

      vi.mocked(reddit.submitCustomPost).mockRejectedValue(error);

      await expect(createPost(title, postData)).rejects.toThrow(
        'Reddit API error'
      );
    });
  });
});
