import { redis } from '@devvit/web/server';
import type { AlertLevel, Alert, CommandMetrics } from './types';

/**
 * Monitoring and alerting system for command execution
 */
export class CommandMonitor {
  private static readonly ALERT_THRESHOLDS = {
    errorRate: 0.1, // 10% error rate
    averageResponseTime: 5000, // 5 seconds
    consecutiveFailures: 5,
    commandsPerMinute: 100,
  };

  private static readonly METRICS_RETENTION_DAYS = 30;

  /**
   * Record command execution metrics
   */
  static async recordCommandExecution(data: {
    command: string;
    subredditName: string;
    success: boolean;
    responseTime: number;
    error?: string;
  }): Promise<void> {
    const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
      // Record daily metrics
      const dailyKey = `metrics:daily:${dateKey}`;
      await redis.hIncrBy(dailyKey, 'total_commands', 1);

      if (data.success) {
        await redis.hIncrBy(dailyKey, 'successful_commands', 1);
      } else {
        await redis.hIncrBy(dailyKey, 'failed_commands', 1);
      }

      // Record response time - using sorted set instead of list
      await redis.zAdd(`metrics:response_times:${dateKey}`, {
        member: data.responseTime.toString(),
        score: Date.now(),
      });

      // Keep only last 1000 entries
      const count = await redis.zCard(`metrics:response_times:${dateKey}`);
      if (count > 1000) {
        const toRemove = count - 1000;
        await redis.zRemRangeByRank(
          `metrics:response_times:${dateKey}`,
          0,
          toRemove - 1
        );
      }

      // Record command type metrics
      await redis.hIncrBy(`metrics:commands:${dateKey}`, data.command, 1);

      // Record subreddit metrics
      await redis.hIncrBy(
        `metrics:subreddits:${dateKey}`,
        data.subredditName,
        1
      );

      // Record errors
      if (data.error) {
        await redis.hIncrBy(`metrics:errors:${dateKey}`, data.error, 1);
      }

      // Set expiration for daily metrics
      await redis.expire(dailyKey, this.METRICS_RETENTION_DAYS * 24 * 60 * 60);

      // Check for alerts
      await this.checkAlerts(data);
    } catch (error) {
      console.error('Failed to record command metrics:', error);
    }
  }

  /**
   * Get command metrics for a specific date range
   */
  static async getMetrics(
    startDate?: string,
    endDate?: string
  ): Promise<CommandMetrics> {
    const start = startDate || new Date().toISOString().split('T')[0];
    const end = endDate || start;

    try {
      const dates = this.getDateRange(start, end);
      let totalCommands = 0;
      let successfulCommands = 0;
      let failedCommands = 0;
      let totalResponseTime = 0;
      let responseTimeCount = 0;
      const commandsByType: Record<string, number> = {};
      const commandsBySubreddit: Record<string, number> = {};
      const errorCounts: Record<string, number> = {};

      // Aggregate metrics across date range
      for (const date of dates) {
        const dailyKey = `metrics:daily:${date}`;
        const dailyMetrics = await redis.hGetAll(dailyKey);

        totalCommands += parseInt(dailyMetrics.total_commands || '0');
        successfulCommands += parseInt(dailyMetrics.successful_commands || '0');
        failedCommands += parseInt(dailyMetrics.failed_commands || '0');

        // Get response times
        const responseTimes = await redis.zRange(
          `metrics:response_times:${date}`,
          0,
          -1
        );
        responseTimes.forEach((item: { member: string; score: number }) => {
          totalResponseTime += parseInt(item.member);
          responseTimeCount++;
        });

        // Get command type metrics
        const commandMetrics = await redis.hGetAll(`metrics:commands:${date}`);
        Object.entries(commandMetrics).forEach(([command, count]) => {
          commandsByType[command] =
            (commandsByType[command] || 0) + parseInt(count as string);
        });

        // Get subreddit metrics
        const subredditMetrics = await redis.hGetAll(
          `metrics:subreddits:${date}`
        );
        Object.entries(subredditMetrics).forEach(([subreddit, count]) => {
          commandsBySubreddit[subreddit] =
            (commandsBySubreddit[subreddit] || 0) + parseInt(count as string);
        });

        // Get error metrics
        const errorMetrics = await redis.hGetAll(`metrics:errors:${date}`);
        Object.entries(errorMetrics).forEach(([error, count]) => {
          errorCounts[error] =
            (errorCounts[error] || 0) + parseInt(count as string);
        });
      }

      const averageResponseTime =
        responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;
      const errorRate = totalCommands > 0 ? failedCommands / totalCommands : 0;

      const topErrors = Object.entries(errorCounts)
        .map(([error, count]) => ({ error, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalCommands,
        successfulCommands,
        failedCommands,
        averageResponseTime,
        errorRate,
        topErrors,
        commandsByType,
        commandsBySubreddit,
      };
    } catch (error) {
      console.error('Failed to get metrics:', error);
      return {
        totalCommands: 0,
        successfulCommands: 0,
        failedCommands: 0,
        averageResponseTime: 0,
        errorRate: 0,
        topErrors: [],
        commandsByType: {},
        commandsBySubreddit: {},
      };
    }
  }

  /**
   * Check for alert conditions
   */
  private static async checkAlerts(data: {
    command: string;
    subredditName: string;
    success: boolean;
    responseTime: number;
    error?: string;
  }): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const metrics = await this.getMetrics(today, today);

      // Check error rate
      if (metrics.errorRate > this.ALERT_THRESHOLDS.errorRate) {
        await this.createAlert('warning', 'High error rate detected', {
          errorRate: metrics.errorRate,
          threshold: this.ALERT_THRESHOLDS.errorRate,
          totalCommands: metrics.totalCommands,
          failedCommands: metrics.failedCommands,
        });
      }

      // Check average response time
      if (
        metrics.averageResponseTime > this.ALERT_THRESHOLDS.averageResponseTime
      ) {
        await this.createAlert('warning', 'Slow command response times', {
          averageResponseTime: metrics.averageResponseTime,
          threshold: this.ALERT_THRESHOLDS.averageResponseTime,
        });
      }

      // Check for consecutive failures
      const failureKey = `consecutive_failures:${data.subredditName}`;
      if (data.success) {
        await redis.del(failureKey);
      } else {
        const current = await redis.get(failureKey);
        const failures = current ? parseInt(current) + 1 : 1;
        await redis.set(failureKey, failures.toString());
        await redis.expire(failureKey, 300); // 5 minutes

        if (failures >= this.ALERT_THRESHOLDS.consecutiveFailures) {
          await this.createAlert('error', 'Consecutive command failures', {
            subreddit: data.subredditName,
            consecutiveFailures: failures,
            lastError: data.error,
          });
        }
      }

      // Check command volume
      const minuteKey = `commands_per_minute:${Math.floor(Date.now() / 60000)}`;
      const current = await redis.get(minuteKey);
      const minuteCount = current ? parseInt(current) + 1 : 1;
      await redis.set(minuteKey, minuteCount.toString());
      await redis.expire(minuteKey, 60); // 1 minute

      if (minuteCount > this.ALERT_THRESHOLDS.commandsPerMinute) {
        await this.createAlert('warning', 'High command volume detected', {
          commandsPerMinute: minuteCount,
          threshold: this.ALERT_THRESHOLDS.commandsPerMinute,
        });
      }
    } catch (error) {
      console.error('Alert check failed:', error);
    }
  }

  /**
   * Create an alert
   */
  private static async createAlert(
    level: AlertLevel,
    message: string,
    context: Record<string, unknown>
  ): Promise<void> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      message,
      context,
      timestamp: Date.now(),
      resolved: false,
    };

    try {
      // Store alert using sorted set
      await redis.zAdd('alerts', {
        member: JSON.stringify(alert),
        score: alert.timestamp,
      });

      // Keep only last 1000 alerts
      const count = await redis.zCard('alerts');
      if (count > 1000) {
        const toRemove = count - 1000;
        await redis.zRemRangeByRank('alerts', 0, toRemove - 1);
      }

      // Log alert
      console.log(`🚨 ALERT [${level.toUpperCase()}]: ${message}`, context);

      // For critical alerts, could trigger additional notifications
      if (level === 'critical') {
        // TODO: Send to external monitoring service (e.g., PagerDuty, Slack)
        console.error('CRITICAL ALERT:', alert);
      }
    } catch (error) {
      console.error('Failed to create alert:', error);
    }
  }

  /**
   * Get active alerts
   */
  static async getActiveAlerts(): Promise<Alert[]> {
    try {
      const alerts = await redis.zRange('alerts', 0, -1);
      return alerts
        .map((item: { member: string; score: number }) =>
          JSON.parse(item.member)
        )
        .filter((alert: Alert) => !alert.resolved)
        .sort((a: Alert, b: Alert) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Failed to get alerts:', error);
      return [];
    }
  }

  /**
   * Resolve an alert
   */
  static async resolveAlert(alertId: string): Promise<boolean> {
    try {
      const alerts = await redis.zRange('alerts', 0, -1);
      const updatedAlerts = alerts.map(
        (item: { member: string; score: number }) => {
          const alert = JSON.parse(item.member);
          if (alert.id === alertId) {
            alert.resolved = true;
          }
          return JSON.stringify(alert);
        }
      );

      // Remove all alerts and re-add updated ones
      await redis.del('alerts');
      for (const alertStr of updatedAlerts) {
        const alert = JSON.parse(alertStr);
        await redis.zAdd('alerts', {
          member: alertStr,
          score: alert.timestamp,
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      return false;
    }
  }

  /**
   * Get date range between two dates
   */
  private static getDateRange(startDate?: string, endDate?: string): string[] {
    const dates: string[] = [];
    const startDateStr = (startDate ||
      new Date().toISOString().split('T')[0]) as string;
    const endDateStr = (endDate || startDateStr) as string;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0] || '');
    }

    return dates;
  }

  /**
   * Get health status of the command system
   */
  static async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: CommandMetrics;
    activeAlerts: Alert[];
    issues: string[];
  }> {
    const metrics = await this.getMetrics();
    const activeAlerts = await this.getActiveAlerts();
    const issues: string[] = [];

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check error rate
    if (metrics.errorRate > 0.2) {
      status = 'unhealthy';
      issues.push(`High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`);
    } else if (metrics.errorRate > 0.1) {
      status = 'degraded';
      issues.push(
        `Elevated error rate: ${(metrics.errorRate * 100).toFixed(1)}%`
      );
    }

    // Check response time
    if (metrics.averageResponseTime > 10000) {
      status = 'unhealthy';
      issues.push(
        `Slow response time: ${metrics.averageResponseTime.toFixed(0)}ms`
      );
    } else if (metrics.averageResponseTime > 5000) {
      status = 'degraded';
      issues.push(
        `Elevated response time: ${metrics.averageResponseTime.toFixed(0)}ms`
      );
    }

    // Check active alerts
    const criticalAlerts = activeAlerts.filter(
      (alert) => alert.level === 'critical'
    );
    const errorAlerts = activeAlerts.filter((alert) => alert.level === 'error');

    if (criticalAlerts.length > 0) {
      status = 'unhealthy';
      issues.push(`${criticalAlerts.length} critical alerts active`);
    } else if (errorAlerts.length > 0) {
      status = 'degraded';
      issues.push(`${errorAlerts.length} error alerts active`);
    }

    return {
      status,
      metrics,
      activeAlerts,
      issues,
    };
  }
}
