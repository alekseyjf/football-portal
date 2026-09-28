import { useCallback } from 'react';
import { useLocale, useTimeZone } from 'next-intl';
import { DEFAULT_TIME_ZONE } from '@/i18n/time-zone';
import { formatDateTime } from '@/lib/i18n/date-time';

/**
 * Форматер дат для клієнтських компонентів: мова й пояс — з next-intl, ті самі, що на SSR
 * (без hydration mismatch). Не використовувати `toLocaleString` / `toLocaleDateString` напряму.
 */
export function useDateTimeFormat() {
  const locale = useLocale();
  const timeZone = useTimeZone() ?? DEFAULT_TIME_ZONE;
  return useCallback(
    (value: string | Date, options?: Intl.DateTimeFormatOptions) =>
      formatDateTime(value, locale, timeZone, options),
    [locale, timeZone],
  );
}
