import { redis } from '@devvit/web/server';

/**
 * Security validation utilities for command system
 */
export class SecurityValidator {
  private static readonly SUSPICIOUS_PATTERNS = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /function\s*\(/i,
    /import\s+/i,
    /require\s*\(/i,
    /process\./i,
    /fs\./i,
    /child_process/i,
  ];

  private static readonly MAX_COMMAND_LENGTH = 1000;
  private static readonly MAX_ARGS_LENGTH = 100;
  private static readonly MAX_TOTAL_ARGS = 10;

  /**
   * Validate command input for security threats
   */
  static validateCommandInput(
    command: string,
    args: string[],
    context: { authorName: string; subredditName: string }
  ): { valid: boolean; error?: string; sanitizedArgs?: string[] } {
    // 1. Check command length
    if (command.length > this.MAX_COMMAND_LENGTH) {
      return {
        valid: false,
        error: 'Command too long',
      };
    }

    // 2. Check args count
    if (args.length > this.MAX_TOTAL_ARGS) {
      return {
        valid: false,
        error: 'Too many arguments',
      };
    }

    // 3. Validate and sanitize arguments
    const sanitizedArgs: string[] = [];

    for (const arg of args) {
      // Check arg length
      if (arg.length > this.MAX_ARGS_LENGTH) {
        return {
          valid: false,
          error: 'Argument too long',
        };
      }

      // Check for suspicious patterns
      if (this.containsSuspiciousPattern(arg)) {
        return {
          valid: false,
          error: 'Invalid characters in argument',
        };
      }

      // Sanitize argument
      const sanitized = this.sanitizeString(arg);
      sanitizedArgs.push(sanitized);
    }

    // 4. Validate context
    if (!this.isValidUsername(context.authorName)) {
      return {
        valid: false,
        error: 'Invalid username',
      };
    }

    if (!this.isValidSubredditName(context.subredditName)) {
      return {
        valid: false,
        error: 'Invalid subreddit name',
      };
    }

    return {
      valid: true,
      sanitizedArgs,
    };
  }

  /**
   * Check if string contains suspicious patterns
   */
  private static containsSuspiciousPattern(input: string): boolean {
    return this.SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(input));
  }

  /**
   * Sanitize string by removing dangerous characters
   */
  private static sanitizeString(input: string): string {
    return (
      input
        .replace(/[<>"'&]/g, '') // Remove HTML/XML characters
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F\u007F]/g, '') // Remove control characters
        .trim()
        .slice(0, this.MAX_ARGS_LENGTH)
    );
  }

  /**
   * Validate username format
   */
  private static isValidUsername(username: string): boolean {
    if (!username || typeof username !== 'string') {
      return false;
    }

    // Reddit username rules: 3-20 characters, alphanumeric and underscores
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
  }

  /**
   * Validate subreddit name format
   */
  private static isValidSubredditName(subredditName: string): boolean {
    if (!subredditName || typeof subredditName !== 'string') {
      return false;
    }

    // Reddit subreddit rules: 3-21 characters, alphanumeric and underscores
    return /^[a-zA-Z0-9_]{3,21}$/.test(subredditName);
  }

  /**
   * Check for potential spam/abuse patterns
   */
  static async checkForAbuse(
    authorName: string,
    subredditName: string,
    command: string
  ): Promise<{ isAbuse: boolean; reason?: string }> {
    const abuseKey = `abuse:${authorName}:${subredditName}`;

    try {
      // Check recent command frequency
      const recentCommands = await redis.zRange(abuseKey, 0, 9);
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      // Count commands in last 5 minutes
      const recentCount = recentCommands.filter(
        (item: { member: string; score: number }) => {
          const timestamp = parseInt(item.member.split(':')[0] || '0');
          return timestamp > fiveMinutesAgo;
        }
      ).length;

      // If more than 10 commands in 5 minutes, flag as abuse
      if (recentCount >= 10) {
        return {
          isAbuse: true,
          reason: 'Too many commands in short time',
        };
      }

      // Check for command repetition
      const sameCommandCount = recentCommands.filter(
        (item: { member: string; score: number }) =>
          item.member.includes(`:${command}:`)
      ).length;

      if (sameCommandCount >= 5) {
        return {
          isAbuse: true,
          reason: 'Repeated command execution',
        };
      }

      // Record this command using sorted set
      await redis.zAdd(abuseKey, {
        member: `${now}:${command}`,
        score: now,
      });

      // Keep only last 20 commands
      const count = await redis.zCard(abuseKey);
      if (count > 20) {
        const toRemove = count - 20;
        await redis.zRemRangeByRank(abuseKey, 0, toRemove - 1);
      }

      await redis.expire(abuseKey, 300); // Expire after 5 minutes

      return { isAbuse: false };
    } catch (error) {
      console.error('Abuse check failed:', error);
      // Fail open - allow command if abuse check fails
      return { isAbuse: false };
    }
  }

  /**
   * Validate word input for dictionary commands
   */
  static validateWord(word: string): {
    valid: boolean;
    error?: string;
    sanitized?: string;
  } {
    if (!word || typeof word !== 'string') {
      return {
        valid: false,
        error: 'Word is required',
      };
    }

    const trimmed = word.trim();

    if (trimmed.length === 0) {
      return {
        valid: false,
        error: 'Word cannot be empty',
      };
    }

    if (trimmed.length > 50) {
      return {
        valid: false,
        error: 'Word too long (max 50 characters)',
      };
    }

    // Check for valid characters (letters, numbers, spaces, hyphens)
    if (!/^[a-zA-Z0-9\s-]+$/.test(trimmed)) {
      return {
        valid: false,
        error: 'Word contains invalid characters',
      };
    }

    // Check for suspicious patterns
    if (this.containsSuspiciousPattern(trimmed)) {
      return {
        valid: false,
        error: 'Word contains invalid content',
      };
    }

    return {
      valid: true,
      sanitized: trimmed,
    };
  }

  /**
   * Validate page number for pagination commands
   */
  static validatePageNumber(pageStr: string): {
    valid: boolean;
    page?: number;
    error?: string;
  } {
    if (!pageStr) {
      return { valid: true, page: 1 };
    }

    const page = parseInt(pageStr, 10);

    if (isNaN(page)) {
      return {
        valid: false,
        error: 'Invalid page number',
      };
    }

    if (page < 1 || page > 1000) {
      return {
        valid: false,
        error: 'Page number out of range (1-1000)',
      };
    }

    return {
      valid: true,
      page,
    };
  }
}
