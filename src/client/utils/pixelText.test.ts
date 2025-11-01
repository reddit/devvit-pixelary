import { describe, it, expect } from 'vitest';
import { chunkByPixelWidth } from './pixelText';

// Simple width impl: each char = 6, space = 6, gap ignored for simplicity
const mockWidth = (t: string) => t.length * 6;

describe('chunkByPixelWidth', () => {
  it('returns empty array for empty text', () => {
    expect(chunkByPixelWidth('', 60, 1, mockWidth)).toEqual([]);
  });

  it('keeps short text on one line', () => {
    expect(chunkByPixelWidth('hello', 60, 1, mockWidth)).toEqual(['hello']);
  });

  it('wraps by words within width', () => {
    const lines = chunkByPixelWidth('hello world test', 60, 1, mockWidth);
    expect(lines).toEqual(['hello', 'world test']);
  });

  it('hard breaks a single long word', () => {
    const lines = chunkByPixelWidth('superlongword', 30, 1, mockWidth);
    // 30px -> 5 chars per line in mock calc
    expect(lines).toEqual(['super', 'longw', 'ord']);
  });
});
