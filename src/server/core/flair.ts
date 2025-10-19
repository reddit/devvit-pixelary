import { reddit, redis } from '@devvit/web/server';
import type { T2, T3 } from '@devvit/shared-types/tid.js';
import type { Level } from '../../shared/types';
import { REDIS_KEYS } from '../services/redis';

// Configuration-driven approach
const FLAIR_CONFIG = {
  user: {
    format: (level: Level) => `Level ${level.rank} - ${level.name}`,
    cssClass: (level: Level) => `level-${level.rank}`,
  },
  post: {
    templates: [
      { text: 'Unranked', difficulty: 'unranked', cssClass: 'unranked' },
      { text: '🟢 Easy', difficulty: 'easy', cssClass: 'easy' },
      { text: '🟡 Medium', difficulty: 'medium', cssClass: 'medium' },
      { text: '🟠 Hard', difficulty: 'hard', cssClass: 'hard' },
      { text: '🔴 Expert', difficulty: 'expert', cssClass: 'expert' },
    ],
  },
} as const;

// Type-safe stats interface
interface DrawingStats {
  playerCount: number;
  guessCount: number;
  solves: number;
  solvedPercentage: number;
  skips: number;
  skipPercentage: number;
  wordCount: number;
  guesses: { word: string; count: number }[];
}

/**
 * Ensure all required flair templates exist for the subreddit
 * Creates missing templates and saves their IDs to Redis
 */
export async function ensureFlairTemplates(
  subredditName: string
): Promise<void> {
  try {
    // Check if flair is enabled by trying to get templates
    const [userTemplates, postTemplates] = await Promise.all([
      reddit.getUserFlairTemplates(subredditName).catch((error) => {
        console.warn(
          `User flair not enabled or accessible for r/${subredditName}:`,
          error.message
        );
        return [];
      }),
      reddit.getPostFlairTemplates(subredditName).catch((error) => {
        console.warn(
          `Post flair not enabled or accessible for r/${subredditName}:`,
          error.message
        );
        return [];
      }),
    ]);

    // Check if user flair is enabled (for informational purposes)
    if (userTemplates.length === 0) {
      console.warn(
        `User flair is not enabled for r/${subredditName}. Skipping user flair setup. To enable user flair, moderators should go to Subreddit Settings > Community Settings > User Flair and enable it.`
      );
    }

    // Create post flair templates (we still need these for post difficulty flair)
    await Promise.all(
      FLAIR_CONFIG.post.templates.map(async (template) => {
        const existing = postTemplates.find((t) => t.text === template.text);

        const templateId =
          existing?.id ??
          (
            await reddit.createPostFlairTemplate({
              subredditName,
              text: template.text,
            })
          ).id;

        await redis.set(
          REDIS_KEYS.flairTemplates.post(template.difficulty),
          templateId
        );
      })
    );

    // Flair templates ensured
  } catch (error) {
    console.error(
      `Error ensuring flair templates for r/${subredditName}:`,
      error
    );
    // Don't throw - flair setup should not block app installation
  }
}

/**
 * Set user flair based on their level
 */
export async function setUserFlair(
  userId: T2,
  subredditName: string,
  level: Level
): Promise<void> {
  try {
    // First check if user flair is enabled
    const userTemplates = await reddit
      .getUserFlairTemplates(subredditName)
      .catch((error) => {
        console.warn(
          `Failed to get user flair templates for r/${subredditName}:`,
          error.message
        );
        return [];
      });

    if (userTemplates.length === 0) {
      console.warn(
        `User flair is not enabled for r/${subredditName}. Skipping user flair for ${userId}. To enable user flair, moderators should go to Subreddit Settings > Community Settings > User Flair and enable it.`
      );
      return;
    }

    // Set user flair directly with text and CSS class (like old Pixelary)
    const flairText = FLAIR_CONFIG.user.format(level);
    const cssClass = FLAIR_CONFIG.user.cssClass(level);

    await reddit.setUserFlair({
      username: userId,
      subredditName,
      text: flairText,
      cssClass: cssClass,
    });

    // User flair set
  } catch (error) {
    // Check if it's a 404 error (API endpoint not found)
    if (error instanceof Error && error.message.includes('404')) {
      console.warn(
        `User flair API returned 404 for r/${subredditName}. This may indicate that user flair is not properly configured or the API endpoint has changed. Skipping user flair for ${userId}.`
      );
    } else {
      console.error(`Error setting user flair for ${userId}:`, error);
    }
    // Don't throw - flair setting should not block other operations
  }
}

/**
 * Set post flair based on difficulty
 */
export async function setPostFlair(
  postId: T3,
  subredditName: string,
  difficulty: string
): Promise<void> {
  try {
    const templateId = await redis.get(
      REDIS_KEYS.flairTemplates.post(difficulty)
    );
    if (!templateId) {
      console.error(`No flair template found for difficulty ${difficulty}`);
      return;
    }

    await reddit.setPostFlair({
      postId,
      subredditName,
      flairTemplateId: templateId,
    });

    // Post flair set
  } catch (error) {
    console.error(`Error setting post flair for ${postId}:`, error);
    // Don't throw - flair setting should not block other operations
  }
}

/**
 * Get difficulty level from drawing stats
 */
export function getDifficultyFromStats(stats: DrawingStats): string | null {
  // Only return difficulty if threshold is met (same as UI)
  if (stats.guessCount < 100) {
    return null;
  }

  const difficultyScore =
    stats.playerCount > 0
      ? Math.round((stats.guessCount / stats.playerCount) * 10) / 10
      : 0;

  if (difficultyScore < 2) return 'easy';
  if (difficultyScore < 4) return 'medium';
  if (difficultyScore < 6) return 'hard';
  return 'expert';
}
