/**
 * Abbreviate large numbers (1k, 1M, etc)
 */

export function abbreviateNumber(value: number): string {
  if (value < 1000) return value.toString();
  if (value < 1000000) return `${Math.floor(value / 1000)}k`;
  if (value < 1000000000) return `${Math.floor(value / 1000000)}M`;
  return `${Math.floor(value / 1000000)}B`;
}

/**
 * Clamp a value between a minimum and maximum
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
