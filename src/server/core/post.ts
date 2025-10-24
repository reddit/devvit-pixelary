import { context, type Post, reddit } from '@devvit/web/server';
import type { JsonObject } from '@devvit/shared-types/json.js';
import type { PostData } from '../../shared/schema/index';

/**
 * Convert PostData to JsonObject safely
 * @param postData - The post data to convert
 * @returns JsonObject representation of the post data
 */
function postDataToJsonObject(postData: PostData): JsonObject {
  // Since PostData is already a valid JSON-serializable object,
  // we can safely convert it by serializing and parsing
  return JSON.parse(JSON.stringify(postData)) as JsonObject;
}

/**
 * Create a new custom post unit in the current subreddit
 * @param title - The title of the post
 * @param postData - The post data as a JSON object. Max 2kb.
 * @param imageUrl - Optional Reddit-hosted image URL to include in the post
 * @returns The created Post object from the Reddit API.
 */
export async function createPost(
  title: string,
  postData: PostData,
  imageUrl?: string
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
    throw new Error(
      `Post data too large: ${postDataSize} bytes (max 2048 bytes)`
    );
  }

  const userGeneratedContent: {
    text: string;
    imageUrls?: string[];
  } = {
    text: 'Pixelary',
  };

  // Add image URL if provided
  if (imageUrl) {
    userGeneratedContent.imageUrls = [imageUrl];
  }

  const post = await reddit.submitCustomPost({
    userGeneratedContent,
    splash: {
      appDisplayName: 'Pixelary',
      backgroundUri: 'transparent.png', // HACK: Avoids default pattern
    },
    subredditName,
    title,
    postData: postDataToJsonObject(postData),
  });
  return post;
}
