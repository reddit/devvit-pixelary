export type CommandContext = {
  commentId: string;
  authorName: string;
  subredditName: string;
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

export type AlertLevel = 'info' | 'warning' | 'error' | 'critical';

export type Alert = {
  id: string;
  level: AlertLevel;
  message: string;
  context: Record<string, unknown>;
  timestamp: number;
  resolved: boolean;
};

export type CommandMetrics = {
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  averageResponseTime: number;
  errorRate: number;
  topErrors: Array<{ error: string; count: number }>;
  commandsByType: Record<string, number>;
  commandsBySubreddit: Record<string, number>;
};
