import { redis } from '@devvit/web/server';
import { ErrorHandler, RateLimiter } from '../optimization';
import type { CommandContext, CommandResult, CommandHandler } from './types';

/**
 * Centralized Command Management System
 * Handles all command processing with proper security, rate limiting, and monitoring
 */
export class CommandManager {
  private static readonly COMMAND_RATE_LIMITS = {
    '!add': { requests: 3, window: 300 }, // 3 per 5 minutes
    '!remove': { requests: 5, window: 300 }, // 5 per 5 minutes
    '!list': { requests: 20, window: 60 }, // 20 per minute
    '!words': { requests: 10, window: 60 }, // 10 per minute
    '!stats': { requests: 10, window: 60 }, // 10 per minute
    '!score': { requests: 30, window: 60 }, // 30 per minute
    '!level': { requests: 30, window: 60 }, // 30 per minute
    '!leaderboard': { requests: 10, window: 60 }, // 10 per minute
    '!help': { requests: 5, window: 60 }, // 5 per minute
    '!featured': { requests: 5, window: 60 }, // 5 per minute
  } as const;

  private static readonly COMMAND_TIMEOUTS = {
    '!add': 10000, // 10 seconds
    '!remove': 10000,
    '!list': 5000,
    '!words': 5000,
    '!stats': 5000,
    '!score': 3000,
    '!level': 3000,
    '!leaderboard': 5000,
    '!help': 2000,
    '!featured': 5000,
  } as const;

  private static readonly MODERATOR_COMMANDS = new Set(['!remove']);

  private static commandHandlers = new Map<string, CommandHandler>();

  /**
   * Register a command handler
   */
  static registerCommand(command: string, handler: CommandHandler): void {
    this.commandHandlers.set(command.toLowerCase(), handler);
  }

  /**
   * Process a command with full security and monitoring
   */
  static async processCommand(
    command: string,
    args: string[],
    context: CommandContext
  ): Promise<CommandResult> {
    const startTime = Date.now();
    const normalizedCommand = command.toLowerCase();

    try {
      // 1. Validate command exists
      if (!this.commandHandlers.has(normalizedCommand)) {
        return {
          success: false,
          error: 'Unknown command',
        };
      }

      // 2. Check rate limiting
      const rateLimitKey = `cmd:${normalizedCommand}:${context.authorName}:${context.subredditName}`;
      const rateLimit =
        this.COMMAND_RATE_LIMITS[
          normalizedCommand as keyof typeof this.COMMAND_RATE_LIMITS
        ];

      if (rateLimit) {
        const isLimited = await RateLimiter.isRateLimited(
          rateLimitKey,
          'command_execution' as const
        );

        if (isLimited) {
          return {
            success: false,
            error: 'Rate limited. Please try again later.',
          };
        }
      }

      // 3. Check moderator permissions for moderator commands
      if (this.MODERATOR_COMMANDS.has(normalizedCommand)) {
        const isModerator = await this.checkModeratorPermission(
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

      // 4. Validate and sanitize arguments
      const sanitizedArgs = this.sanitizeArguments(args);

      // 5. Execute command with timeout
      const timeout =
        this.COMMAND_TIMEOUTS[
          normalizedCommand as keyof typeof this.COMMAND_TIMEOUTS
        ] || 5000;

      const result = await Promise.race([
        this.commandHandlers.get(normalizedCommand)!(sanitizedArgs, context),
        this.createTimeoutPromise(timeout),
      ]);

      // 6. Log command execution
      await this.logCommandExecution({
        command: normalizedCommand,
        args: sanitizedArgs,
        context,
        result,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      const errorResult = ErrorHandler.handleApiError(
        error,
        'command_execution'
      );

      await this.logCommandExecution({
        command: normalizedCommand,
        args,
        context,
        result: { success: false, error: errorResult.message },
        duration: Date.now() - startTime,
        error: errorResult,
      });

      return {
        success: false,
        error: errorResult.message,
      };
    }
  }

  /**
   * Check if user is moderator with caching
   */
  private static async checkModeratorPermission(
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

  /**
   * Sanitize command arguments
   */
  private static sanitizeArguments(args: string[]): string[] {
    return args
      .map((arg) => {
        // Remove potentially dangerous characters
        return arg
          .replace(/[<>"'&]/g, '') // Remove HTML/XML characters
          .trim()
          .slice(0, 100); // Limit length
      })
      .filter((arg) => arg.length > 0);
  }

  /**
   * Create timeout promise
   */
  private static createTimeoutPromise(timeout: number): Promise<CommandResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Command timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Log command execution for audit and monitoring
   */
  private static async logCommandExecution(data: {
    command: string;
    args: string[];
    context: CommandContext;
    result: CommandResult;
    duration: number;
    error?: unknown;
  }): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      command: data.command,
      args: data.args,
      author: data.context.authorName,
      subreddit: data.context.subredditName,
      commentId: data.context.commentId,
      success: data.result.success,
      duration: data.duration,
      error:
        data.error && typeof data.error === 'object' && 'code' in data.error
          ? (data.error as { code: string }).code
          : undefined,
      source: data.context.source,
    };

    // Store in Redis for analysis using sorted set with timestamp as score
    const timestamp = Date.now();
    await redis.zAdd('command_logs', {
      member: JSON.stringify(logEntry),
      score: timestamp,
    });

    // Keep only last 1000 entries by removing oldest ones
    const count = await redis.zCard('command_logs');
    if (count > 1000) {
      const toRemove = count - 1000;
      await redis.zRemRangeByRank('command_logs', 0, toRemove - 1);
    }

    // Log to console for immediate debugging
    if (data.result.success) {
      console.log(
        `✅ Command ${data.command} executed successfully in ${data.duration}ms`
      );
    } else {
      console.error(`❌ Command ${data.command} failed:`, data.result.error);
    }
  }

  /**
   * Get command execution statistics
   */
  static async getCommandStats(subredditName?: string): Promise<{
    totalCommands: number;
    successRate: number;
    averageDuration: number;
    topCommands: Array<{ command: string; count: number }>;
    errors: Array<{ error: string; count: number }>;
  }> {
    // Get all logs from the sorted set (ordered by timestamp)
    const logs = await redis.zRange('command_logs', 0, -1);
    const parsedLogs = logs.map((log) => JSON.parse(log.member));

    const filteredLogs = subredditName
      ? parsedLogs.filter((log) => log.subreddit === subredditName)
      : parsedLogs;

    const totalCommands = filteredLogs.length;
    const successfulCommands = filteredLogs.filter((log) => log.success).length;
    const successRate =
      totalCommands > 0 ? successfulCommands / totalCommands : 0;

    const averageDuration =
      filteredLogs.length > 0
        ? filteredLogs.reduce((sum, log) => sum + log.duration, 0) /
          filteredLogs.length
        : 0;

    // Count commands
    const commandCounts = new Map<string, number>();
    filteredLogs.forEach((log) => {
      const count = commandCounts.get(log.command) || 0;
      commandCounts.set(log.command, count + 1);
    });

    const topCommands = Array.from(commandCounts.entries())
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Count errors
    const errorCounts = new Map<string, number>();
    filteredLogs
      .filter((log) => !log.success && log.error)
      .forEach((log) => {
        const count = errorCounts.get(log.error) || 0;
        errorCounts.set(log.error, count + 1);
      });

    const errors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalCommands,
      successRate,
      averageDuration,
      topCommands,
      errors,
    };
  }
}
