import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { HEX } from '@shared/types';
import { DRAWING_COLORS } from '@client/constants';
import { trpc } from '@client/trpc/client';

export function useRecentColors(
  paletteContainerRef: RefObject<HTMLDivElement | null>
) {
  const [currentColor, setCurrentColor] = useState<HEX>(
    DRAWING_COLORS[0] ?? '#000000'
  );
  const [recentColors, setRecentColors] = useState<HEX[]>(() =>
    DRAWING_COLORS.slice(0, 6)
  );
  const [isMRUAnimating, setIsMRUAnimating] = useState(false);
  const [suppressInitialAnim, setSuppressInitialAnim] = useState(true);

  // Mutations/queries
  const pushRecentMutation = trpc.app.user.colors.pushRecent.useMutation();
  const schedulePushRecent = useCallback(
    (color: HEX) => {
      try {
        pushRecentMutation.mutate({ color });
      } catch {
        // best-effort
      }
    },
    [pushRecentMutation]
  );

  const didInitCurrentRef = useRef(false);
  const recentQuery = trpc.app.user.colors.getRecent.useQuery(undefined, {
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (recentQuery.isSuccess && Array.isArray(recentQuery.data)) {
      const colors = recentQuery.data;
      setRecentColors(colors.slice(0, 6));
      if (!didInitCurrentRef.current) {
        const firstColor = colors[0];
        if (firstColor) {
          setCurrentColor(firstColor);
          didInitCurrentRef.current = true;
          setSuppressInitialAnim(false);
        }
      }
    }
  }, [
    recentQuery.isFetching,
    recentQuery.isSuccess,
    recentQuery.isError,
    recentQuery.data,
  ]);

  // Animate removal helper
  const animateRemovalIfNeeded = useCallback(
    (prev: HEX[], next: HEX[]): Promise<void> => {
      const container = paletteContainerRef.current;
      if (!container) return Promise.resolve();
      if (prev.length === next.length) return Promise.resolve();
      const removed = prev.find((c) => !next.includes(c));
      if (!removed) return Promise.resolve();
      const el = container.querySelector<HTMLElement>(
        `[data-color="${removed}"]`
      );
      if (!el) return Promise.resolve();
      return new Promise((resolve) => {
        el.style.willChange = 'transform, opacity';
        el.style.transition = 'transform 220ms ease, opacity 180ms ease';
        el.style.transform = 'scale(0.7) translateY(6px)';
        el.style.opacity = '0';
        const onEnd = () => {
          el.style.transition = '';
          el.removeEventListener('transitionend', onEnd);
          resolve();
        };
        el.addEventListener('transitionend', onEnd);
      });
    },
    [paletteContainerRef]
  );

  // MRU update
  const updateRecentWithDrama = useCallback(
    (color: HEX) => {
      setRecentColors((prev) => {
        const already = prev.includes(color);
        const merged = [color, ...prev.filter((c) => c !== color)];
        const next = merged.slice(0, 6);
        if (!already && prev.length >= 6) {
          setIsMRUAnimating(true);
          void animateRemovalIfNeeded(prev, next).then(() => {
            setRecentColors(next);
            setIsMRUAnimating(false);
          });
          schedulePushRecent(color);
          return prev;
        }
        schedulePushRecent(color);
        return next;
      });
    },
    [schedulePushRecent, animateRemovalIfNeeded]
  );

  return {
    currentColor,
    setCurrentColor,
    recentColors,
    updateRecentWithDrama,
    isMRUAnimating,
    suppressInitialAnim,
  };
}
