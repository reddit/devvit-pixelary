import { reddit, redis, scheduler } from '@devvit/web/server';
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
      reddit.getUserFlairTemplates(subredditName).catch(() => []),
      reddit.getPostFlairTemplates(subredditName).catch(() => []),
    ]);

    // Check if user flair is enabled (for informational purposes)
    if (userTemplates.length === 0) {
      // User flair is not enabled - this is informational only
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
    // Don't throw - flair setup should not block app installation
  }
}

/**
 * Set user flair based on their level
 * Uses scheduler to run in app context for proper permissions
 */
export async function setUserFlair(
  userId: T2,
  subredditName: string,
  level: Level
): Promise<void> {
  try {
    // Schedule the flair setting job to run in app context
    await scheduler.runJob({
      name: 'SET_USER_FLAIR',
      data: {
        userId,
        subredditName,
        level,
      },
      runAt: new Date(), // run immediately
    });
  } catch (error) {
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
      return;
    }

    await reddit.setPostFlair({
      postId,
      subredditName,
      flairTemplateId: templateId,
    });

    // Post flair set
  } catch (error) {
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
