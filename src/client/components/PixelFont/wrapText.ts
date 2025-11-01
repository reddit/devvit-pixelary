import { getStringWidth } from './glyphs';

export function wrapTextByWidth(
  text: string,
  maxBaseWidth: number,
  gap: number = 1,
  getStringWidthImpl: (t: string, g?: number) => number = defaultGetStringWidth
): string[] {
  if (!text) return [];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  const fits = (candidate: string) =>
    getStringWidthImpl(candidate, gap) <= maxBaseWidth;

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (fits(next)) {
      current = next;
      continue;
    }
    if (!current) {
      let part = '';
      for (const ch of word) {
        const tryPart = part + ch;
        if (fits(tryPart)) part = tryPart;
        else {
          if (part) lines.push(part);
          part = ch;
        }
      }
      if (part) current = part;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function defaultGetStringWidth(text: string, gap: number = 1): number {
  return getStringWidth(text, gap);
}

// Alias removed; use wrapTextByWidth
