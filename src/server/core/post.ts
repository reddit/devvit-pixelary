import { context, type Post, reddit } from '@devvit/web/server';
import type { JsonObject } from '@devvit/shared-types/json.js';
import type { PostData } from '../../shared/schema/index';

/**
 * Create a new custom post unit in the current subreddit
 * @param title - The title of the post
 * @param postData - The post data as a JSON object. Max 2kb.
 * @returns The created Post object from the Reddit API.
 */
export async function createPost(
  title: string,
  postData: PostData
): Promise<Post> {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  const post = await reddit.submitCustomPost({
    splash: {
      appDisplayName: 'Pixelary',
      backgroundUri: 'transparent.png', // HACK: Avoids default pattern
    },
    subredditName,
    title,
    postData: postData as JsonObject, // TODO: Fix this type mismatch
  });

  return post;
}
