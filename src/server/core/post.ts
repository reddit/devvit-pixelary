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

  // Calculate the size of the postData to check against 2KB limit
  const postDataString = JSON.stringify(postData);
  const postDataSize = Buffer.byteLength(postDataString, 'utf8');

  // Check if postData exceeds 2KB limit
  if (postDataSize > 2048) {
    console.error('Post data exceeds 2KB limit:', {
      postDataSize,
      postDataSizeKB: Math.round((postDataSize / 1024) * 100) / 100,
      limitKB: 2,
    });
    throw new Error(
      `Post data too large: ${postDataSize} bytes (max 2048 bytes)`
    );
  }

  const post = await reddit.submitCustomPost({
    userGeneratedContent: {
      text: 'Pixelary',
      // HACK: This does not pass the actual UGC. Will need to investigate generating an image to pass here instead.
    },
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
