import type { CommandContext, CommandResult } from './comment-commands';
import { getWords, addWord, removeWord, getBannedWords } from './dictionary';
import { getLeaderboard } from './progression';

/**
 * Simple command handlers as plain functions
 */

export async function handleWords(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  try {
    const words = await getWords(context.subredditId);
    const wordCount = words.length;
    const pageSize = 200;

    // If 200 words or less, show all words without pagination
    if (wordCount <= pageSize) {
      const wordList = words.join(', ');
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
    const page = parseInt(args[0] || '1', 10) || 1;
    if (page < 1 || page > 1000) {
      return {
        success: false,
        error: 'Invalid page number (1-1000)',
      };
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageWords = words.slice(startIndex, endIndex);

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

export async function handleAdd(
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

    const word = args[0]?.trim();
    if (!word || word.length > 50) {
      return {
        success: false,
        error: 'Invalid word (max 50 characters)',
      };
    }

    // Check if word is banned before attempting to add
    const bannedWords = await getBannedWords(context.subredditId);
    const isBanned = bannedWords.some(
      (w) => w.toLowerCase() === word.toLowerCase()
    );
    if (isBanned) {
      return {
        success: false,
        error: '❌ This word cannot be added to the dictionary.',
      };
    }

    const success = await addWord(context.subredditId, word);

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

export async function handleRemove(
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

    const word = args[0]?.trim();
    if (!word) {
      return {
        success: false,
        error: 'Invalid word',
      };
    }

    const success = await removeWord(context.subredditId, word);

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

export async function handleStats(
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

    const word = args[0]?.trim();
    if (!word) {
      return {
        success: false,
        error: 'Invalid word',
      };
    }

    // First check if the word exists in the dictionary
    const words = await getWords(context.subredditId);
    const wordExists = words.some(
      (w) => w.toLowerCase() === word.toLowerCase()
    );

    if (!wordExists) {
      return {
        success: false,
        error: `"${word}" is not in the dictionary. Use \`!words\` to see available words.`,
      };
    }

    const response =
      `📊 **Statistics for "${word}"**\n\n` +
      `Status: Active\n` +
      `Word exists in dictionary`;

    return {
      success: true,
      response,
      metadata: { word, isBanned: false },
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to retrieve word statistics',
    };
  }
}

export async function handleScore(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const targetUser =
    args.length > 0 ? args[0]?.trim() || '' : context.authorName;

  return {
    success: true,
    response: `Score tracking is not yet implemented. This would show u/${targetUser}'s points.`,
  };
}

export async function handleLevel(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const targetUser =
    args.length > 0 ? args[0]?.trim() || '' : context.authorName;

  return {
    success: true,
    response: `Level tracking is not yet implemented. This would show u/${targetUser}'s level.`,
  };
}

export async function handleLeaderboard(
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

    const leaderboardResult = await getLeaderboard({ limit });

    if (leaderboardResult.entries.length === 0) {
      return {
        success: true,
        response: 'No players found on the leaderboard.',
        metadata: { limit, playerCount: 0 },
      };
    }

    const leaderboardText = leaderboardResult.entries
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
      metadata: { limit, playerCount: leaderboardResult.entries.length },
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to retrieve leaderboard',
    };
  }
}

export async function handleHelp(
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
