/**
 * Obfuscate string with asterisks, keeping first and last character
 */

export function obfuscateString(input: string): string {
  if (input.length <= 2) return '*'.repeat(input.length);
  return (
    input.charAt(0) +
    '*'.repeat(input.length - 2) +
    input.charAt(input.length - 1)
  );
}

/**
 * Capitalize first letter of each word
 */

export function titleCase(word: string): string {
  return word
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Normalize a word by trimming whitespace and converting to title case
 * @param word - The word to normalize
 * @returns The normalized word
 */

export function normalizeWord(word: string): string {
  return titleCase(word.trim());
}

/**
 * Normalize a word from a command input
 * Strips !add/!remove prefixes, removes invalid characters, and validates length
 * @param input - The raw input string to normalize
 * @returns Object with normalized word or error message
 */
export function normalizeCommandWord(
  input: string
): { word: string } | { error: string } {
  // Strip !add or !remove prefixes (case-insensitive, anywhere in string)
  let normalized = input
    .replace(/!add/gi, '')
    .replace(/!remove/gi, '')
    .trim();

  // Remove all characters except a-z, A-Z, 0-9, hyphens, and spaces
  normalized = normalized.replace(/[^a-zA-Z0-9\s-]/g, '');

  // Normalize multiple consecutive spaces to single space
  normalized = normalized.replace(/\s+/g, ' ');

  // Trim whitespace
  normalized = normalized.trim();

  // Check length
  if (normalized.length > 12) {
    return { error: 'Too long. Max 12 characters.' };
  }

  if (normalized.length === 0) {
    return { error: 'Invalid word.' };
  }

  // Reject words that contain only non-alphanumeric characters
  // (after normalization, this means only hyphens and spaces)
  if (!/[a-zA-Z0-9]/.test(normalized)) {
    return {
      error: 'Invalid word. Must contain at least one letter or number.',
    };
  }

  // Reject words that start or end with hyphens
  if (normalized.startsWith('-') || normalized.endsWith('-')) {
    return { error: 'Invalid word. Cannot start or end with hyphen.' };
  }

  return { word: normalized };
}

/**
 * Sanitize a string to ensure it contains only valid UTF-8 characters
 * Replaces invalid UTF-8 sequences with the replacement character (U+FFFD)
 * @param str - The string to sanitize
 * @returns A valid UTF-8 string
 */
export function sanitizeUtf8(str: string): string {
  try {
    // Convert string to buffer and back, which will replace invalid UTF-8 sequences
    // Buffer.from with 'utf8' encoding handles invalid sequences gracefully
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'utf8').toString('utf8');
    }
    // Fallback for environments without Buffer (shouldn't happen in server)
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const encoded = encoder.encode(str);
    return decoder.decode(encoded);
  } catch {
    // If conversion fails, return empty string as fallback
    return '';
  }
}
