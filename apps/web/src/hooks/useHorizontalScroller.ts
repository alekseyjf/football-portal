'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Скільки ширини видимої частини гортає кнопка: край попередньої «сторінки» лишається видно. */
const SCROLL_PAGE_SHARE = 0.9;

type ScrollEdges = { canScrollBack: boolean; canScrollForward: boolean };

/**
 * Прокрутка вбік (стрічка матчів головної, D55): чи є куди гортати назад / вперед — для кнопок ‹ › — і гортання
 * «сторінкою». До першого вимірювання — початок списку: так само рендерить і сервер, без розбіжності гідратації.
 */
export function useHorizontalScroller<TElement extends HTMLElement>() {
  const scrollerRef = useRef<TElement>(null);
  const [edges, setEdges] = useState<ScrollEdges>({
    canScrollBack: false,
    canScrollForward: true,
  });

  // Синхронізація з DOM: прокрутка й розміри (вікно, новий матч у списку) — події браузера
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const updateEdges = () =>
      setEdges({
        canScrollBack: scroller.scrollLeft > 1,
        canScrollForward:
          scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1,
      });
    updateEdges();
    scroller.addEventListener('scroll', updateEdges, { passive: true });
    const resizeObserver = new ResizeObserver(updateEdges);
    resizeObserver.observe(scroller);
    if (scroller.firstElementChild) {
      resizeObserver.observe(scroller.firstElementChild);
    }
    return () => {
      scroller.removeEventListener('scroll', updateEdges);
      resizeObserver.disconnect();
    };
  }, []);

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    scroller.scrollBy({
      left: direction * scroller.clientWidth * SCROLL_PAGE_SHARE,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, []);

  return { scrollerRef, ...edges, scrollByPage };
}
