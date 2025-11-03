import type { CommandContext, CommandResult } from '../comment-commands';
import { isWordInList } from '@server/services/words/dictionary';
import { addBacker } from '@server/services/words/word-backing';
import { redis, context } from '@devvit/web/server';
import { REDIS_KEYS } from '@server/core/redis';
import type { WordMetrics } from '@shared/types';
import type { T3 } from '@devvit/shared-types/tid.js';
import { normalizeWord } from '@shared/utils/string';

export async function handleStats(
  args: string[],
  commandContext: CommandContext
): Promise<CommandResult> {
  try {
    if (args.length === 0) {
      return {
        success: true,
        response: 'Provide a word. Usage: `!stats <word>`',
      };
    }

    const word = args[0]?.trim();
    if (!word) {
      return { success: false, error: 'Invalid word.' };
    }

    const wordExists = await isWordInList(word);
    if (!wordExists) {
      return { success: false, error: `Word not found. See \`!words\`.` };
    }

    await addBacker(word, commandContext.commentId);

    const metrics = await getWordMetrics(word);

    const response = `##### 🎨 Drawer stats
- Shown: ${metrics.impressions}
- Picked: ${metrics.clicks} (${(metrics.clickRate * 100).toFixed(1)}%)
- Started: ${metrics.starts}
- Published: ${metrics.publishes} (${(metrics.publishRate * 100).toFixed(1)}%)
- Guesses: ${metrics.guesses}
- Skips: ${metrics.skips} (${(metrics.skipRate * 100).toFixed(1)}%)
- Solves: ${metrics.solves} (${(metrics.solveRate * 100).toFixed(1)}%)

##### 📈 Social stats
- Upvotes: ${metrics.upvotes}
- Comments: ${metrics.comments}`;

    return { success: true, response, metadata: { word, isBanned: false } };
  } catch (error) {
    return { success: false, error: 'Failed to retrieve word statistics' };
  }
}

export async function getWordMetrics(word: string): Promise<WordMetrics> {
  try {
    const normalizedWord = normalizeWord(word);

    const totalStats = await redis.hGetAll(
      REDIS_KEYS.wordsTotalStats(context.subredditName)
    );

    const impressions = parseInt(
      totalStats[`${normalizedWord}:served`] ?? '0',
      10
    );
    const clicks = parseInt(totalStats[`${normalizedWord}:picked`] ?? '0', 10);
    const publishes = parseInt(
      totalStats[`${normalizedWord}:posted`] ?? '0',
      10
    );

    const wordDrawings = await redis.zRange(
      REDIS_KEYS.wordDrawings(normalizedWord),
      0,
      -1
    );

    let starts = 0;
    let guesses = 0;
    let skips = 0;
    let solves = 0;
    const upvotes = 0;
    const comments = 0;

    for (const drawing of wordDrawings) {
      const postId = drawing.member as T3;
      const [attempts, solvesCount, skipsCount, guessesCount] =
        await Promise.all([
          redis.zCard(REDIS_KEYS.drawingAttempts(postId)),
          redis.zCard(REDIS_KEYS.drawingSolves(postId)),
          redis.zCard(REDIS_KEYS.drawingSkips(postId)),
          redis.zCard(REDIS_KEYS.drawingGuesses(postId)),
        ]);

      starts += attempts;
      solves += solvesCount;
      skips += skipsCount;
      guesses += guessesCount;
    }

    const clickRate = impressions > 0 ? clicks / impressions : 0;
    const publishRate = impressions > 0 ? publishes / impressions : 0;
    const skipRate = starts > 0 ? skips / starts : 0;
    const solveRate = starts > 0 ? solves / starts : 0;

    return {
      impressions,
      clicks,
      clickRate,
      publishes,
      publishRate,
      starts,
      guesses,
      skips,
      solves,
      skipRate,
      solveRate,
      upvotes,
      comments,
    };
  } catch (error) {
    return {
      impressions: 0,
      clicks: 0,
      clickRate: 0,
      publishes: 0,
      publishRate: 0,
      starts: 0,
      guesses: 0,
      skips: 0,
      solves: 0,
      skipRate: 0,
      solveRate: 0,
      upvotes: 0,
      comments: 0,
    };
  }
}
