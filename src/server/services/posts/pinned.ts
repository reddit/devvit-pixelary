import { scheduler, reddit } from '@devvit/web/server';
import { REDIS_KEYS } from '../../core/redis';
import { createPost } from '../../../core/post';
import { getLeaderboard } from '../../progression';
import type { T1, T3 } from '@devvit/shared-types/tid.js';
import {
  createPinnedComment,
  updatePinnedComment,
} from '../../comments/pinned';

export async function createPinnedPost(title: string): Promise<T3> {
  try {
    const post = await createPost(title, { type: 'pinned' });
    await post.sticky(1);
    try {
      await scheduler.runJob({
        name: 'CREATE_PINNED_POST_COMMENT',
        data: { postId: post.id },
        runAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to schedule pinned comment creation:', error);
    }
    return post.id;
  } catch (error) {
    console.error('Error in createPinnedPost:', error);
    throw error;
  }
}

export async function generatePinnedPostCommentText(): Promise<string> {
  try {
    const leaderboard = await getLeaderboard({ limit: 5 });
    let leaderboardText = '';
    if (leaderboard.entries.length > 0) {
      leaderboardText = '\n\n**🏆 Top Players:**\n';
      leaderboard.entries.forEach((player, index) => {
        const medal =
          index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
        leaderboardText += `${medal} **${player.username}** - ${player.score} points\n`;
      });
    }
    return `Pixelary is a community drawing and guessing game.

Players draw words in 16x16 pixel grids. Other players guess what others have drawn.

Earn points and climb the leaderboard!${leaderboardText}

May the best artist win!`;
  } catch (error) {
    return `Pixelary is a community drawing and guessing game.

Players draw words in 16x16 pixel grids. Other players guess what others have drawn.

Earn points and climb the leaderboard!

May the best artist win!`;
  }
}

export async function createPinnedPostComment(postId: T3): Promise<T1> {
  const commentText = await generatePinnedPostCommentText();
  return await createPinnedComment(postId, commentText);
}

export async function updatePinnedPostComment(postId: T3): Promise<void> {
  const commentText = await generatePinnedPostCommentText();
  await updatePinnedComment(postId, commentText);
}

export async function getPinnedPostCommentId(postId: T3): Promise<T1 | null> {
  // Use shared comments store for pinned posts
  const { getPinnedCommentId } = await import('../comments/pinned');
  const id = await getPinnedCommentId(postId);
  return id;
}
