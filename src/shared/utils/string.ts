/**
 * Obfuscate string with asterisks, keeping first and last character
 */
export function obfuscateString(input: string): string {
  if (input.length <= 2) return '*'.repeat(input.length);
  return input[0] + '*'.repeat(input.length - 2) + input[input.length - 1];
}

/**
 * Capitalize first letter of each word
 */
export function capitalize(word: string): string {
  return word
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
