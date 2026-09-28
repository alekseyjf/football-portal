'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { matchesPageHref } from '@/lib/football/matches-page';
import { formatDateTime } from '@/lib/i18n/date-time';
import { dayKeyToUtcNoon, shiftDayKey } from '@/lib/i18n/zoned-date';

type Props = {
  /** День сторінки `YYYY-MM-DD` у поясі користувача */
  dayKey: string;
  todayKey: string;
  leagueSlug: string | null;
};

const ARROW_LINK_CLASS =
  'inline-flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-600 hover:text-white';

/** Попередній / наступний день і сам день; сьогодні — без `?date=` (канонічний `/matches`). */
export function MatchesDayNav({ dayKey, todayKey, leagueSlug }: Props) {
  const t = useTranslations('matches');
  const locale = useLocale();
  // Підпис самого дня (не миттєвості): полудень UTC у поясі UTC — без зсуву поясом користувача
  const formatDay = (key: string, options: Intl.DateTimeFormatOptions) =>
    formatDateTime(dayKeyToUtcNoon(key), locale, 'UTC', options);
  const hrefFor = (key: string) =>
    matchesPageHref(key === todayKey ? null : key, leagueSlug);

  const previousDayKey = shiftDayKey(dayKey, -1);
  const nextDayKey = shiftDayKey(dayKey, 1);
  const relativeDayLabel =
    dayKey === todayKey
      ? t('today')
      : dayKey === shiftDayKey(todayKey, -1)
        ? t('yesterday')
        : dayKey === shiftDayKey(todayKey, 1)
          ? t('tomorrow')
          : null;
  const isSameYear = dayKey.slice(0, 4) === todayKey.slice(0, 4);
  const dayTitle = formatDay(dayKey, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(isSameYear ? {} : { year: 'numeric' }),
  });
  const shortDay = (key: string) =>
    formatDay(key, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="flex items-center justify-between gap-3">
      <Link
        href={hrefFor(previousDayKey)}
        aria-label={`${t('previousDay')}: ${shortDay(previousDayKey)}`}
        className={ARROW_LINK_CLASS}
      >
        <span aria-hidden>‹</span>
        <span className="hidden sm:inline" aria-hidden>
          {shortDay(previousDayKey)}
        </span>
      </Link>

      <div className="min-w-0 text-center">
        {relativeDayLabel && (
          <p className="text-xs uppercase tracking-wider text-green-400">
            {relativeDayLabel}
          </p>
        )}
        <p className="text-lg font-semibold text-white first-letter:uppercase">
          <time dateTime={dayKey}>{dayTitle}</time>
        </p>
        {dayKey !== todayKey && (
          <Link
            href={matchesPageHref(null, leagueSlug)}
            className="text-xs text-neutral-400 underline underline-offset-2 hover:text-white"
          >
            {t('goToToday')}
          </Link>
        )}
      </div>

      <Link
        href={hrefFor(nextDayKey)}
        aria-label={`${t('nextDay')}: ${shortDay(nextDayKey)}`}
        className={ARROW_LINK_CLASS}
      >
        <span className="hidden sm:inline" aria-hidden>
          {shortDay(nextDayKey)}
        </span>
        <span aria-hidden>›</span>
      </Link>
    </div>
  );
}
