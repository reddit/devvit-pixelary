/**
 * Safely parse an integer, defaulting to defaultValue if invalid
 */
export function safeParseInt(
  value: string | undefined,
  defaultValue: number = 0
): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || !isFinite(parsed)) return defaultValue;
  return Math.max(0, parsed); // Ensure non-negative for stats
}

/**
 * Safely parse a float, clamping to valid range if provided
 */
export function safeParseFloat(
  value: string | undefined,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  if (isNaN(parsed) || !isFinite(parsed)) return defaultValue;
  let result = parsed;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

/**
 * Check if a number is finite (not NaN or Infinity)
 */
export function isFiniteNumber(value: number): boolean {
  return isFinite(value) && !isNaN(value);
}
