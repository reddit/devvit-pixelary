/**
 * Split array into chunks of specified length
 */

/**
 * Shuffle array using Fisher-Yates algorithm
 */

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

/**
 * Binary search to find element by comparison function
 */
export function binFind<T>(
  list: readonly T[],
  compareFunction: (element: T) => number
): T | undefined {
  let left = 0;
  let right = list.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const comparison = compareFunction(list[mid]!);

    if (comparison === 0) {
      return list[mid];
    } else if (comparison < 0) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return list[right];
}
