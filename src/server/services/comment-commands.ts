import type { T5, T3, T1, T2 } from '@devvit/shared-types/tid.js';
import * as handlers from './comment-handlers';

export type CommandContext = {
  commentId: T1;
  authorName: string;
  authorId: T2;
  subredditName: string;
  subredditId: T5;
  postId?: T3;
  timestamp: number;
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
  '!show',
  '!help',
];

/**
 * Check if the text is a valid command. Returns `true` if the text is a valid command, `false` otherwise.
 */

export function isCommand(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const command = text.split(' ')[0]?.toLowerCase().trim();
  return command ? COMMAND_LIST.includes(command) : false;
}

/**
 * Parse the command and arguments from the text. Returns the command and arguments if the text is a valid command, `null` otherwise.
 */

export function parseCommand(text: string): {
  command: string;
  args: string[];
} {
  const parts = text.trim().split(' ');
  const command = parts[0]!.toLowerCase();
  const args = parts.slice(1) ?? [];
  return { command, args };
}

/**
 * Process the command and return a response message.
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
    case '!stats':
      return handlers.handleStats(args, context);
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
