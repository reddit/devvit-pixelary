import type { T1, T3 } from '@devvit/shared-types/tid.js';
import { reddit } from '@devvit/web/server';
import { getTournament } from './post';
import { REDIS_KEYS } from '../redis';
import { redis } from '@devvit/web/server';
import { createPinnedComment } from '../comments/pinned';

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

// Pinned comment storage is handled by services/comments/pinned

export async function createTournamentPostComment(postId: T3): Promise<T1> {
  const data = await getTournament(postId);
  const commentText = await generateTournamentCommentText(data.word);
  return await createPinnedComment(postId, commentText);
}
