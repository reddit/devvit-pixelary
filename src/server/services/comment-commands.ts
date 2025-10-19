import type { T5, T3 } from '@devvit/shared-types/tid.js';
import * as handlers from './comment-command-handlers';

export type CommandContext = {
  commentId: string;
  authorName: string;
  authorId: string;
  subredditName: string;
  subredditId: T5;
  postId?: T3;
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
  '!word',
  '!score',
  '!show',
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

  // Route to appropriate handler
  switch (normalizedCommand) {
    case '!words':
      return handlers.handleWords(args, context);
    case '!add':
      return handlers.handleAdd(args, context);
    case '!remove':
      return handlers.handleRemove(args, context);
    case '!word':
      return handlers.handleWord(args);
    case '!score':
      return handlers.handleScore(args, context);
    case '!show':
      return handlers.handleShow(args, context);
    case '!help':
      return handlers.handleHelp(args, context);
    default:
      return {
        success: false,
        error: 'Unknown command',
      };
  }
}
