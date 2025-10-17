import type { CommandContext, CommandResult } from './comment-commands';
import { getWords, addWord, removeWord, getBannedWords } from './dictionary';
import { setChampionComment, isWordBanned } from './champion-comments';
import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from './redis';
import { titleCase } from '../../shared/utils/string';

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

export async function handleWord(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  try {
    if (args.length === 0) {
      return {
        success: true,
        response: 'Please provide a word. Usage: `!word <word>`',
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

export async function handleShow(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  try {
    if (args.length === 0) {
      return {
        success: false,
        error: 'Please provide a word to show. Usage: `!show <word>`',
      };
    }

    const word = args[0]?.trim();
    if (!word) {
      return {
        success: false,
        error: 'Invalid word',
      };
    }

    // Normalize the word using titleCase for consistent comparison
    const normalizedWord = titleCase(word);

    // Extract postId from context
    if (!context.postId) {
      return {
        success: false,
        error: 'Unable to determine post context',
      };
    }

    // Get guess statistics for this word on this post
    const guessCount = await redis.zScore(
      REDIS_KEYS.drawingGuesses(context.postId),
      normalizedWord
    );
    const count = guessCount || 0;

    // Get total guesses to calculate percentage
    const allGuesses = await redis.zRange(
      REDIS_KEYS.drawingGuesses(context.postId),
      0,
      -1,
      { reverse: true, by: 'rank' }
    );
    const totalGuesses = allGuesses.reduce(
      (sum, guess) => sum + guess.score,
      0
    );
    const percentage =
      totalGuesses > 0 ? Math.round((count / totalGuesses) * 100) : 0;

    // Check if word is in dictionary
    const dictionaryWords = await getWords(context.subredditName);
    const isInDictionary = dictionaryWords.some(
      (dictWord) => dictWord.toLowerCase() === normalizedWord.toLowerCase()
    );

    // Check if word is banned
    const isBanned = await isWordBanned(context.subredditName, normalizedWord);

    // Store this comment as champion comment for this word
    await setChampionComment(context.postId, normalizedWord, context.commentId);

    // Build response
    let response = `Guess made ${count} times (${percentage}%) so far.`;

    if (isInDictionary) {
      response += ` In dictionary.`;
    } else {
      if (isBanned) {
        response += ` Banned from dictionary.`;
      } else {
        response += ` Not in dictionary.`;
      }
    }

    return {
      success: true,
      response,
      metadata: {
        word: normalizedWord,
        count,
        percentage,
        isInDictionary,
        isBanned,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to retrieve word statistics',
    };
  }
}

export async function handleHelp(
  _args: string[],
  _context: CommandContext
): Promise<CommandResult> {
  const response =
    `Beep boop. I can help you with the following commands:\n\n` +
    `• \`!words\` - Show dictionary\n` +
    `  \`!words\` or \`!words 2\` - Show page 1 or specific page\n\n` +
    `• \`!add\` - Add word to dictionary\n` +
    `  \`!add dog\` - Add "dog" to dictionary\n\n` +
    `• \`!remove\` - Remove word from dictionary\n` +
    `  \`!remove cat\` - Remove "cat" from dictionary\n\n` +
    `• \`!word\` - Show word statistics\n` +
    `  \`!word meatloaf\` - Show statistics for "meatloaf"\n\n` +
    `• \`!show\` - Show guess statistics for a word\n` +
    `  \`!show meatloaf\` - Shows stats for "meatloaf" on this post\n\n` +
    `• \`!score\` - Show user score\n` +
    `  \`!score\` or \`!score username\` - Show your score or another user's\n\n` +
    `• \`!help\` - Show this help\n\n` +
    `**Accountability:**\n` +
    `Users add words publicly via comments. Others can remove them. Words removed by Reddit's safety systems cannot be added back.`;

  return {
    success: true,
    response,
  };
}
