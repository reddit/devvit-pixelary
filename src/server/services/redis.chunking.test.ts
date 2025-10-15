import { describe, it, expect } from 'vitest';
import { chunkString, joinChunks } from './redis';

describe('chunkString/joinChunks', () => {
  it('roundtrips long strings', () => {
    const input = 'x'.repeat(350_123);
    const chunks = chunkString(input, 100_000);
    expect(chunks.length).toBeGreaterThan(3);
    const out = joinChunks(chunks);
    expect(out.length).toBe(input.length);
    expect(out).toBe(input);
  });
  it('handles small sizes', () => {
    const input = 'hello';
    const chunks = chunkString(input, 2);
    expect(joinChunks(chunks)).toBe(input);
  });
});
