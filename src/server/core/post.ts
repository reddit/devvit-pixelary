import { context, reddit, scheduler } from '@devvit/web/server';
import type { JsonObject } from '@devvit/shared-types/json.js';
import { setPinnedPost } from '../services/redis';
import type { PostData } from '../../shared/schema/index';
import { submitDrawing } from '../services/drawing-post';

export const createPost = async () => {
  return await createPostWithType('drawing', '<% name %>');
};

export const createPostWithType = async (
  postType: string | string[],
  title: string,
  message?: string
) => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  // Handle both string and array inputs from form fields
  const postTypeValue = Array.isArray(postType) ? postType[0] : postType;

  if (!postTypeValue || typeof postTypeValue !== 'string') {
    throw new Error(
      `Invalid post type: ${JSON.stringify(postType)}. Expected a string.`
    );
  }

  // Normalize and validate post type
  const normalizedPostType = postTypeValue.trim().toLowerCase();
  const validTypes = [
    'drawing',
    'pinned',
    'weekly-leaderboard',
    'weekly-collection',
  ];

  if (!validTypes.includes(normalizedPostType)) {
    throw new Error(
      `Invalid post type: "${postTypeValue}". Valid types are: ${validTypes.join(', ')}`
    );
  }

  let postData: Partial<PostData> = {
    type: normalizedPostType as PostData['type'],
  };

  // Add type-specific data
  switch (normalizedPostType) {
    case 'drawing':
      postData = {
        ...postData,
        seed: `${Date.now()}`,
        mode: 'single-player',
        createdAt: Date.now(),
        timerSec: 60,
        admins: [],
      };
      break;
    case 'pinned':
      postData = {
        ...postData,
        pinnedAt: Date.now(),
        pinnedBy: 'admin', // In a real app, you'd get this from the current user
        message: message || 'This post has been pinned',
      };
      break;
    case 'weekly-leaderboard':
      postData = {
        ...postData,
        weekStart: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
        weekEnd: Date.now(),
        topScores: [],
      };
      break;
    case 'weekly-collection':
      postData = {
        ...postData,
        weekStart: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
        weekEnd: Date.now(),
        topScores: [],
      };
      break;
    default:
      throw new Error(`Unknown post type: ${postType}`);
  }

  const post = await reddit.submitCustomPost({
    splash: {
      appDisplayName: 'Pixelary',
      backgroundUri: 'transparent.png',
    },
    subredditName: subredditName,
    title: title,
    postData: postData as JsonObject,
  });

  // Handle pinning logic for pinned posts
  if (normalizedPostType === 'pinned') {
    try {
      // Pin the new post
      await post.sticky(1); // Pin the new post

      // Set the new post as pinned in Redis
      await setPinnedPost(subredditName, post.id);

      // Schedule pinned comment creation
      await scheduler.runJob({
        name: 'CREATE_PINNED_POST_COMMENT',
        data: { postId: post.id },
        runAt: new Date(Date.now() + 100),
      });

      console.log(`Successfully pinned post ${post.id} in r/${subredditName}`);
    } catch (error) {
      console.error('Error handling pinning:', error);
      // Don't fail the post creation if pinning fails
      console.log(
        `Post ${post.id} created but pinning failed - user may not have moderator permissions`
      );
    }
  }

  return post;
};

export const createDrawingPost = async (
  word: string,
  dictionaryName: string,
  data: { data: string; colors: string[]; bg: number; size: number },
  context: {
    subredditName: string;
    username: string;
    userId: string | null;
    reddit: typeof reddit;
    scheduler: typeof scheduler;
  }
) => {
  const { subredditName, username, userId, reddit, scheduler } = context;

  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  if (!username) {
    throw new Error('Must be logged in to submit drawing');
  }

  // Create actual Reddit post
  const post = await reddit.submitCustomPost({
    splash: {
      appDisplayName: 'Pixelary',
      backgroundUri: 'transparent.png',
    },
    subredditName: subredditName,
    title: `What did u/${username} draw?`,
    postData: {
      type: 'drawing',
      seed: `${Date.now()}`,
      mode: 'single-player',
      createdAt: Date.now(),
      timerSec: 60,
      admins: [],
      word: word,
      dictionaryName: dictionaryName,
      data: data,
      authorUserId: userId ?? '',
      authorUsername: username,
    },
  });

  // Submit drawing data
  const success = await submitDrawing(
    {
      postId: post.id,
      word: word,
      dictionaryName: dictionaryName,
      data: data,
      authorUserId: userId ?? '',
      authorUsername: username,
      subreddit: subredditName,
    },
    {
      scheduler: {
        runJob: async (params: {
          name: string;
          data: unknown;
          runAt?: Date;
        }) => {
          await scheduler.runJob({
            name: params.name,
            data: params.data as JsonObject,
            runAt: params.runAt ?? new Date(),
          });
        },
      },
    }
  );

  if (!success) {
    throw new Error('Failed to submit drawing');
  }

  return post;
};
