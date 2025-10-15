export { CommandManager } from './manager';
export { CommandHandlers } from './handlers';
export { CommandMonitor } from './monitor';
export { SecurityValidator } from './security';
export type {
  CommandContext,
  CommandResult,
  CommandHandler,
  AlertLevel,
  Alert,
  CommandMetrics,
} from './types';

const COMMAND_LIST = [
  '!add',
  '!remove',
  '!words',
  '!stats',
  '!score',
  '!level',
  '!leaderboard',
  '!help',
  '!featured',
];

export function isCommand(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const command = text.split(' ')[0]?.toLowerCase().trim();
  return command ? COMMAND_LIST.includes(command) : false;
}

/**
 * Initialize the command system
 * This should be called when the server starts
 */
export async function initializeCommandSystem(): Promise<void> {
  try {
    // Import and register all command handlers
    const { CommandHandlers } = await import('./handlers');
    CommandHandlers.registerAllHandlers();
  } catch (error) {
    console.error('❌ Failed to initialize command system:', error);
    throw error;
  }
}

/**
 * Get command system status
 */
export async function getCommandSystemStatus(): Promise<{
  initialized: boolean;
  handlersRegistered: number;
  features: string[];
}> {
  try {
    const { CommandManager } = await import('./manager');
    const handlersRegistered = (
      CommandManager as unknown as { commandHandlers: Map<string, unknown> }
    )['commandHandlers'].size;

    return {
      initialized: true,
      handlersRegistered,
      features: [
        'Rate Limiting',
        'Input Validation',
        'Security Scanning',
        'Abuse Detection',
        'Performance Monitoring',
        'Error Handling',
        'Audit Logging',
        'Moderator Permission Caching',
      ],
    };
  } catch (error) {
    return {
      initialized: false,
      handlersRegistered: 0,
      features: [],
    };
  }
}
