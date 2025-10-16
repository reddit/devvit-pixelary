import { CommandManager } from './manager';
import { SecurityValidator } from './security';
import type { CommandContext, CommandResult } from './types';
import {
  getDictionary,
  addWordToDictionary,
  removeWordFromDictionary,
  getWordMetadata,
  getBannedWords,
} from '../dictionary';
import { getLeaderboard } from '../progression';
import { getUserProfile } from '../user';

/**
 * Command handler implementations for the new command system
 */
export class CommandHandlers {
  /**
   * Register all command handlers
   */
  static registerAllHandlers(): void {
    CommandManager.registerCommand('!words', this.handleWords);
    CommandManager.registerCommand('!add', this.handleAdd);
    CommandManager.registerCommand('!remove', this.handleRemove);
    CommandManager.registerCommand('!stats', this.handleStats);
    CommandManager.registerCommand('!score', this.handleScore);
    CommandManager.registerCommand('!level', this.handleLevel);
    CommandManager.registerCommand('!leaderboard', this.handleLeaderboard);
    CommandManager.registerCommand('!help', this.handleHelp);
  }

  /**
   * Handle !words command with smart pagination
   */
  private static async handleWords(
    args: string[],
    context: CommandContext
  ): Promise<CommandResult> {
    try {
      const dictionary = await getDictionary(context.subredditName);
      if (!dictionary) {
        return {
          success: false,
          error: 'No dictionary found for this subreddit.',
        };
      }

      const wordCount = dictionary.words.length;
      const pageSize = 200;

      // If 200 words or less, show all words without pagination
      if (wordCount <= pageSize) {
        const wordList = dictionary.words.join(', ');
        const response =
          `📚 **Dictionary for r/${context.subredditName}**\n\n` +
          `Words: ${wordList}\n\n` +
          `Total words: ${wordCount}`;

        return {
          success: true,
          response,
          metadata: { wordCount, totalPages: 1 },
        };
      }

      // For more than 200 words, use pagination
      const pageValidation = SecurityValidator.validatePageNumber(
        args[0] || '1'
      );
      if (!pageValidation.valid) {
        return {
          success: false,
          error: pageValidation.error || 'Invalid page number',
        };
      }

      const page = pageValidation.page!;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const pageWords = dictionary.words.slice(startIndex, endIndex);

      const totalPages = Math.ceil(wordCount / pageSize);
      const wordList = pageWords.join(', ');

      const response =
        `📚 **Dictionary for r/${context.subredditName}** (Page ${page}/${totalPages})\n\n` +
        `Words: ${wordList}\n\n` +
        `Total words: ${wordCount}\n` +
        `Use \`!words ${page + 1}\` for next page`;

      return {
        success: true,
        response,
        metadata: { page, totalPages, wordCount },
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve dictionary',
      };
    }
  }

  /**
   * Handle !add command
   */
  private static async handleAdd(
    args: string[],
    context: CommandContext
  ): Promise<CommandResult> {
    try {
      if (args.length === 0) {
        return {
          success: false,
          error: 'Please provide a word to add. Usage: `!add <word>`',
        };
      }

      // Validate word input
      const wordValidation = SecurityValidator.validateWord(args[0] || '');
      if (!wordValidation.valid) {
        return {
          success: false,
          error: wordValidation.error || 'Invalid word',
        };
      }

      const word = wordValidation.sanitized!;

      // Check for abuse
      const abuseCheck = await SecurityValidator.checkForAbuse(
        context.authorName,
        context.subredditName,
        '!add'
      );
      if (abuseCheck.isAbuse) {
        return {
          success: false,
          error: `Abuse detected: ${abuseCheck.reason}`,
        };
      }

      // Check if word is banned before attempting to add
      const bannedWords = await getBannedWords(context.subredditName);
      const isBanned = bannedWords.some(
        (w) => w.toLowerCase() === word.toLowerCase()
      );
      if (isBanned) {
        return {
          success: false,
          error: '❌ This word cannot be added to the dictionary.',
        };
      }

      const success = await addWordToDictionary(
        context.subredditName,
        word,
        context.authorName,
        context.commentId
      );

      if (success) {
        return {
          success: true,
          response: `✅ Added "${word}" to the dictionary! Note: If this comment is removed, the word will be automatically removed and denylisted.`,
          metadata: { word, addedBy: context.authorName },
        };
      } else {
        return {
          success: false,
          error: `❌ Failed to add "${word}". It may already exist in the dictionary.`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: 'Failed to add word to dictionary',
      };
    }
  }

  /**
   * Handle !remove command
   */
  private static async handleRemove(
    args: string[],
    context: CommandContext
  ): Promise<CommandResult> {
    try {
      if (args.length === 0) {
        return {
          success: false,
          error: 'Please provide a word to remove. Usage: `!remove <word>`',
        };
      }

      // Validate word input
      const wordValidation = SecurityValidator.validateWord(args[0] || '');
      if (!wordValidation.valid) {
        return {
          success: false,
          error: wordValidation.error || 'Invalid word',
        };
      }

      const word = wordValidation.sanitized!;
      const success = await removeWordFromDictionary(
        context.subredditName,
        word
      );

      if (success) {
        return {
          success: true,
          response: `✅ Removed "${word}" from the dictionary!`,
          metadata: { word, removedBy: context.authorName },
        };
      } else {
        return {
          success: false,
          error: `❌ Failed to remove "${word}". It may not exist in the dictionary.`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: 'Failed to remove word from dictionary',
      };
    }
  }

  /**
   * Handle !stats command
   */
  private static async handleStats(
    args: string[],
    context: CommandContext
  ): Promise<CommandResult> {
    try {
      if (args.length === 0) {
        return {
          success: true,
          response: 'Please provide a word. Usage: `!stats <word>`',
        };
      }

      // Validate word input
      const wordValidation = SecurityValidator.validateWord(args[0] || '');
      if (!wordValidation.valid) {
        return {
          success: false,
          error: wordValidation.error || 'Invalid word',
        };
      }

      const word = wordValidation.sanitized!;

      // First check if the word exists in the dictionary
      const dictionary = await getDictionary(context.subredditName);
      if (!dictionary) {
        return {
          success: false,
          error: 'No dictionary found for this subreddit.',
        };
      }

      const wordExists = dictionary.words.some(
        (w) => w.toLowerCase() === word.toLowerCase()
      );

      if (!wordExists) {
        return {
          success: false,
          error: `"${word}" is not in the dictionary. Use \`!words\` to see available words.`,
        };
      }

      const metadata = await getWordMetadata(context.subredditName, word);

      if (!metadata) {
        // Word exists but has no metadata (likely added during initialization)
        const response =
          `📊 **Statistics for "${word}"**\n\n` +
          `Added by: System\n` +
          `Reports: 0\n` +
          `Status: Active`;

        return {
          success: true,
          response,
          metadata: { word, reportCount: 0, isBanned: false },
        };
      }

      const reportCount = metadata.reports.length;
      const response =
        `📊 **Statistics for "${word}"**\n\n` +
        `Added by: u/${metadata.addedBy}\n` +
        `Added on: ${new Date(metadata.addedAt).toLocaleDateString()}\n` +
        `Reports: ${reportCount}\n` +
        `Status: Active`;

      return {
        success: true,
        response,
        metadata: { word, reportCount, isBanned: false },
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve word statistics',
      };
    }
  }

  /**
   * Handle !score command
   */
  private static async handleScore(
    args: string[],
    _context: CommandContext
  ): Promise<CommandResult> {
    try {
      const targetUser =
        args.length > 0 ? args[0]?.trim() || '' : _context.authorName;

      // Validate username
      if (
        !SecurityValidator.validateCommandInput(
          '!score',
          [targetUser],
          _context
        ).valid
      ) {
        return {
          success: false,
          error: 'Invalid username',
        };
      }

      const userProfile = await getUserProfile(targetUser);
      if (!userProfile) {
        return {
          success: false,
          error: `User u/${targetUser} not found.`,
        };
      }

      const response = `u/${targetUser} has ${userProfile.score.toLocaleString()} points!`;

      return {
        success: true,
        response,
        metadata: { username: targetUser, score: userProfile.score },
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve user score',
      };
    }
  }

  /**
   * Handle !level command
   */
  private static async handleLevel(
    args: string[],
    _context: CommandContext
  ): Promise<CommandResult> {
    try {
      const targetUser =
        args.length > 0 ? args[0]?.trim() || '' : _context.authorName;

      // Validate username
      if (
        !SecurityValidator.validateCommandInput(
          '!level',
          [targetUser],
          _context
        ).valid
      ) {
        return {
          success: false,
          error: 'Invalid username',
        };
      }

      const userProfile = await getUserProfile(targetUser);
      if (!userProfile) {
        return {
          success: false,
          error: `User u/${targetUser} not found.`,
        };
      }

      const response = `u/${targetUser} is level ${userProfile.level} with ${userProfile.score.toLocaleString()} points!`;

      return {
        success: true,
        response,
        metadata: {
          username: targetUser,
          level: userProfile.level,
          score: userProfile.score,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve user level',
      };
    }
  }

  /**
   * Handle !leaderboard command
   */
  private static async handleLeaderboard(
    args: string[],
    _context: CommandContext
  ): Promise<CommandResult> {
    try {
      const limit = args.length > 0 ? parseInt(args[0] || '10') || 10 : 10;

      if (limit < 1 || limit > 50) {
        return {
          success: false,
          error: 'Limit must be between 1 and 50',
        };
      }

      const leaderboard = await getLeaderboard(limit);

      if (leaderboard.length === 0) {
        return {
          success: true,
          response: 'No players found on the leaderboard.',
          metadata: { limit, playerCount: 0 },
        };
      }

      const leaderboardText = leaderboard
        .map((player, index) => {
          const medal =
            index === 0
              ? '🥇'
              : index === 1
                ? '🥈'
                : index === 2
                  ? '🥉'
                  : `${index + 1}.`;
          return `${medal} u/${player.username} - ${player.score.toLocaleString()} points`;
        })
        .join('\n');

      const response = `🏆 **Top ${limit} Players**\n\n` + leaderboardText;

      return {
        success: true,
        response,
        metadata: { limit, playerCount: leaderboard.length },
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve leaderboard',
      };
    }
  }

  /**
   * Handle !help command
   */
  private static async handleHelp(
    _args: string[],
    _context: CommandContext
  ): Promise<CommandResult> {
    const response =
      `🎨 **Pixelary Commands**\n\n` +
      `**Public Commands:**\n` +
      `• \`!words [page]\` - Show dictionary (paginated if >200 words)\n` +
      `• \`!add <word>\` - Add word to dictionary\n` +
      `• \`!stats <word>\` - Show word statistics\n` +
      `• \`!score [username]\` - Show user score\n` +
      `• \`!level [username]\` - Show user level\n` +
      `• \`!leaderboard [limit]\` - Show top players\n` +
      `• \`!help\` - Show this help\n\n` +
      `**Moderator Commands:**\n` +
      `• \`!remove <word>\` - Remove word from dictionary\n` +
      `**Accountability:**\n` +
      `All word additions are tracked. If a comment containing \`!add\` is removed, the word is automatically removed and banned.\n\n` +
      `**How to Play:**\n` +
      `1. Draw the given word in 16x16 pixels\n` +
      `2. Others guess what you drew\n` +
      `3. Earn points for correct guesses!\n\n` +
      `Good luck! 🎨`;

    return {
      success: true,
      response,
    };
  }
}
