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
