import { redis } from '@devvit/web/server';

/**
 * Centralized Redis key factory with namespace management
 * Provides consistent key generation across the application
 */
export class RedisKeyFactory {
  private static readonly NAMESPACE = 'pixelary';

  /**
   * Generate a namespaced key for post-related data
   */
  static postKey(postId: string | null, suffix: string): string {
    return `${this.NAMESPACE}:post:${postId ?? 'unknown'}:${suffix}`;
  }

  /**
   * Generate a namespaced key for global data
   */
  static globalKey(suffix: string): string {
    return `${this.NAMESPACE}:global:${suffix}`;
  }

  /**
   * Generate a namespaced key for user-related data by userId
   */
  static userKey(userId: string, suffix: string): string {
    return `${this.NAMESPACE}:user:${userId}:${suffix}`;
  }

  /**
   * Generate a namespaced key for leaderboard data
   */
  static leaderboardKey(suffix: string): string {
    return `${this.NAMESPACE}:leaderboard:${suffix}`;
  }

  /**
   * Generate a namespaced key for stats data
   */
  static statsKey(postId: string | null): string {
    return this.postKey(postId, 'stats');
  }

  /**
   * Generate a namespaced key for config data
   */
  static configKey(postId: string | null): string {
    return this.postKey(postId, 'config');
  }

  /**
   * Generate a namespaced key for drawing data
   */
  static drawingKey(postId: string | null, username?: string): string {
    const userSuffix = username ? `:${username}` : '';
    return this.postKey(postId, `drawing${userSuffix}`);
  }

  /**
   * Generate a namespaced key for words data
   */
  static wordsKey(): string {
    return this.globalKey('words');
  }

  /**
   * Generate a namespaced key for word count
   */
  static wordCountKey(): string {
    return this.globalKey('word_count');
  }

  /**
   * Pixelary-specific keys
   */
  static dictionaryKey(subredditName: string): string {
    return this.globalKey(`dictionary:${subredditName}`);
  }

  static bannedWordsKey(subredditName: string): string {
    return this.globalKey(`banned-words:${subredditName}`);
  }

  static featuredCommunityKey(): string {
    return this.globalKey('featured-community');
  }

  static communitiesKey(): string {
    return this.globalKey('communities');
  }

  static postDataKey(postId: string): string {
    return this.postKey(postId, 'data');
  }

  static postGuessesKey(postId: string): string {
    return this.postKey(postId, 'guesses');
  }

  static postSolvedKey(postId: string): string {
    return this.postKey(postId, 'solved');
  }

  static postSkippedKey(postId: string): string {
    return this.postKey(postId, 'skipped');
  }

  static postUserGuessCounterKey(postId: string): string {
    return this.postKey(postId, 'user-guess-counter');
  }

  static guessCommentsKey(postId: string): string {
    return this.postKey(postId, 'guess-comments');
  }

  static scoresKey(): string {
    return this.globalKey('pixels:default');
  }

  static userDataKey(userId: string): string {
    return this.userKey(userId, 'data');
  }

  static userDrawingsKey(userId: string): string {
    return this.userKey(userId, 'drawings');
  }

  static wordDrawingsKey(word: string): string {
    return this.globalKey(`word-drawings:${word}`);
  }

  static wordSelectionEventsKey(): string {
    return this.globalKey('word-selection-events-v2');
  }

  /**
   * Generate a namespaced key for word metadata
   */
  static wordMetadataKey(subredditName: string, word: string): string {
    const normalizedWord =
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    return this.globalKey(`word-metadata:${subredditName}:${normalizedWord}`);
  }

  /**
   * Generate a namespaced key for reported words
   */
  static reportedWordsKey(subredditName: string): string {
    return this.globalKey(`reported-words:${subredditName}`);
  }

  /**
   * Generate a namespaced key for word command comments tracking
   */
  static wordCommandCommentsKey(subredditName: string): string {
    return this.globalKey(`word-command-comments:${subredditName}`);
  }
}

/**
 * Redis service with improved error handling and type safety
 */
export class RedisService {
  /**
   * Get a value from Redis with proper error handling
   */
  static async get<T = string>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      if (!value) return null;

      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      console.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in Redis with proper error handling
   */
  static async set(
    key: string,
    value: string | number | boolean | object,
    ttlSeconds?: number
  ): Promise<boolean> {
    try {
      const serialized =
        typeof value === 'string' ? value : JSON.stringify(value);

      if (ttlSeconds) {
        await redis.set(key, serialized, {
          expiration: new Date(Date.now() + ttlSeconds * 1000),
        });
      } else {
        await redis.set(key, serialized);
      }

      return true;
    } catch (error) {
      console.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete a key from Redis with proper error handling
   */
  static async del(key: string): Promise<boolean> {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Increment a counter in Redis with proper error handling
   */
  static async incr(key: string): Promise<number | null> {
    try {
      return await redis.incrBy(key, 1);
    } catch (error) {
      console.error(`Redis INCR error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get multiple keys from Redis with proper error handling
   */
  static async mget<T = string>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await redis.mGet(keys);
      return values.map((value: string | null) => {
        if (!value) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      });
    } catch (error) {
      console.error(`Redis MGET error for keys ${keys.join(', ')}:`, error);
      return keys.map(() => null);
    }
  }

  /**
   * Check if a key exists in Redis
   */
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Add a member to a sorted set
   */
  static async zAdd(
    key: string,
    member: { member: string; score: number }
  ): Promise<boolean> {
    try {
      await redis.zAdd(key, member);
      return true;
    } catch (error) {
      console.error(`Redis ZADD error for key ${key}:`, error);
      return false;
    }
  }
}
