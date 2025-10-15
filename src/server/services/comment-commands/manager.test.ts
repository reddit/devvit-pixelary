import { describe, test, expect, beforeAll } from 'vitest';
import { CommandManager } from './manager';
import { CommandHandlers } from './handlers';
import { SecurityValidator } from './security';
import { CommandMonitor } from './monitor';

/**
 * Critical path tests for command system
 */
describe('Command System', () => {
  beforeAll(async () => {
    // Initialize the command system
    CommandHandlers.registerAllHandlers();
  });

  describe('CommandManager', () => {
    test('should process valid commands successfully', async () => {
      const context = {
        commentId: 'test123',
        authorName: 'testuser',
        subredditName: 'testsub',
        timestamp: Date.now(),
        source: 'test' as const,
      };

      const result = await CommandManager.processCommand('!help', [], context);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Pixelary Commands');
    });

    test('should reject unknown commands', async () => {
      const context = {
        commentId: 'test123',
        authorName: 'testuser',
        subredditName: 'testsub',
        timestamp: Date.now(),
        source: 'test' as const,
      };

      const result = await CommandManager.processCommand(
        '!unknown',
        [],
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown command');
    });

    test('should handle rate limiting', async () => {
      const context = {
        commentId: 'test123',
        authorName: 'testuser',
        subredditName: 'testsub',
        timestamp: Date.now(),
        source: 'test' as const,
      };

      // Make multiple rapid requests
      const promises = Array(5)
        .fill(null)
        .map(() => CommandManager.processCommand('!help', [], context));

      const results = await Promise.all(promises);

      // At least one should be rate limited
      const rateLimited = results.some((r) =>
        r.error?.includes('Rate limited')
      );
      expect(rateLimited).toBe(true);
    });

    test('should validate input parameters', async () => {
      const context = {
        commentId: 'test123',
        authorName: 'testuser',
        subredditName: 'testsub',
        timestamp: Date.now(),
        source: 'test' as const,
      };

      const result = await CommandManager.processCommand('!add', [], context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Please provide a word');
    });

    test('should handle timeout', async () => {
      const context = {
        commentId: 'test123',
        authorName: 'testuser',
        subredditName: 'testsub',
        timestamp: Date.now(),
        source: 'test' as const,
      };

      // Register a slow command handler
      CommandManager.registerCommand('!slow', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return { success: true, response: 'Done' };
      });

      const result = await CommandManager.processCommand('!slow', [], context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('SecurityValidator', () => {
    test('should validate word input', () => {
      const valid = SecurityValidator.validateWord('hello');
      expect(valid.valid).toBe(true);
      expect(valid.sanitized).toBe('hello');
    });

    test('should reject invalid word input', () => {
      const invalid = SecurityValidator.validateWord(
        '<script>alert("xss")</script>'
      );
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toContain('invalid characters');
    });

    test('should validate page numbers', () => {
      const valid = SecurityValidator.validatePageNumber('5');
      expect(valid.valid).toBe(true);
      expect(valid.page).toBe(5);
    });

    test('should reject invalid page numbers', () => {
      const invalid = SecurityValidator.validatePageNumber('abc');
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toContain('Invalid page number');
    });

    test('should detect command input validation', () => {
      const context = {
        commentId: 'test123',
        authorName: 'testuser',
        subredditName: 'testsub',
        timestamp: Date.now(),
        source: 'test' as const,
      };

      const valid = SecurityValidator.validateCommandInput(
        '!add',
        ['hello'],
        context
      );
      expect(valid.valid).toBe(true);
      expect(valid.sanitizedArgs).toEqual(['hello']);
    });

    test('should reject malicious command input', () => {
      const context = {
        commentId: 'test123',
        authorName: 'testuser',
        subredditName: 'testsub',
        timestamp: Date.now(),
        source: 'test' as const,
      };

      const invalid = SecurityValidator.validateCommandInput(
        '!add',
        ['<script>alert("xss")</script>'],
        context
      );
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toContain('Invalid characters');
    });
  });

  describe('CommandMonitor', () => {
    test('should record command execution metrics', async () => {
      await CommandMonitor.recordCommandExecution({
        command: '!help',
        subredditName: 'testsub',
        success: true,
        responseTime: 100,
      });

      const metrics = await CommandMonitor.getMetrics();
      expect(metrics.totalCommands).toBeGreaterThan(0);
      expect(metrics.successfulCommands).toBeGreaterThan(0);
    });

    test('should track error rates', async () => {
      await CommandMonitor.recordCommandExecution({
        command: '!unknown',
        subredditName: 'testsub',
        success: false,
        responseTime: 50,
        error: 'Unknown command',
      });

      const metrics = await CommandMonitor.getMetrics();
      expect(metrics.failedCommands).toBeGreaterThan(0);
      expect(metrics.errorRate).toBeGreaterThan(0);
    });

    test('should provide health status', async () => {
      const health = await CommandMonitor.getHealthStatus();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('metrics');
      expect(health).toHaveProperty('activeAlerts');
      expect(health).toHaveProperty('issues');

      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    });
  });

  describe('Integration Tests', () => {
    test('should handle end-to-end command processing', async () => {
      const context = {
        commentId: 'integration123',
        authorName: 'integrationuser',
        subredditName: 'integrationsub',
        timestamp: Date.now(),
        source: 'test' as const,
      };

      // Test multiple commands
      const commands = ['!help', '!list', '!words'];

      for (const command of commands) {
        const result = await CommandManager.processCommand(
          command,
          [],
          context
        );

        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('response');

        // Record metrics
        const metricsData: Parameters<
          typeof CommandMonitor.recordCommandExecution
        >[0] = {
          command,
          subredditName: context.subredditName,
          success: result.success,
          responseTime: 100,
        };
        if (result.error) {
          metricsData.error = result.error;
        }
        await CommandMonitor.recordCommandExecution(metricsData);
      }

      // Verify metrics were recorded
      const metrics = await CommandMonitor.getMetrics();
      expect(metrics.totalCommands).toBeGreaterThanOrEqual(commands.length);
    });

    test('should handle concurrent command processing', async () => {
      const context = {
        commentId: 'concurrent123',
        authorName: 'concurrentuser',
        subredditName: 'concurrentsub',
        timestamp: Date.now(),
        source: 'test' as const,
      };

      // Process multiple commands concurrently
      const promises = Array(10)
        .fill(null)
        .map((_, i) =>
          CommandManager.processCommand('!help', [], {
            ...context,
            commentId: `concurrent${i}`,
          })
        );

      const results = await Promise.all(promises);

      // All should succeed or be rate limited
      results.forEach((result) => {
        expect(result.success || result.error?.includes('Rate limited')).toBe(
          true
        );
      });
    });
  });
});
