import { reddit } from '@devvit/web/server';
import { getUserProfile } from '../services/user';
import { getLevelByScore } from '../services/leaderboard';
import {
  getDrawingPost,
  savePinnedCommentId,
  saveLastCommentUpdate,
} from '../services/drawing-post';
import { getGuessStats } from '../services/guess';
import type { Level } from '../../shared/schema/pixelary';

/**
 * Job handler for first solve comment
 * Posts a congratulatory comment when someone solves a drawing first
 */
export async function firstSolveComment(jobData: {
  postId: string;
  solverUsername: string;
  word: string;
  authorUsername: string;
}) {
  try {
    const { postId, solverUsername, word, authorUsername } = jobData;

    // Validate required parameters
    if (!postId) {
      console.error(
        'FirstSolveComment job failed: postId is undefined or empty'
      );
      console.error('Job data received:', JSON.stringify(jobData, null, 2));
      return;
    }

    if (!solverUsername) {
      console.error(
        'FirstSolveComment job failed: solverUsername is undefined or empty'
      );
      console.error('Job data received:', JSON.stringify(jobData, null, 2));
      return;
    }

    if (!word) {
      console.error('FirstSolveComment job failed: word is undefined or empty');
      console.error('Job data received:', JSON.stringify(jobData, null, 2));
      return;
    }

    if (!authorUsername) {
      console.error(
        'FirstSolveComment job failed: authorUsername is undefined or empty'
      );
      console.error('Job data received:', JSON.stringify(jobData, null, 2));
      return;
    }

    // Create congratulatory comment
    const commentText =
      `🎉 **First solve!** Great job u/${solverUsername}! The word was "${word}".\n\n` +
      `u/${authorUsername} earned 1 point for the correct guess!`;

    const comment = await reddit.submitComment({
      text: commentText,
      id: postId as `t3_${string}`,
    });

    // Distinguish the comment as a bot
    await comment.distinguish(true);

    console.log(
      `First solve comment posted for post ${postId} by ${solverUsername}`
    );
  } catch (error) {
    console.error('Error posting first solve comment:', error);
  }
}

/**
 * Job handler for user level up notifications
 * Assigns user flair when they level up
 */
export async function userLeveledUp(jobData: {
  username: string;
  score: number;
  prevLevel: Level;
  newLevel: Level;
}) {
  try {
    const { username, score, newLevel } = jobData;

    // Validate required parameters
    if (!username) {
      console.error('UserLeveledUp job failed: username is undefined or empty');
      console.error('Job data received:', JSON.stringify(jobData, null, 2));
      return;
    }

    if (typeof score !== 'number' || score < 0) {
      console.error(
        `UserLeveledUp job failed: invalid score ${score} for user ${username}`
      );
      return;
    }

    // Get user profile to verify level up
    const userProfile = await getUserProfile(username);
    if (!userProfile) {
      console.error(`User profile not found for ${username}`);
      return;
    }

    // Double-check the level calculation
    const currentLevel = getLevelByScore(score);
    if (currentLevel.rank !== newLevel.rank) {
      console.error(
        `Level mismatch for ${username}: expected ${newLevel.rank}, got ${currentLevel.rank}`
      );
      return;
    }

    // Update user flair with new level
    try {
      // Note: updateUserFlair is not available in the current Reddit API
      // This would need to be implemented differently or removed
      console.log(
        `User ${username} leveled up to ${newLevel.name} (Level ${newLevel.rank}) - flair update not implemented`
      );
    } catch (flairError) {
      console.error(`Failed to update flair for ${username}:`, flairError);
    }

    // Optional: Send a DM to the user about their level up
    try {
      const dmText =
        `🎉 Congratulations! You've leveled up to **${newLevel.name}** (Level ${newLevel.rank})!\n\n` +
        `You now have ${newLevel.extraTime} extra seconds when drawing!\n\n` +
        `Keep drawing and guessing to reach the next level!`;

      // Note: sendPrivateMessage API may not be available or may have different signature
      console.log(`Level up DM would be sent to ${username}: ${dmText}`);
    } catch (dmError) {
      console.error(`Failed to send level up DM to ${username}:`, dmError);
    }
  } catch (error) {
    console.error('Error handling user level up:', error);
  }
}

/**
 * Job handler for updating drawing pinned comment with live stats
 * Updates comment with comprehensive stats and guess distribution
 */
export async function updateDrawingPinnedComment(jobData: { postId: string }) {
  try {
    const { postId } = jobData;

    // Validate postId
    if (!postId) {
      console.error(
        'PostId is undefined or empty in updateDrawingPinnedComment job'
      );
      return;
    }

    console.log(`Updating drawing pinned comment for postId: ${postId}`);

    // Get post data and stats
    const postData = await getDrawingPost(postId);
    if (!postData) {
      console.error(`Post data not found for ${postId}`);
      return;
    }

    const stats = await getGuessStats(postId);

    // Format comment with spoiler-wrapped guesses
    const commentText = formatDrawingStatsComment(
      {
        ...stats,
        playerCount: stats.playerCount ?? 0,
      },
      postData
    );

    // Update or create comment
    if (postData.pinnedCommentId) {
      // Get the existing comment and edit it with new content
      console.log(
        `Editing existing comment ${postData.pinnedCommentId} with updated stats`
      );

      try {
        const comment = await reddit.getCommentById(
          postData.pinnedCommentId as `t1_${string}`
        );
        await comment.edit({ text: commentText });
        console.log(`Successfully edited comment ${postData.pinnedCommentId}`);
      } catch (error) {
        console.error(
          `Failed to edit comment ${postData.pinnedCommentId}:`,
          error
        );
        // Fallback: create new comment if edit fails
        console.log('Creating new comment as fallback');
        const comment = await reddit.submitComment({
          text: commentText,
          id: postId as `t3_${string}`,
        });
        await comment.distinguish(true);
        await savePinnedCommentId(postId, comment.id);
      }
    } else {
      const comment = await reddit.submitComment({
        text: commentText,
        id: postId as `t3_${string}`,
      });
      await comment.distinguish(true);
      await savePinnedCommentId(postId, comment.id);
    }

    // Update timestamp
    await saveLastCommentUpdate(postId, Date.now());

    console.log(`Updated drawing pinned comment for post ${postId}`);
  } catch (error) {
    console.error('Error updating drawing pinned comment:', error);
  }
}

function formatDrawingStatsComment(
  stats: {
    solves: number;
    skips: number;
    playerCount: number;
    guessCount: number;
    wordCount: number;
    topGuesses: Array<{ word: string; count: number }>;
  },
  _postData: unknown
) {
  const solveRate =
    stats.playerCount > 0
      ? ((stats.solves / stats.playerCount) * 100).toFixed(1)
      : '0.0';
  const avgGuessesPerPlayer =
    stats.playerCount > 0
      ? (stats.guessCount / stats.playerCount).toFixed(1)
      : '0.0';
  const skipRate =
    stats.playerCount > 0
      ? ((stats.skips / stats.playerCount) * 100).toFixed(1)
      : '0.0';

  // Calculate difficulty metrics
  const difficultyScore =
    stats.playerCount > 0
      ? Math.round((stats.guessCount / stats.playerCount) * 10) / 10
      : 0;
  const difficultyLevel =
    difficultyScore < 2
      ? '🟢 Easy'
      : difficultyScore < 4
        ? '🟡 Medium'
        : difficultyScore < 6
          ? '🟠 Hard'
          : '🔴 Expert';

  return `📊 **Live Drawing Analytics**

**🎯 Performance Metrics:**
• **${stats.solves}** solves (${solveRate}% success rate)
• **${stats.skips}** skips (${skipRate}% skip rate)  
• **${stats.playerCount}** total players
• **${stats.guessCount}** total guesses (avg ${avgGuessesPerPlayer} per player)
• **${stats.wordCount}** unique words attempted

**📈 Difficulty Analysis:**
${difficultyLevel} (${difficultyScore}/10 difficulty score)

**🎲 Top ${stats.topGuesses.length} Guess Distribution:**
${formatGuessList(stats.topGuesses, stats.guessCount)}

^(⬆️ Complete guess breakdown above)`;
}

function formatGuessList(
  guesses: Array<{ word: string; count: number }>,
  totalGuesses: number
) {
  if (guesses.length === 0) {
    return 'No guesses yet! Be the first to guess! 🎯';
  }

  return guesses
    .map((g, i) => {
      const barLength = Math.ceil((g.count / (guesses[0]?.count || 1)) * 15);
      const bar = '█'.repeat(barLength) + '░'.repeat(15 - barLength);
      const rank = String(i + 1).padStart(2, ' ');
      const word = g.word.padEnd(18);
      const count = `${g.count}×`.padStart(4);
      const percentage =
        `${((g.count / totalGuesses) * 100).toFixed(1)}%`.padStart(6);

      return `${rank}. ${word} ${bar} ${count} (${percentage})`;
    })
    .join('\n');
}

/**
 * Job handler for new drawing pinned comment
 * Creates a pinned welcome comment on new drawing posts
 */
export async function newDrawingPinnedComment(jobData: {
  postId: string;
  authorUsername: string;
  word: string;
}) {
  try {
    const { postId, authorUsername, word } = jobData;

    // Validate required parameters
    if (!postId) {
      console.error(
        'PostId is undefined or empty in newDrawingPinnedComment job'
      );
      return;
    }
    if (!authorUsername) {
      console.error(
        'AuthorUsername is undefined or empty in newDrawingPinnedComment job'
      );
      return;
    }
    if (!word) {
      console.error(
        'Word is undefined or empty in newDrawingPinnedComment job'
      );
      return;
    }

    console.log(
      `Creating new drawing pinned comment for postId: ${postId}, author: ${authorUsername}, word: ${word}`
    );

    // Create engaging welcome comment
    const commentText = `🎨 **Guess the Word!**

**How to Play:**
• Submit your guess in the game area above
• Earn **1 point** for each correct guess
• **First solve** gets **10 bonus points**! 🏆
• Author earns **1 point** per correct guess

**💬 Comment Commands:**
• \`!add <word>\` - Add word to dictionary
• \`!remove <word>\` - Remove word from dictionary
• \`!words\` - Browse dictionary
• \`!report <word>\` - Report inappropriate word
• \`!help\` - Show all commands

**Current Stats:** *Live updates coming soon...*

Good luck, players! 🎯`;

    // Validate commentText
    if (!commentText) {
      console.error('Comment text is undefined in newDrawingPinnedComment');
      return;
    }

    const comment = await reddit.submitComment({
      text: commentText,
      id: postId as `t3_${string}`,
    });

    // Pin the comment and save ID
    await comment.distinguish(true);
    await savePinnedCommentId(postId, comment.id);
    await saveLastCommentUpdate(postId, Date.now());

    console.log(`Pinned welcome comment posted for post ${postId}`);
  } catch (error) {
    console.error('Error posting pinned welcome comment:', error);
  }
}

/**
 * Job handler for creating pinned post comment
 * Creates a contextual comment for pinned posts
 */
export async function createPinnedPostComment(jobData: { postId: string }) {
  try {
    const { postId } = jobData;

    // Validate postId
    if (!postId) {
      console.error(
        'PostId is undefined or empty in createPinnedPostComment job'
      );
      return;
    }

    console.log(`Creating pinned post comment for postId: ${postId}`);

    // Create engaging pinned post comment
    const commentText = `🎮 **Welcome to Pixelary!**

**How to Play:**
• Draw words in 16x16 pixel grids
• Guess what others have drawn
• Earn points and climb the leaderboard!

**Quick Start:**
• Check out recent drawing posts below
• Submit your guesses to earn points
• Create your own drawings to challenge others

**🏆 Check the leaderboard** to see top players!

Ready to play? Start guessing! 🎯`;

    // Validate commentText
    if (!commentText) {
      console.error('Comment text is undefined in createPinnedPostComment');
      return;
    }

    const comment = await reddit.submitComment({
      text: commentText,
      id: postId as `t3_${string}`,
    });

    // Pin the comment and save ID
    await comment.distinguish(true);
    await savePinnedCommentId(postId, comment.id);

    console.log(`Pinned post comment created for post ${postId}`);
  } catch (error) {
    console.error('Error creating pinned post comment:', error);
  }
}

/**
 * Job handler for weekly collection creation
 * Creates a weekly leaderboard post with top drawings
 */
export async function createWeeklyCollection(jobData: {
  subredditName: string;
  timeframe: 'week' | 'month' | 'all';
  limit: number;
}) {
  try {
    const { subredditName, timeframe, limit } = jobData;

    // This would integrate with the collection service
    // For now, just log the job
    console.log(
      `Creating weekly collection for ${subredditName} (${timeframe}, ${limit} drawings)`
    );

    // The actual collection creation would be handled by the collection service
    // which has access to Reddit API and can create posts
  } catch (error) {
    console.error('Error creating weekly collection:', error);
  }
}

/**
 * Job handler for cleanup tasks
 * Runs periodic maintenance tasks
 */
export async function cleanupTasks() {
  try {
    console.log('Running cleanup tasks...');

    // Example cleanup tasks:
    // - Remove expired cache entries
    // - Clean up old analytics data
    // - Archive old collections
    // - Update leaderboard rankings

    console.log('Cleanup tasks completed');
  } catch (error) {
    console.error('Error running cleanup tasks:', error);
  }
}
