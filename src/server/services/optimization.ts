import { redis } from '@devvit/web/server';
import { RedisKeyFactory } from '../services/redis-factory';

/**
 * Rate limiting service for Pixelary
 * Prevents abuse of API endpoints
 */

export class RateLimiter {
  private static readonly RATE_LIMITS = {
    drawing_submission: { requests: 1, window: 20 }, // 1 per 20 seconds
    guess_submission: { requests: 10, window: 60 }, // 10 per minute
    dictionary_modification: { requests: 5, window: 300 }, // 5 per 5 minutes
    comment_creation: { requests: 3, window: 60 }, // 3 per minute
    command_execution: { requests: 3, window: 60 }, // 3 per minute
  } as const;

  static async checkRateLimit(
    key: string,
    limitType: keyof typeof RateLimiter.RATE_LIMITS
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const limits = this.RATE_LIMITS[limitType];
    const rateLimitKey = RedisKeyFactory.globalKey(
      `rate-limit:${limitType}:${key}`
    );

    try {
      const current = await redis.get(rateLimitKey);
      const now = Date.now();
      const windowStart = now - limits.window * 1000;

      if (!current) {
        // First request in window
        await redis.set(rateLimitKey, JSON.stringify([now]), {
          expiration: new Date(Date.now() + limits.window * 1000),
        });
        return {
          allowed: true,
          remaining: limits.requests - 1,
          resetTime: now + limits.window * 1000,
        };
      }

      const requests = JSON.parse(current) as number[];
      const validRequests = requests.filter((time) => time > windowStart);

      if (validRequests.length >= limits.requests) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: Math.min(...validRequests) + limits.window * 1000,
        };
      }

      // Add current request
      validRequests.push(now);
      await redis.set(rateLimitKey, JSON.stringify(validRequests), {
        expiration: new Date(Date.now() + limits.window * 1000),
      });

      return {
        allowed: true,
        remaining: limits.requests - validRequests.length,
        resetTime: now + limits.window * 1000,
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Fail open - allow request if rate limiting fails
      return {
        allowed: true,
        remaining: limits.requests,
        resetTime: Date.now() + limits.window * 1000,
      };
    }
  }

  static async isRateLimited(
    key: string,
    limitType: keyof typeof RateLimiter.RATE_LIMITS
  ): Promise<boolean> {
    const result = await this.checkRateLimit(key, limitType);
    return !result.allowed;
  }
}

/**
 * Caching service for frequently accessed data
 */
export class CacheService {
  static async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key);
      if (!cached) return null;

      const { data, expires } = JSON.parse(cached);
      if (Date.now() > expires) {
        await redis.del(key);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Cache get failed:', error);
      return null;
    }
  }

  static async set<T>(key: string, data: T, ttl: number): Promise<boolean> {
    try {
      const expires = Date.now() + ttl * 1000;
      const cached = JSON.stringify({ data, expires });
      await redis.set(key, cached, {
        expiration: new Date(Date.now() + ttl * 1000),
      });
      return true;
    } catch (error) {
      console.error('Cache set failed:', error);
      return false;
    }
  }

  static async invalidate(pattern: string): Promise<void> {
    try {
      // This would need Redis SCAN in a real implementation
      // For now, we'll use a simple approach
      console.log(`Invalidating cache pattern: ${pattern}`);
    } catch (error) {
      console.error('Cache invalidation failed:', error);
    }
  }

  static getCacheKey(type: string, ...params: string[]): string {
    return RedisKeyFactory.globalKey(`cache:${type}:${params.join(':')}`);
  }
}

/**
 * Batch operations for Redis
 */
export class BatchService {
  static async batchGet<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];

    try {
      const values = await redis.mGet(keys);
      return values.map((value) => {
        if (!value) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      });
    } catch (error) {
      console.error('Batch get failed:', error);
      return keys.map(() => null);
    }
  }

  static async batchSet(
    operations: Array<{
      key: string;
      value: string | number | boolean | object;
      ttl?: number;
    }>
  ): Promise<boolean[]> {
    if (operations.length === 0) return [];

    try {
      const results = await Promise.allSettled(
        operations.map(async (op) => {
          const serialized =
            typeof op.value === 'string' ? op.value : JSON.stringify(op.value);
          if (op.ttl) {
            await redis.set(op.key, serialized, {
              expiration: new Date(Date.now() + op.ttl * 1000),
            });
          } else {
            await redis.set(op.key, serialized);
          }
          return true;
        })
      );

      return results.map((result) => result.status === 'fulfilled');
    } catch (error) {
      console.error('Batch set failed:', error);
      return operations.map(() => false);
    }
  }
}

/**
 * Error handling utilities
 */
export class ErrorHandler {
  static handleApiError(
    error: unknown,
    context: string
  ): { message: string; code: string } {
    console.error(`API Error in ${context}:`, error);

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('rate limit')) {
        return {
          message: 'Too many requests. Please try again later.',
          code: 'RATE_LIMITED',
        };
      }

      if (error.message.includes('not found')) {
        return { message: 'Resource not found.', code: 'NOT_FOUND' };
      }

      if (error.message.includes('permission')) {
        return { message: 'Insufficient permissions.', code: 'FORBIDDEN' };
      }

      return {
        message: 'An unexpected error occurred.',
        code: 'INTERNAL_ERROR',
      };
    }

    return { message: 'An unknown error occurred.', code: 'UNKNOWN_ERROR' };
  }

  static isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const retryableMessages = ['timeout', 'network', 'connection', 'redis'];
      return retryableMessages.some((msg) =>
        error.message.toLowerCase().includes(msg)
      );
    }
    return false;
  }

  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries || !this.isRetryableError(error)) {
          throw error;
        }

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, delay * Math.pow(2, attempt))
        );
      }
    }

    throw lastError;
  }
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  private static timers = new Map<string, number>();

  static startTimer(label: string): void {
    this.timers.set(label, Date.now());
  }

  static endTimer(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      console.warn(`Timer ${label} was not started`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(label);

    // Log slow operations
    if (duration > 1000) {
      console.warn(`Slow operation: ${label} took ${duration}ms`);
    }

    return duration;
  }

  static async measureAsync<T>(
    label: string,
    operation: () => Promise<T>
  ): Promise<T> {
    this.startTimer(label);
    try {
      const result = await operation();
      return result;
    } finally {
      this.endTimer(label);
    }
  }
}
