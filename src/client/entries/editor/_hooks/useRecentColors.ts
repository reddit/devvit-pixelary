import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { HEX } from '@shared/types';
import { DRAWING_COLORS } from '@client/constants';
import { trpc } from '@client/trpc/client';

export function useRecentColors(
  paletteContainerRef: RefObject<HTMLDivElement | null>
) {
  // Persistent storage keys
  const RECENT_COLORS_STORAGE_KEY = 'pixelary:recentColors';
  const CURRENT_COLOR_STORAGE_KEY = 'pixelary:currentColor';

  const readRecentFromStorage = (): HEX[] | null => {
    try {
      const raw =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(RECENT_COLORS_STORAGE_KEY)
          : null;
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return null;
      const hexes = parsed.filter((c): c is HEX => typeof c === 'string');
      return hexes.slice(0, 7);
    } catch {
      return null;
    }
  };

  const readCurrentFromStorage = (): HEX | null => {
    try {
      const raw =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(CURRENT_COLOR_STORAGE_KEY)
          : null;
      if (!raw || typeof raw !== 'string') return null;
      return raw as HEX;
    } catch {
      return null;
    }
  };

  const writeRecentToStorage = (colors: HEX[]): void => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(
        RECENT_COLORS_STORAGE_KEY,
        JSON.stringify(colors.slice(0, 7))
      );
    } catch {
      // best-effort
    }
  };

  const writeCurrentToStorage = (color: HEX): void => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(CURRENT_COLOR_STORAGE_KEY, color);
    } catch {
      // best-effort
    }
  };

  // Load any locally cached MRU immediately to avoid a flash of defaults
  const initialRecentFromStorage = readRecentFromStorage();
  const initialCurrentFromStorage = readCurrentFromStorage();
  const initializedFromStorage =
    Array.isArray(initialRecentFromStorage) &&
    initialRecentFromStorage.length > 0;

  const [currentColor, setCurrentColor] = useState<HEX>(
    initialCurrentFromStorage ?? DRAWING_COLORS[0] ?? '#000000'
  );
  const [recentColors, setRecentColors] = useState<HEX[]>(
    () => initialRecentFromStorage ?? DRAWING_COLORS.slice(0, 7)
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

  const didInitCurrentRef = useRef(Boolean(initialCurrentFromStorage));
  const recentQuery = trpc.app.user.colors.getRecent.useQuery(undefined, {
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (recentQuery.isSuccess && Array.isArray(recentQuery.data)) {
      const colors = recentQuery.data;
      const next = colors.slice(0, 7);
      setRecentColors(next);
      writeRecentToStorage(next);
      if (!didInitCurrentRef.current) {
        const firstColor = colors[0];
        if (firstColor) {
          setCurrentColor(firstColor);
          didInitCurrentRef.current = true;
          setSuppressInitialAnim(false);
          writeCurrentToStorage(firstColor);
        }
      }
    }
  }, [
    recentQuery.isFetching,
    recentQuery.isSuccess,
    recentQuery.isError,
    recentQuery.data,
  ]);

  // If we started with storage, end the initial suppression after first paint
  useEffect(() => {
    if (initializedFromStorage) {
      setSuppressInitialAnim(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist changes locally for faster subsequent loads
  useEffect(() => {
    writeRecentToStorage(recentColors);
  }, [recentColors]);
  useEffect(() => {
    writeCurrentToStorage(currentColor);
  }, [currentColor]);

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
        const next = merged.slice(0, 7);
        if (!already && prev.length >= 7) {
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
