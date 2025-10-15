import { describe, it, expect } from 'vitest';
import { keyPost } from './redis';

describe('keyPost', () => {
  it('namespaces with unknown when null', () => {
    expect(keyPost(null, 'x')).toBe('pixelary:post:unknown:x');
  });
  it('namespaces with post id', () => {
    expect(keyPost('t3_abc', 'users')).toBe('pixelary:post:t3_abc:users');
  });
});
