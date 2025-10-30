import type { T1, T3 } from '@devvit/shared-types/tid.js';
import { shuffle } from '../../../shared/utils/array';
import type { TournamentDrawing } from './post';
import { getTournamentEntries, getTournamentEntry } from './post';

export async function getRandomPair(postId: T3): Promise<[T1, T1]> {
  const submissions = await getTournamentEntries(postId);
  if (submissions.length < 2)
    throw new Error('Not enough submissions for voting');
  const shuffled = [...submissions].sort(() => Math.random() - 0.5);
  const first = shuffled[0];
  const second = shuffled[1];
  if (!first || !second) throw new Error('Failed to select random submissions');
  return [first, second];
}

export async function getDrawingPairs(
  postId: T3,
  count: number = 5
): Promise<[TournamentDrawing, TournamentDrawing][]> {
  const submissions = await getTournamentEntries(postId);
  if (submissions.length < 2)
    throw new Error('Not enough submissions for voting');
  const pairIds: [T1, T1][] = [];
  let pool = shuffle(submissions);
  let idx = 0;
  while (pairIds.length < count) {
    if (idx + 1 >= pool.length) {
      pool = shuffle(submissions);
      idx = 0;
    }
    const a = pool[idx];
    const b = pool[idx + 1];
    idx += 2;
    if (!a || !b || a === b) continue;
    const lastPair = pairIds[pairIds.length - 1];
    if (lastPair && lastPair[0] === a && lastPair[1] === b) {
      pairIds.push([b, a]);
    } else if (lastPair && (lastPair[0] === a || lastPair[1] === b)) {
      continue;
    } else {
      pairIds.push([a, b]);
    }
  }
  const uniqueIds = [...new Set(pairIds.flat())];
  const fetchedData = await Promise.all(
    uniqueIds.map((id) => getTournamentEntry(id))
  );
  const dataMap = new Map<T1, Awaited<ReturnType<typeof getTournamentEntry>>>();
  uniqueIds.forEach((id, i) => {
    const data = fetchedData[i];
    if (id && data) dataMap.set(id, data);
  });
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
