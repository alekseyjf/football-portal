import type { FootballLeagueMeta } from '@/lib/api/types';

/**
 * Ліга сайдбару без `?league=`: `NEXT_PUBLIC_DEFAULT_LEAGUE_SLUG`, якщо вона серед активних
 * (`GET /football/leagues`), інакше перша за `sortOrder` (API вже відсортував). Вимкнена
 * в адмінці ліга (`isActive = false`) за замовчуванням не відкривається — лише за посиланням.
 * Список не завантажився (API недоступне) — env як є.
 */
export function resolveDefaultLeagueSlug(
  activeLeagues: FootballLeagueMeta[] | null,
): string | null {
  const envLeagueSlug =
    process.env.NEXT_PUBLIC_DEFAULT_LEAGUE_SLUG?.trim() || null;
  if (!activeLeagues) return envLeagueSlug;
  if (
    envLeagueSlug &&
    activeLeagues.some((league) => league.slug === envLeagueSlug)
  ) {
    return envLeagueSlug;
  }
  return activeLeagues[0]?.slug ?? null;
}
