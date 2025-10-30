import type { T1, T3 } from '@devvit/shared-types/tid.js';
import { reddit } from '@devvit/web/server';
import { getTournament } from './post';
import { REDIS_KEYS } from '../redis';
import { redis } from '@devvit/web/server';

export async function generateTournamentCommentText(
  word: string
): Promise<string> {
  return `Draw the word **"${word}"** in this tournament!

## How to Play

**Submit your drawing**: Click the "Draw Something" button to create your 16x16 pixel art submission for the word "${word}".

**Vote on pairs**: Help rank the submissions by voting between two drawings. Choose which one you think best represents the word "${word}".

**Watch the leaderboard**: The tournament uses an Elo rating system. Top drawings rise to the top as more people vote.

**View all submissions**: Check out the gallery to see everyone's creative interpretations of "${word}".

Good luck and let the best drawing win! 🎨`;
}

export async function saveTournamentPinnedCommentId(
  postId: T3,
  commentId: T1
): Promise<void> {
  const key = REDIS_KEYS.tournament(postId);
  await redis.hSet(key, {
    pinnedCommentId: commentId,
  });
}

export async function getTournamentPinnedCommentId(
  postId: T3
): Promise<T1 | null> {
  const key = REDIS_KEYS.tournament(postId);
  const commentId = await redis.hGet(key, 'pinnedCommentId');
  return commentId as T1 | null;
}

export async function createTournamentPostComment(postId: T3): Promise<T1> {
  const data = await getTournament(postId);
  const commentText = await generateTournamentCommentText(data.word);

  const comment = await reddit.submitComment({
    text: commentText,
    id: postId,
  });

  await comment.distinguish(true);
  await saveTournamentPinnedCommentId(postId, comment.id);

  return comment.id;
}
