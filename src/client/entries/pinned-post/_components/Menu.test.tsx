import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { Menu } from './Menu';

const mockContext = { userId: 't2_user123' as string | null };
const mockRequestExpandedMode = vi.fn();
const mockShowLoginPrompt = vi.fn();

vi.mock('@client/hooks/useTelemetry', () => ({
  useTelemetry: () => ({
    track: vi.fn(async () => ({ ok: true })),
  }),
}));

vi.mock('@client/trpc/client', () => {
  const prefetch = vi.fn(async () => undefined);
  return {
    trpc: {
      useUtils: () => ({
        app: {
          user: {
            getProfile: { prefetch },
            colors: { getRecent: { prefetch } },
          },
          rewards: {
            getEffectiveBonuses: { prefetch },
          },
          dictionary: {
            getCandidates: { prefetch },
          },
        },
      }),
      app: {
        user: {
          getProfile: {
            useQuery: () => ({
              data: { levelProgressPercentage: 42, level: 5 },
            }),
          },
          isAdmin: {
            useQuery: () => ({ data: false }),
          },
          getPendingNavigation: {
            useMutation: () => ({
              mutateAsync: vi.fn(async () => ({ url: null })),
            }),
          },
        },
      },
    },
  };
});

vi.mock('@devvit/web/client', () => ({
  requestExpandedMode: (e: MouseEvent, mode: string) =>
    mockRequestExpandedMode(e, mode),
  showLoginPrompt: () => mockShowLoginPrompt(),
  addWebViewModeListener: vi.fn(),
  removeWebViewModeListener: vi.fn(),
  navigateTo: vi.fn(),
  context: mockContext,
}));

describe('Pinned menu logged-out actions', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows logged-out draw CTA and hides account buttons for logged-out users', () => {
    mockContext.userId = null;

    render(
      <Menu
        onMyDrawings={() => {}}
        onLeaderboard={() => {}}
        onHowToPlay={() => {}}
        onLevelClick={() => {}}
      />
    );

    const drawButton = screen.getByRole('button', { name: /log in to draw/i });
    expect(drawButton).toBeEnabled();
    fireEvent.click(drawButton);
    expect(mockShowLoginPrompt).toHaveBeenCalledTimes(1);
    expect(mockRequestExpandedMode).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: /my drawings/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /my rewards/i })
    ).not.toBeInTheDocument();
  });

  it('shows full menu for logged-in users', () => {
    mockContext.userId = 't2_user123';

    render(
      <Menu
        onMyDrawings={() => {}}
        onLeaderboard={() => {}}
        onHowToPlay={() => {}}
        onLevelClick={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: /draw/i })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /my drawings/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /my rewards/i })
    ).toBeInTheDocument();
  });
});
