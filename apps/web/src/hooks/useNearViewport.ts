import { useEffect, useState } from 'react';

/**
 * Елемент наблизився до видимої області (із запасом `rootMargin`) — один раз і назавжди: так блок унизу сторінки
 * вантажить дані, лише коли до нього докрутили (коментарі — не в SSR, D27).
 */
export function useNearViewport<T extends Element>(rootMargin: string) {
  const [element, setElement] = useState<T | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    if (!element || isNearViewport) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNearViewport(true);
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, isNearViewport, rootMargin]);

  return { ref: setElement, isNearViewport };
}
