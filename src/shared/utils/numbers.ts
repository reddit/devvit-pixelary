/**
 * Abbreviate large numbers (1k, 1M, etc)
 */

export function abbreviateNumber(value: number): string {
  if (value < 1000) return value.toString();
  if (value < 1000000) {
    const k = value / 1000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
  }
  if (value < 1000000000) {
    const m = value / 1000000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (value < 1000000000000) {
    const b = value / 1000000000;
    return b % 1 === 0 ? `${b}B` : `${b.toFixed(1)}B`;
  }
  const t = value / 1000000000000;
  return t % 1 === 0 ? `${t}T` : `${t.toFixed(1)}T`;
}

/**
 * Clamp a value between a minimum and maximum
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
