import type { T1, T3 } from '@devvit/shared-types/tid.js';
import { shuffle } from '../../../shared/utils/array';
import type { TournamentDrawing } from './post';
import { getTournamentEntries, getTournamentEntry } from './post';

/**
 * Get a random pair of submissions for voting
 * @param postId - The tournament post ID
 * @returns Array of two random submission comment IDs
 */
export async function getRandomPair(postId: T3): Promise<[T1, T1]> {
  const submissions = await getTournamentEntries(postId);

  if (submissions.length < 2) {
    throw new Error('Not enough submissions for voting');
  }

  // Select two random submissions
  const shuffled = [...submissions].sort(() => Math.random() - 0.5);
  const first = shuffled[0];
  const second = shuffled[1];

  if (!first || !second) {
    throw new Error('Failed to select random submissions');
  }

  return [first, second];
}

/**
 * Get N pairs of drawing submissions with full drawing data
 * @param postId - The tournament post ID
 * @param count - Number of pairs to return
 * @returns Array of pairs as tuples `[left, right]`
 */
export async function getDrawingPairs(
  postId: T3,
  count: number = 5
): Promise<[TournamentDrawing, TournamentDrawing][]> {
  const submissions = await getTournamentEntries(postId);

  if (submissions.length < 2) {
    throw new Error('Not enough submissions for voting');
  }

  // Generate pairs by walking a shuffled list to ensure fairness and avoid repeats
  const pairIds: [T1, T1][] = [];
  let pool = shuffle(submissions);
  let idx = 0;
  while (pairIds.length < count) {
    // If we are at the end or have fewer than two remaining, reshuffle a fresh pool
    if (idx + 1 >= pool.length) {
      pool = shuffle(submissions);
      idx = 0;
    }

    const a = pool[idx];
    const b = pool[idx + 1];
    idx += 2;

    if (!a || !b || a === b) {
      continue;
    }

    const lastPair = pairIds[pairIds.length - 1];
    // Avoid identical consecutive pairs and position bias
    if (lastPair && lastPair[0] === a && lastPair[1] === b) {
      // Swap order to mitigate position bias
      pairIds.push([b, a]);
    } else if (lastPair && (lastPair[0] === a || lastPair[1] === b)) {
      // Skip and let next iteration reshuffle as needed
      continue;
    } else {
      pairIds.push([a, b]);
    }
  }

  // Fetch all unique drawings in parallel
  const uniqueIds = [...new Set(pairIds.flat())];
  const fetchedData = await Promise.all(
    uniqueIds.map((id) => getTournamentEntry(id))
  );

  const dataMap = new Map<T1, Awaited<ReturnType<typeof getTournamentEntry>>>();
  uniqueIds.forEach((id, i) => {
    const data = fetchedData[i];
    if (id && data) dataMap.set(id, data);
  });

  // Assemble pairs with data
  const pairs: Array<[TournamentDrawing, TournamentDrawing]> = [];
  for (const [firstId, secondId] of pairIds) {
    const leftData = dataMap.get(firstId);
    const rightData = dataMap.get(secondId);
    if (!leftData || !rightData) continue;
    pairs.push([
      { ...leftData, commentId: firstId },
      { ...rightData, commentId: secondId },
    ]);
  }

  return pairs;
}
