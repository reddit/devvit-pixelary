import type { CommandContext, CommandResult } from '../comment-commands';
import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from '../redis';
import { titleCase } from '../../../shared/utils/string';
import { getAllWords } from '../dictionary';
import { setChampion } from '../champion';
import { isWordBanned } from '../dictionary';

export async function handleShow(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  try {
    if (args.length === 0) {
      return {
        success: false,
        error: 'Provide a word. Usage: `!show <word>`',
      };
    }

    const word = args[0]?.trim();
    if (!word) {
      return {
        success: false,
        error: 'Invalid word.',
      };
    }

    // Normalize the word using titleCase for consistent comparison
    const normalizedWord = titleCase(word);

    // Extract postId from context
    if (!context.postId) {
      return {
        success: false,
        error: 'Unable to determine post context.',
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
    const dictionaryWords = await getAllWords();
    const isInDictionary = dictionaryWords.some(
      (dictWord) => dictWord.toLowerCase() === normalizedWord.toLowerCase()
    );

    // Check if word is banned
    const isBanned = await isWordBanned(normalizedWord);

    // Store this comment as champion comment for this word
    await setChampion(normalizedWord, context.commentId);

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
      error: 'Failed to retrieve word statistics.',
    };
  }
}

/**
 * Get word metrics for a specific word
 * @param word - The word to get metrics for
 * @returns Word metrics with calculated rates
 */

/*
export async function getWordMetrics(word: string): Promise<{
  slateImpressions: number;
  slatePicks: number;
  slatePicksManual: number;
  slatePicksAuto: number;
  slatePickRate: number;
  slatePickRateManual: number;
  slatePickRateAuto: number;
  drawingStarts: number;
  drawingFirstPixel: number;
  drawingDone: number;
  drawingDoneManual: number;
  drawingDoneAuto: number;
  drawingDoneRate: number;
  drawingDoneManualRate: number;
  drawingDoneAutoRate: number;
  drawingCancels: number;
  drawingCancelRate: number;
  drawingPublishes: number;
  drawingPublishRate: number;
  postImpressions: number;
  postGuesses: number;
  postSolves: number;
  postSkips: number;
  postUpvotes: number;
  postComments: number;
}> {
  console.log('Getting word metrics for:', word);

  const base = {
    slateImpressions: 0,
    slatePicks: 0,
    slatePicksManual: 0,
    slatePicksAuto: 0,
    slatePickRate: 0,
    slatePickRateManual: 0,
    slatePickRateAuto: 0,
    drawingStarts: 0,
    drawingFirstPixel: 0,
    drawingDone: 0,
    drawingDoneManual: 0,
    drawingDoneAuto: 0,
    drawingDoneRate: 0,
    drawingDoneManualRate: 0,
    drawingDoneAutoRate: 0,
    drawingCancels: 0,
    drawingCancelRate: 0,
    drawingPublishes: 0,
    drawingPublishRate: 0,
    postImpressions: 0,
    postGuesses: 0,
    postSolves: 0,
    postSkips: 0,
    postUpvotes: 0,
    postComments: 0,
  };
  try {
    // Normalize the word to match how it's stored in Redis
    const normalizedWord = normalizeWord(word);
    const metricsKey = REDIS_KEYS.wordMetrics(normalizedWord);
    const metrics = await redis.hGetAll(metricsKey);
    console.log('Raw word metrics:', metrics);

    // Parse the metrics into the base object
    const parsed = { ...base };
    Object.entries(metrics).forEach(([key, value]) => {
      if (key in parsed) {
        parsed[key as keyof typeof parsed] = parseInt(value || '0', 10);
      }
    });

    // Calculate derived fields
    parsed.slatePicksManual = parsed.slatePicks - parsed.slatePicksAuto;
    parsed.drawingDone = parsed.drawingDoneManual + parsed.drawingDoneAuto;

    // Calculate rates
    parsed.slatePickRate =
      parsed.slateImpressions > 0
        ? parsed.slatePicks / parsed.slateImpressions
        : 0;

    parsed.slatePickRateManual =
      parsed.slateImpressions > 0
        ? parsed.slatePicksManual / parsed.slateImpressions
        : 0;

    parsed.slatePickRateAuto =
      parsed.slateImpressions > 0
        ? parsed.slatePicksAuto / parsed.slateImpressions
        : 0;

    parsed.drawingDoneRate =
      parsed.drawingStarts > 0 ? parsed.drawingDone / parsed.drawingStarts : 0;

    parsed.drawingDoneManualRate =
      parsed.drawingStarts > 0
        ? parsed.drawingDoneManual / parsed.drawingStarts
        : 0;

    parsed.drawingDoneAutoRate =
      parsed.drawingStarts > 0
        ? parsed.drawingDoneAuto / parsed.drawingStarts
        : 0;

    parsed.drawingCancelRate =
      parsed.drawingStarts > 0
        ? parsed.drawingCancels / parsed.drawingStarts
        : 0;

    parsed.drawingPublishRate =
      parsed.slateImpressions > 0
        ? parsed.drawingPublishes / parsed.slateImpressions
        : 0;

    console.log('Parsed word metrics:', parsed);
    return parsed;
  } catch (error) {
    console.warn('Failed to get word metrics:', error);
    return { ...base };
  }
}
*/
