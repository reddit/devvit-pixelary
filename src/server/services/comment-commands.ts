import { redis } from '@devvit/web/server';
import type { T5 } from '../../shared/types/TID';
import * as handlers from './comment-command-handlers';

export type CommandContext = {
  commentId: string;
  authorName: string;
  subredditName: string;
  subredditId: T5;
  timestamp: number;
  source: 'devvit' | 'http' | 'test';
};

export type CommandResult = {
  success: boolean;
  response?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

export type CommandHandler = (
  args: string[],
  context: CommandContext
) => Promise<CommandResult>;

const COMMAND_LIST = [
  '!add',
  '!remove',
  '!words',
  '!stats',
  '!score',
  '!level',
  '!leaderboard',
  '!help',
];

export function isCommand(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const command = text.split(' ')[0]?.toLowerCase().trim();
  return command ? COMMAND_LIST.includes(command) : false;
}

/**
 * Simplified command processing
 */
export async function processCommand(
  command: string,
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const normalizedCommand = command.toLowerCase();

  // Check if user is moderator for moderator commands
  if (normalizedCommand === '!remove') {
    const isModerator = await checkModeratorPermission(
      context.authorName,
      context.subredditName
    );

    if (!isModerator) {
      return {
        success: false,
        error: 'Insufficient permissions',
      };
    }
  }

  // Route to appropriate handler
  switch (normalizedCommand) {
    case '!words':
      return handlers.handleWords(args, context);
    case '!add':
      return handlers.handleAdd(args, context);
    case '!remove':
      return handlers.handleRemove(args, context);
    case '!stats':
      return handlers.handleStats(args, context);
    case '!score':
      return handlers.handleScore(args, context);
    case '!level':
      return handlers.handleLevel(args, context);
    case '!leaderboard':
      return handlers.handleLeaderboard(args, context);
    case '!help':
      return handlers.handleHelp(args, context);
    default:
      return {
        success: false,
        error: 'Unknown command',
      };
  }
}

/**
 * Check if user is moderator with caching
 */
async function checkModeratorPermission(
  username: string,
  subredditName: string
): Promise<boolean> {
  const cacheKey = `mod:${username}:${subredditName}`;

  // Check cache first
  const cached = await redis.get(cacheKey);
  if (cached !== null) {
    return cached === 'true';
  }

  // Check with Reddit API
  try {
    const { reddit } = await import('@devvit/web/server');
    const moderators = await reddit.getModerators({ subredditName });
    const moderatorList = await moderators.all();
    const isModerator = moderatorList.some(
      (mod: { username: string }) => mod.username === username
    );

    // Cache result for 5 minutes
    await redis.set(cacheKey, isModerator.toString());

    return isModerator;
  } catch (error) {
    console.error('Failed to check moderator permission:', error);
    return false;
  }
}
