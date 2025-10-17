/**
 * Abbreviate large numbers (1k, 1M, etc)
 */

export function abbreviateNumber(value: number): string {
  if (value < 1000) return value.toString();
  if (value < 1000000) return `${Math.floor(value / 1000)}k`;
  if (value < 1000000000) return `${Math.floor(value / 1000000)}M`;
  return `${Math.floor(value / 1000000)}B`;
}
