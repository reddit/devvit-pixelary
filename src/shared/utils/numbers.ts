/**
 * Abbreviate large numbers (1k, 1M, etc)
 */

export function abbreviateNumber(value: number): string {
  if (value < 1000) return value.toString();
  if (value < 1000000) {
    const k = Math.floor(value / 100) / 10;
    return k % 1 === 0 ? `${k}k` : `${k}k`;
  }
  if (value < 1000000000) {
    const m = Math.floor(value / 100000) / 10;
    return m % 1 === 0 ? `${m}M` : `${m}M`;
  }
  if (value < 1000000000000) {
    const b = Math.floor(value / 100000000) / 10;
    return b % 1 === 0 ? `${b}B` : `${b}B`;
  }
  const t = Math.floor(value / 100000000000) / 10;
  return t % 1 === 0 ? `${t}T` : `${t}T`;
}

/**
 * Clamp a value between a minimum and maximum
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * Format seconds to a short single-unit label like "10h", "9m", or "5s".
 */
export function formatSecondsShort(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${secs}s`;
}

/**
 * Format seconds to a compact two-unit label like "3h 12m" or "9m 20s".
 */
export function formatSecondsTwoUnits(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}
