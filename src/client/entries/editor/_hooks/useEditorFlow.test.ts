import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import { useEditorFlow } from './useEditorFlow';

describe('useEditorFlow', () => {
  it('transitions word -> draw -> review and back', () => {
    const { result } = renderHook(() => useEditorFlow());
    expect(result.current.step).toBe('word');
    void act(() => {
      result.current.setWord('cat');
      result.current.toDraw();
    });
    expect(result.current.step).toBe('draw');
    void act(() => {
      result.current.toReview();
    });
    expect(result.current.step).toBe('review');
    void act(() => {
      result.current.back();
    });
    expect(result.current.step).toBe('draw');
  });
});
