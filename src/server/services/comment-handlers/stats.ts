import type { CommandResult } from '../comment-commands';
import { getWords } from '../dictionary';
import { getWordMetrics } from '../slate';

export async function handleStats(args: string[]): Promise<CommandResult> {
  try {
    if (args.length === 0) {
      return {
        success: true,
        response: 'Provide a word. Usage: `!stats <word>`',
      };
    }

    const word = args[0]?.trim();
    if (!word) {
      return {
        success: false,
        error: 'Invalid word.',
      };
    }

    // First check if the word exists in the dictionary
    const words = await getWords();
    const wordExists = words.some(
      (w) => w.toLowerCase() === word.toLowerCase()
    );

    if (!wordExists) {
      return {
        success: false,
        error: `Word not found. See \`!words\`.`,
      };
    }

    // Get word metrics
    const metrics = await getWordMetrics(word);

    // Format metrics concisely
    const response = `**Word details**
Word selection:
Impressions: ${metrics.impressions}
Picks: ${metrics.clicks}
Pick rate: ${(metrics.clickRate * 100).toFixed(1)}%

Drawing:
Starts: ${metrics.starts}
Publishes: ${metrics.publishes}
Publish rate: ${(metrics.publishRate * 100).toFixed(1)}%

Guessing:
Attempts: ${metrics.guesses}
Solves: ${metrics.solves}
Solve rate: ${(metrics.solveRate * 100).toFixed(1)}%
Skips: ${metrics.skips}
Skip rate: ${(metrics.skipRate * 100).toFixed(1)}%

Reddit engagement:
Upvotes: ${metrics.upvotes}
Comments: ${metrics.comments}
`;

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
