import { describe, test, expect } from 'vitest';
import { CommandMonitor } from './monitor';

describe('CommandMonitor', () => {
  describe('recordCommandExecution', () => {
    test('should record successful command execution', async () => {
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

    test('should record failed command execution', async () => {
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

    test('should track command types', async () => {
      await CommandMonitor.recordCommandExecution({
        command: '!help',
        subredditName: 'testsub',
        success: true,
        responseTime: 100,
      });

      await CommandMonitor.recordCommandExecution({
        command: '!words',
        subredditName: 'testsub',
        success: true,
        responseTime: 150,
      });

      const metrics = await CommandMonitor.getMetrics();
      expect(metrics.commandsByType['!help']).toBeGreaterThan(0);
      expect(metrics.commandsByType['!words']).toBeGreaterThan(0);
    });

    test('should track subreddit metrics', async () => {
      await CommandMonitor.recordCommandExecution({
        command: '!help',
        subredditName: 'subreddit1',
        success: true,
        responseTime: 100,
      });

      await CommandMonitor.recordCommandExecution({
        command: '!help',
        subredditName: 'subreddit2',
        success: true,
        responseTime: 100,
      });

      const metrics = await CommandMonitor.getMetrics();
      expect(metrics.commandsBySubreddit['subreddit1']).toBeGreaterThan(0);
      expect(metrics.commandsBySubreddit['subreddit2']).toBeGreaterThan(0);
    });
  });

  describe('getMetrics', () => {
    test('should return comprehensive metrics', async () => {
      // Record some test data
      await CommandMonitor.recordCommandExecution({
        command: '!help',
        subredditName: 'testsub',
        success: true,
        responseTime: 100,
      });

      await CommandMonitor.recordCommandExecution({
        command: '!unknown',
        subredditName: 'testsub',
        success: false,
        responseTime: 50,
        error: 'Unknown command',
      });

      const metrics = await CommandMonitor.getMetrics();

      expect(metrics).toHaveProperty('totalCommands');
      expect(metrics).toHaveProperty('successfulCommands');
      expect(metrics).toHaveProperty('failedCommands');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('topErrors');
      expect(metrics).toHaveProperty('commandsByType');
      expect(metrics).toHaveProperty('commandsBySubreddit');

      expect(metrics.totalCommands).toBeGreaterThan(0);
      expect(metrics.errorRate).toBeGreaterThan(0);
    });

    test('should handle empty metrics gracefully', async () => {
      const metrics = await CommandMonitor.getMetrics(
        '2020-01-01',
        '2020-01-01'
      );

      expect(metrics.totalCommands).toBe(0);
      expect(metrics.successfulCommands).toBe(0);
      expect(metrics.failedCommands).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.topErrors).toEqual([]);
      expect(metrics.commandsByType).toEqual({});
      expect(metrics.commandsBySubreddit).toEqual({});
    });
  });

  describe('getHealthStatus', () => {
    test('should return health status', async () => {
      const health = await CommandMonitor.getHealthStatus();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('metrics');
      expect(health).toHaveProperty('activeAlerts');
      expect(health).toHaveProperty('issues');

      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(Array.isArray(health.activeAlerts)).toBe(true);
      expect(Array.isArray(health.issues)).toBe(true);
    });

    test('should detect unhealthy status with high error rate', async () => {
      // Record many failed commands to trigger unhealthy status
      for (let i = 0; i < 10; i++) {
        await CommandMonitor.recordCommandExecution({
          command: '!unknown',
          subredditName: 'testsub',
          success: false,
          responseTime: 50,
          error: 'Unknown command',
        });
      }

      const health = await CommandMonitor.getHealthStatus();

      // Should be degraded or unhealthy due to high error rate
      expect(['degraded', 'unhealthy']).toContain(health.status);
    });
  });

  describe('getActiveAlerts', () => {
    test('should return active alerts', async () => {
      const alerts = await CommandMonitor.getActiveAlerts();

      expect(Array.isArray(alerts)).toBe(true);

      // If there are alerts, they should have the correct structure
      alerts.forEach((alert) => {
        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('level');
        expect(alert).toHaveProperty('message');
        expect(alert).toHaveProperty('context');
        expect(alert).toHaveProperty('timestamp');
        expect(alert).toHaveProperty('resolved');
        expect(alert.resolved).toBe(false);
      });
    });
  });

  describe('resolveAlert', () => {
    test('should resolve alerts', async () => {
      // First get active alerts
      const alerts = await CommandMonitor.getActiveAlerts();

      if (alerts.length > 0) {
        const alertId = alerts[0]?.id;
        if (alertId) {
          const result = await CommandMonitor.resolveAlert(alertId);

          expect(result).toBe(true);

          // Check that the alert is no longer active
          const updatedAlerts = await CommandMonitor.getActiveAlerts();
          const resolvedAlert = updatedAlerts.find(
            (alert) => alert.id === alertId
          );
          expect(resolvedAlert).toBeUndefined();
        }
      }
    });
  });
});
