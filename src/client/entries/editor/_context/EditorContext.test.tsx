import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { EditorContextProvider, useEditorContext } from './EditorContext';
import { trpc } from '@client/trpc/client';

function Probe() {
  const ctx = useEditorContext();
  return <div data-testid="step">{ctx.step}</div>;
}

describe('EditorContext', () => {
  it('provides flow defaults', () => {
    // Minimal mocks for profile and dictionary
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (trpc.app.user.getProfile.useQuery as any) = () => ({ data: { level: 1 } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (trpc.app.rewards.getEffectiveBonuses.useQuery as any) = () => ({
      data: { extraDrawingTimeSeconds: 0 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (trpc.app.dictionary.getCandidates.useQuery as any) = () => ({
      data: { slateId: 's', words: ['a', 'b', 'c'] },
      isLoading: false,
      refetch: () => {},
    });
    render(
      <EditorContextProvider>
        <Probe />
      </EditorContextProvider>
    );
    expect(document.querySelector('[data-testid="step"]')?.textContent).toBe(
      'word'
    );
  });
});
