import { useLayoutEffect, useRef, type RefObject } from 'react';

export function useFlipRecentTiles(
  containerRef: RefObject<HTMLDivElement>,
  deps: unknown[],
  opts?: { selectedKey?: string | null; suppress?: boolean }
) {
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const isFirstRenderRef = useRef(true);

  useLayoutEffect(() => {
    const container = containerRef.current;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!container) return;

    const tiles = Array.from(
      container.querySelectorAll<HTMLElement>('[data-color]')
    );
    const nextRects = new Map<string, DOMRect>();
    for (const el of tiles) {
      const key = el.dataset.color;
      if (!key) continue;
      nextRects.set(key, el.getBoundingClientRect());
    }

    // Suppress animations for this pass (e.g., initial MRU application)
    if (opts?.suppress) {
      prevRectsRef.current = nextRects;
      isFirstRenderRef.current = false;
      return;
    }

    const prevRects = prevRectsRef.current;
    // Skip animation on very first paint
    if (!isFirstRenderRef.current) {
      for (const el of tiles) {
        const key = el.dataset.color;
        if (!key) continue;
        const prev = prevRects.get(key);
        const next = nextRects.get(key);
        if (!next) continue;

        // New element: pop-in (more dramatic)
        if (!prev) {
          el.setAttribute('data-moving', '1');
          const anim = el.animate(
            [
              { transform: 'scale(0.6) translateY(8px)', opacity: 0 },
              { transform: 'scale(1)', opacity: 1 },
            ],
            {
              duration: 380,
              delay: 0,
              easing: 'cubic-bezier(.22,1,.36,1)',
              fill: 'forwards',
            }
          );
          anim.addEventListener('finish', () => {
            el.removeAttribute('data-moving');
          });
          continue;
        }

        // Reordered/moved element: single horizontal slide using FLIP
        const dx = prev.left - next.left;
        if (dx !== 0) {
          el.setAttribute('data-moving', '1');
          // FLIP via WAAPI: from horizontal delta to identity
          const move = el.animate(
            [
              { transform: `translate(${dx}px, 0)` },
              { transform: 'translate(0, 0)' },
            ],
            {
              duration: 520,
              delay: 0,
              easing: 'cubic-bezier(.22,1,.36,1)',
              fill: 'both',
            }
          );
          move.addEventListener('finish', () => {
            el.removeAttribute('data-moving');
          });
        }
      }
    } else {
      isFirstRenderRef.current = false;
    }

    // Update for next pass
    prevRectsRef.current = nextRects;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
