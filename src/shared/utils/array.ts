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
    const tempI = result[i] as T;
    const tempJ = result[j] as T;
    result[i] = tempJ;
    result[j] = tempI;
  }
  return result;
}
