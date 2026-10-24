import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { localeToBcp47 } from '@/lib/i18n/content-lang';

/** Порівняння рядків за абеткою мови сторінки (`uk-UA`: «Ґ» після «Г», «І» після «И»), а не за кодами Unicode. */
export function useCollator(): Intl.Collator {
  const locale = useLocale();
  return useMemo(() => new Intl.Collator(localeToBcp47(locale)), [locale]);
}
